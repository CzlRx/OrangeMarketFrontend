import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Headset, Images, Package, PackageCheck, RefreshCw, ShieldBan, Truck, X } from 'lucide-react'
import type { AdminShipmentResult, AdminUserStatusResult, Order, Product } from '../types'
import { adminApi, productApi } from '../lib/api'
import { OSS_IMAGE_ACCEPT, uploadImageToOss } from '../lib/ossUpload'
import { formatDateTime, formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { Breadcrumb } from '../components/Breadcrumb'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { ConfirmModal } from '../components/Modal'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'

const MAX_PRODUCT_IMAGES = 20
const SHIP_PAGE_SIZE = 10

function formatShipAddress(order: Order) {
  const { address } = order
  return `${address.receiver} ${address.phone} · ${address.province}${address.city}${address.district}${address.detail}`
}

export function AdminPage() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderPage, setOrderPage] = useState(1)
  const [hasMoreOrders, setHasMoreOrders] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false)
  const [trackingNo, setTrackingNo] = useState('')
  const [shipping, setShipping] = useState(false)
  const [shipment, setShipment] = useState<AdminShipmentResult | null>(null)
  const trackingInputRef = useRef<HTMLInputElement>(null)

  const [banUserId, setBanUserId] = useState('')
  const [banning, setBanning] = useState(false)
  const [bannedUser, setBannedUser] = useState<AdminUserStatusResult | null>(null)
  const [confirmBan, setConfirmBan] = useState(false)

  const [productId, setProductId] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState('')
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [savingImages, setSavingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  const loadPendingOrders = useCallback(
    async (nextPage = 1) => {
      setLoadingOrders(nextPage === 1)
      try {
        const data = await adminApi.listOrders({
          status: 'pending_shipment',
          page: nextPage,
          pageSize: SHIP_PAGE_SIZE,
        })
        setPendingOrders((prev) => (nextPage === 1 ? data.list : [...prev, ...data.list]))
        setOrderPage(data.page)
        setHasMoreOrders(data.hasMore)
        if (nextPage === 1) {
          setSelectedOrder((current) =>
            current && data.list.some((order) => order.id === current.id) ? current : null,
          )
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : '待发货订单加载失败', 'error')
      } finally {
        setLoadingOrders(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    void loadPendingOrders()
  }, [loadPendingOrders])

  const loadMoreOrders = async () => {
    if (loadingMoreOrders || !hasMoreOrders) return
    setLoadingMoreOrders(true)
    await loadPendingOrders(orderPage + 1)
    setLoadingMoreOrders(false)
  }

  const selectOrder = (order: Order) => {
    setSelectedOrder(order)
    requestAnimationFrame(() => trackingInputRef.current?.focus())
  }

  const submitShip = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedOrder) {
      toast('请先选择待发货订单', 'error')
      return
    }
    const tracking = trackingNo.trim()
    if (!tracking) {
      toast('请填写快递单号', 'error')
      return
    }
    setShipping(true)
    try {
      const result = await adminApi.shipOrder(selectedOrder.id, { trackingNo: tracking })
      setShipment(result)
      toast('发货成功')
      setSelectedOrder(null)
      setTrackingNo('')
      await loadPendingOrders(1)
    } catch (err) {
      toast(err instanceof Error ? err.message : '发货失败', 'error')
    } finally {
      setShipping(false)
    }
  }

  const submitBan = (event: FormEvent) => {
    event.preventDefault()
    if (!banUserId.trim()) {
      toast('请填写用户 ID', 'error')
      return
    }
    setConfirmBan(true)
  }

  const banUser = async () => {
    setConfirmBan(false)
    setBanning(true)
    try {
      const result = await adminApi.banUser(banUserId.trim())
      setBannedUser(result)
      toast('该用户已被封禁')
      setBanUserId('')
    } catch (err) {
      toast(err instanceof Error ? err.message : '封禁失败', 'error')
    } finally {
      setBanning(false)
    }
  }

  const loadProductImages = async (event: FormEvent) => {
    event.preventDefault()
    const id = productId.trim()
    if (!id) {
      toast('请填写商品 ID', 'error')
      return
    }
    setLoadingProduct(true)
    try {
      const detail = await productApi.detail(id)
      const nextImages = detail.product.images ?? []
      setProduct(detail.product)
      setImages(nextImages)
      setCoverImage(nextImages[0] ?? '')
      toast(nextImages.length ? '已加载商品图片' : '该商品暂无图片，请先上传')
    } catch (err) {
      setProduct(null)
      setImages([])
      setCoverImage('')
      toast(
        err instanceof Error
          ? `${err.message}。商品若已下架，仍可在下方上传后保存`
          : '商品加载失败',
        'error',
      )
    } finally {
      setLoadingProduct(false)
    }
  }

  const handleProductImagesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const id = productId.trim()
    if (!id) {
      toast('请先填写商品 ID', 'error')
      return
    }
    if (!user?.id) {
      toast('请先登录', 'error')
      return
    }

    const remaining = MAX_PRODUCT_IMAGES - images.length
    if (remaining <= 0) {
      toast('商品图片数量不能超过 20 张', 'error')
      return
    }
    const selected = files.slice(0, remaining)
    if (files.length > remaining) {
      toast(`最多 20 张，已忽略超出的 ${files.length - remaining} 张`, 'info')
    }

    setUploadingImages(true)
    const uploaded: string[] = []
    try {
      for (let index = 0; index < selected.length; index += 1) {
        setUploadProgress(`上传中 ${index + 1}/${selected.length}`)
        const result = await uploadImageToOss({
          file: selected[index],
          scene: 'product',
          userId: user.id,
        })
        uploaded.push(result.accessUrl)
      }
      setImages((current) => [...current, ...uploaded])
      setCoverImage((cover) => cover || uploaded[0] || '')
      toast(uploaded.length === 1 ? '图片已上传' : `已上传 ${uploaded.length} 张图片`)
    } catch (err) {
      if (uploaded.length) {
        setImages((current) => [...current, ...uploaded])
        setCoverImage((cover) => cover || uploaded[0] || '')
      }
      toast(err instanceof Error ? err.message : '商品图上传失败', 'error')
    } finally {
      setUploadingImages(false)
      setUploadProgress('')
    }
  }

  const removeImage = (url: string) => {
    setImages((current) => {
      const next = current.filter((item) => item !== url)
      setCoverImage((cover) => (cover === url ? next[0] ?? '' : cover))
      return next
    })
  }

  const saveProductImages = async (event: FormEvent) => {
    event.preventDefault()
    const id = productId.trim()
    if (!id) {
      toast('请填写商品 ID', 'error')
      return
    }
    if (!images.length) {
      toast('请至少上传一张商品图', 'error')
      return
    }
    const ordered = coverImage && images.includes(coverImage)
      ? [coverImage, ...images.filter((item) => item !== coverImage)]
      : images
    setSavingImages(true)
    try {
      const updated = await adminApi.updateProductImages(id, {
        coverImage: ordered[0],
        images: ordered,
      })
      setProduct(updated)
      setImages(updated.images ?? ordered)
      setCoverImage((updated.images ?? ordered)[0] ?? '')
      toast('商品图片已保存')
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存商品图片失败', 'error')
    } finally {
      setSavingImages(false)
    }
  }

  return (
    <div className="page admin-page">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '管理后台' }]} />

      <div className="page-heading">
        <div>
          <h1>管理后台</h1>
          <p>订单发货、用户封禁与商品图片管理</p>
        </div>
        <div className="page-heading-actions">
          <Link to="/admin/service" className="icon-text-button">
            <Headset size={15} />
            客服工作台
          </Link>
          <Link to="/profile" className="icon-text-button">
            返回个人中心
          </Link>
        </div>
      </div>

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="checkout-section">
            <div className="section-title">
              <Truck size={17} />
              <h2>订单发货</h2>
              <button type="button" onClick={() => void loadPendingOrders(1)} disabled={loadingOrders}>
                <RefreshCw size={14} />
                {loadingOrders ? '刷新中...' : '刷新'}
              </button>
            </div>

            {loadingOrders && pendingOrders.length === 0 ? (
              <LoadingState label="正在加载待发货订单" />
            ) : pendingOrders.length === 0 ? (
              <EmptyState title="暂无待发货订单" description="支付完成的订单会出现在这里" icon={Package} />
            ) : (
              <div className="admin-ship-list">
                <div className="order-list">
                  {pendingOrders.map((order) => (
                    <article
                      className={`order-card selectable${selectedOrder?.id === order.id ? ' selected' : ''}`}
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedOrder?.id === order.id}
                      onClick={() => selectOrder(order)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          selectOrder(order)
                        }
                      }}
                    >
                      <header className="order-card-head">
                        <div>
                          <strong>{order.orderNo}</strong>
                          <time>付款 {formatDateTime(order.paidAt || order.createdAt)}</time>
                        </div>
                        <StatusPill status={order.status} />
                      </header>
                      <div className="order-card-body">
                        <div className="order-card-items">
                          {order.items.slice(0, 4).map((item) => (
                            <span
                              key={item.id || item.productId}
                              className="order-thumb"
                              title={`${item.productName} ×${item.quantity}`}
                            >
                              <img
                                src={item.productImage || productImage({ id: item.productId, name: item.productName })}
                                alt={item.productName}
                              />
                            </span>
                          ))}
                        </div>
                        <div className="order-card-total">
                          <span>共 {order.items.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
                          <strong>{formatPrice(order.total)}</strong>
                        </div>
                      </div>
                      <div className="order-card-meta">
                        <p>{order.items.map((item) => `${item.productName} ×${item.quantity}`).join('、')}</p>
                        <p>{formatShipAddress(order)}</p>
                        {order.buyerRemark ? <p>备注：{order.buyerRemark}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="load-more-row">
                  {hasMoreOrders ? (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => void loadMoreOrders()}
                      disabled={loadingMoreOrders}
                    >
                      {loadingMoreOrders ? '加载中...' : '加载更多'}
                    </button>
                  ) : (
                    <span className="end-note">已经到底了</span>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={submitShip}>
              <div className="form-grid">
                <label className="wide-field">
                  <span>快递单号{selectedOrder ? ` · ${selectedOrder.orderNo}` : ''}</span>
                  <input
                    ref={trackingInputRef}
                    value={trackingNo}
                    onChange={(event) => setTrackingNo(event.target.value)}
                    placeholder={selectedOrder ? '发货快递单号' : '请先选择上方待发货订单'}
                    maxLength={128}
                    disabled={!selectedOrder || shipping}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={shipping || !selectedOrder}
                >
                  {shipping ? '发货中...' : '确认发货'}
                </button>
              </div>
              <p className="muted-note">从上方列表选择订单后填写快递单号。仅待发货订单可以发货，发货后转为待收货。</p>
            </form>
          </section>

          <section className="checkout-section">
            <div className="section-title">
              <Images size={17} />
              <h2>商品图片</h2>
            </div>
            <form onSubmit={loadProductImages}>
              <div className="form-grid">
                <label className="wide-field">
                  <span>商品 ID</span>
                  <input
                    value={productId}
                    onChange={(event) => setProductId(event.target.value.trim())}
                    placeholder="要更新图片的商品 ID"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="button secondary" disabled={loadingProduct}>
                  {loadingProduct ? '加载中...' : '加载当前图片'}
                </button>
                <button
                  type="button"
                  className="button ghost"
                  disabled={uploadingImages || images.length >= MAX_PRODUCT_IMAGES || !productId.trim()}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploadingImages ? uploadProgress || '上传中...' : '上传图片'}
                </button>
              </div>
            </form>
            <input
              ref={imageInputRef}
              type="file"
              accept={OSS_IMAGE_ACCEPT}
              multiple
              hidden
              onChange={handleProductImagesChange}
            />
            {product && (
              <p className="muted-note">
                当前商品：{product.name}（已售 {product.sales}，库存 {product.stock}）
              </p>
            )}
            {images.length > 0 ? (
              <div className="admin-image-grid">
                {images.map((url) => (
                  <div
                    key={url}
                    className={`admin-image-tile${url === coverImage ? ' cover' : ''}`}
                  >
                    <button type="button" onClick={() => setCoverImage(url)} title="设为封面">
                      <img src={url} alt="" />
                    </button>
                    {url === coverImage && <span className="admin-image-badge">封面</span>}
                    <button
                      type="button"
                      className="admin-image-remove"
                      onClick={() => removeImage(url)}
                      aria-label="移除这张图片"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-note">暂无图片。先签发直传到 OSS，再保存写入商品。</p>
            )}
            <form onSubmit={saveProductImages}>
              <div className="form-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={savingImages || uploadingImages || !images.length}
                >
                  {savingImages ? '保存中...' : '保存商品图片'}
                </button>
              </div>
              <p className="muted-note">
                支持 jpeg / png / webp / gif，单张不超过 5MB，最多 20 张。点击缩略图设为封面。
              </p>
            </form>
          </section>

          <section className="checkout-section">
            <div className="section-title">
              <ShieldBan size={17} />
              <h2>封禁用户</h2>
            </div>
            <form onSubmit={submitBan}>
              <div className="form-grid">
                <label className="wide-field">
                  <span>用户 ID</span>
                  <input
                    value={banUserId}
                    onChange={(event) => setBanUserId(event.target.value.trim())}
                    placeholder="要封禁的用户 ID"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="button secondary" disabled={banning}>
                  {banning ? '处理中...' : '封禁该用户'}
                </button>
              </div>
              <p className="muted-note">封禁后该用户将被强制下线且无法再登录，管理员账号不可被封禁</p>
            </form>
          </section>
        </div>

        <aside className="checkout-summary">
          <h2>最近操作</h2>
          {shipment ? (
            <>
              <div className="summary-line">
                <span>订单号</span>
                <b>{shipment.orderNo}</b>
              </div>
              <div className="summary-line">
                <span>订单状态</span>
                <b><StatusPill status={shipment.status} /></b>
              </div>
              <div className="summary-line">
                <span>快递单号</span>
                <b>{shipment.trackingNo}</b>
              </div>
              <div className="summary-line">
                <span>发货时间</span>
                <b>{formatDateTime(shipment.shippedAt)}</b>
              </div>
            </>
          ) : (
            <p className="muted-note">
              <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              暂无发货记录
            </p>
          )}
          {product && (
            <>
              <div className="summary-line">
                <span>商品</span>
                <b>{product.name}</b>
              </div>
              <div className="summary-line">
                <span>图片数量</span>
                <b>{images.length}</b>
              </div>
            </>
          )}
          {bannedUser && (
            <>
              <div className="summary-line">
                <span>已封禁用户</span>
                <b>{bannedUser.userId}</b>
              </div>
              <div className="summary-line">
                <span>用户状态</span>
                <b>{bannedUser.status === 'disabled' ? '已封禁' : bannedUser.status}</b>
              </div>
            </>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={confirmBan}
        title="封禁用户"
        content={`确定封禁用户 ${banUserId} 吗？封禁后该用户将立即退出登录且无法再登录。`}
        confirmText="确认封禁"
        danger
        onConfirm={banUser}
        onCancel={() => setConfirmBan(false)}
      />
    </div>
  )
}
