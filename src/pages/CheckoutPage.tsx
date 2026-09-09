import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, ShoppingBag } from 'lucide-react'
import type { Address, OrderPreview, Product } from '../types'
import { orderApi, productApi, userApi } from '../lib/api'
import { formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { Breadcrumb } from '../components/Breadcrumb'
import { useToast } from '../state/ToastContext'

export function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const ids = useMemo(
    () => searchParams.get('ids')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  )
  const directProductId = searchParams.get('productId') ?? ''
  const directQuantity = Number(searchParams.get('quantity') ?? '1')
  const isDirect = Boolean(directProductId)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressId, setAddressId] = useState('')
  const [preview, setPreview] = useState<OrderPreview | null>(null)
  const [directProduct, setDirectProduct] = useState<Product | null>(null)
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadAddresses = useCallback(async () => {
    const data = await userApi.addresses()
    setAddresses(data)
    setAddressId((current) => current || data.find((item) => item.isDefault)?.id || data[0]?.id || '')
  }, [])

  const loadPreview = useCallback(async () => {
    if (!addressId || ids.length === 0) return
    const data = await orderApi.cartPreview({ cartItemIds: ids, addressId })
    setPreview(data)
  }, [addressId, ids])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const tasks: Promise<unknown>[] = [loadAddresses()]
    if (isDirect) {
      tasks.push(
        productApi.detail(directProductId).then((data) => setDirectProduct(data.product)),
      )
    }
    Promise.all(tasks)
      .catch((err) => toast(err instanceof Error ? err.message : '结算信息加载失败', 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [directProductId, isDirect, loadAddresses, toast])

  useEffect(() => {
    if (!isDirect && ids.length && addressId) void loadPreview()
    if (isDirect && directProduct) setPreview(null)
  }, [ids, addressId, isDirect, directProduct, loadPreview])

  const submitOrder = async () => {
    if (!addressId) {
      toast('请选择收货地址', 'error')
      return
    }
    setSubmitting(true)
    try {
      const result = isDirect
        ? await orderApi.createDirect({
            productId: directProductId,
            quantity: directQuantity,
            addressId,
            buyerRemark: remark || undefined,
          })
        : await orderApi.createFromCart({
            cartItemIds: ids,
            addressId,
            buyerRemark: remark || undefined,
          })
      toast('订单已创建，请完成支付')
      navigate(`/payment/${result.orderId}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : '下单失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>

  const lineItems = preview?.items ?? (directProduct
    ? [{
        id: '',
        productId: directProduct.id,
        productName: directProduct.name,
        productImage: productImage(directProduct),
        unitPrice: directProduct.price,
        quantity: directQuantity,
        lineAmount: directProduct.price * directQuantity,
      }]
    : [])
  const subtotal = preview?.subtotal ?? lineItems.reduce((sum, item) => sum + item.lineAmount, 0)
  const shippingFee = preview?.shippingFee ?? 0

  return (
    <div className="page checkout-page">
      <Breadcrumb
        items={[
          { label: '首页', to: '/' },
          { label: '购物车', to: '/cart' },
          { label: '确认订单' },
        ]}
      />

      <div className="page-heading">
        <div>
          <h1>确认订单</h1>
          <p>{isDirect ? '立即购买' : '购物车结算'} · 请核对以下信息</p>
        </div>
        <Link to="/cart" className="icon-text-button">
          <ShoppingBag size={16} />
          返回购物车
        </Link>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          title="还没有收货地址"
          description="先添加一个地址再下单"
          icon={MapPin}
          action={
            <Link to="/addresses" className="button primary">
              去添加地址
            </Link>
          }
        />
      ) : (
        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-section">
              <div className="section-title">
                <MapPin size={17} />
                <h2>收货地址</h2>
                <Link to="/addresses">管理地址</Link>
              </div>
              <div className="address-picker">
                {addresses.map((address) => (
                  <button
                    type="button"
                    key={address.id}
                    className={address.id === addressId ? 'address-option active' : 'address-option'}
                    onClick={() => setAddressId(address.id)}
                  >
                    <span className="address-option-top">
                      <strong>{address.receiver}</strong>
                      <span>{address.phone}</span>
                      {address.isDefault && <i>默认</i>}
                    </span>
                    <span className="address-option-detail">
                      {address.province}
                      {address.city}
                      {address.district}
                      {address.detail}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="checkout-section">
              <div className="section-title">
                <ShoppingBag size={17} />
                <h2>商品清单</h2>
              </div>
              <div className="checkout-items">
                {lineItems.map((item, index) => (
                  <div className="checkout-item" key={`${item.productId}-${index}`}>
                    <Link to={`/product/${item.productId}`}>
                      <img src={item.productImage} alt={item.productName} />
                    </Link>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>{formatPrice(item.unitPrice)} × {item.quantity}</span>
                    </div>
                    <b>{formatPrice(item.lineAmount)}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="checkout-section">
              <div className="section-title">
                <h2>订单备注</h2>
              </div>
              <textarea
                className="remark-input"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="给商家留言（选填）"
                rows={3}
                maxLength={200}
              />
            </section>
          </div>

          <aside className="checkout-summary">
            <h2>金额明细</h2>
            <div className="summary-line">
              <span>商品小计</span>
              <b>{formatPrice(subtotal)}</b>
            </div>
            <div className="summary-line">
              <span>运费</span>
              <b>{shippingFee === 0 ? '包邮' : formatPrice(shippingFee)}</b>
            </div>
            <div className="summary-total">
              <span>应付</span>
              <strong>{formatPrice(subtotal + shippingFee)}</strong>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={submitOrder}
              disabled={submitting}
            >
              {submitting ? '提交中...' : '提交订单'}
            </button>
            <p className="muted-note">提交后需在 30 分钟内完成支付</p>
          </aside>
        </div>
      )}
    </div>
  )
}
