import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, Truck } from 'lucide-react'
import type { Order } from '../types'
import { orderApi } from '../lib/api'
import { formatDateTime, formatPrice, paymentMethodLabel } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { StatusPill } from '../components/StatusPill'
import { ConfirmModal } from '../components/Modal'
import { Breadcrumb } from '../components/Breadcrumb'
import { useToast } from '../state/ToastContext'

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'cancel' | 'receive' | null>(null)

  const load = useCallback(async () => {
    try {
      setOrder(await orderApi.detail(orderId))
    } catch (err) {
      toast(err instanceof Error ? err.message : '订单加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [orderId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = async () => {
    setBusy(true)
    setConfirm(null)
    try {
      await orderApi.cancel(orderId)
      toast('订单已取消')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '取消失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  const receive = async () => {
    setBusy(true)
    setConfirm(null)
    try {
      await orderApi.receive(orderId)
      toast('确认收货成功')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>
  if (!order) return <div className="page"><EmptyState title="订单不存在" /></div>

  return (
    <div className="page order-detail-page">
      <Breadcrumb
        items={[
          { label: '首页', to: '/' },
          { label: '我的订单', to: '/orders' },
          { label: '订单详情' },
        ]}
      />

      <div className="page-heading">
        <div>
          <h1>订单详情</h1>
          <p>{order.orderNo}</p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="order-detail-layout">
        <div className="order-detail-main">
          <section className="detail-section">
            <div className="section-title">
              <MapPin size={17} />
              <h2>收货信息</h2>
            </div>
            <div className="address-card">
              <strong>{order.address.receiver} · {order.address.phone}</strong>
              <p>
                {order.address.province}
                {order.address.city}
                {order.address.district}
                {order.address.detail}
              </p>
            </div>
          </section>

          <section className="detail-section">
            <div className="section-title">
              <Truck size={17} />
              <h2>商品清单</h2>
            </div>
            <div className="detail-items">
              {order.items.map((item) => (
                <div className="detail-item" key={item.id || item.productId}>
                  <Link to={`/product/${item.productId}`}>
                    <img
                      src={item.productImage || productImage({ id: item.productId, name: item.productName })}
                      alt={item.productName}
                    />
                  </Link>
                  <div>
                    <Link to={`/product/${item.productId}`}>{item.productName}</Link>
                    <span>{formatPrice(item.unitPrice)} × {item.quantity}</span>
                  </div>
                  <b>{formatPrice(item.lineAmount)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <div className="section-title">
              <h2>订单进度</h2>
            </div>
            <ol className="timeline">
              <li className="done">
                <span>创建订单</span>
                <time>{formatDateTime(order.createdAt)}</time>
              </li>
              <li className={order.paidAt ? 'done' : ''}>
                <span>完成支付</span>
                <time>{order.paidAt ? formatDateTime(order.paidAt) : '等待支付'}</time>
              </li>
              <li className={order.shippedAt ? 'done' : ''}>
                <span>商家发货</span>
                <time>{order.shippedAt ? formatDateTime(order.shippedAt) : '等待发货'}</time>
              </li>
              <li className={order.receivedAt ? 'done' : ''}>
                <span>确认收货</span>
                <time>{order.receivedAt ? formatDateTime(order.receivedAt) : '等待收货'}</time>
              </li>
              <li className={order.completedAt ? 'done' : ''}>
                <span>订单完成</span>
                <time>{order.completedAt ? formatDateTime(order.completedAt) : '进行中'}</time>
              </li>
            </ol>
          </section>
        </div>

        <aside className="order-summary">
          <h2>金额明细</h2>
          <div className="summary-line">
            <span>商品小计</span>
            <b>{formatPrice(order.subtotal)}</b>
          </div>
          <div className="summary-line">
            <span>运费</span>
            <b>{order.shippingFee === 0 ? '包邮' : formatPrice(order.shippingFee)}</b>
          </div>
          <div className="summary-total">
            <span>实付</span>
            <strong>{formatPrice(order.total)}</strong>
          </div>
          {order.paymentMethod && (
            <div className="summary-line">
              <span>支付方式</span>
              <b>{paymentMethodLabel(order.paymentMethod)}</b>
            </div>
          )}
          {order.buyerRemark && (
            <div className="order-remark">
              <span>备注</span>
              <p>{order.buyerRemark}</p>
            </div>
          )}
          {order.trackingNo && (
            <div className="order-remark">
              <span>物流单号</span>
              <p>{order.trackingNo}</p>
            </div>
          )}
          <div className="summary-actions">
            {order.status === 'pending_payment' && (
              <>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => navigate(`/payment/${order.id}`)}
                  disabled={busy}
                >
                  去支付
                </button>
                <button type="button" className="button secondary" onClick={() => setConfirm('cancel')} disabled={busy}>
                  取消订单
                </button>
              </>
            )}
            {order.status === 'pending_receipt' && (
              <button type="button" className="button primary" onClick={() => setConfirm('receive')} disabled={busy}>
                确认收货
              </button>
            )}
            {order.status === 'pending_review' && (
              <Link to="/reviews" className="button primary">
                去评价
              </Link>
            )}
            <Link to="/orders" className="button secondary">
              返回列表
            </Link>
          </div>
        </aside>
      </div>

      <ConfirmModal
        open={confirm === 'cancel'}
        title="取消订单"
        content="确认取消该订单吗？取消后无法恢复。"
        confirmText="取消订单"
        danger
        loading={busy}
        onConfirm={cancel}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === 'receive'}
        title="确认收货"
        content="请确认已收到全部商品，确认后订单将进入待评价状态。"
        confirmText="确认收货"
        loading={busy}
        onConfirm={receive}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
