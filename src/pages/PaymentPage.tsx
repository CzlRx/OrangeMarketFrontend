import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, CreditCard, XCircle } from 'lucide-react'
import type { Order, OrderStatus } from '../types'
import { orderApi } from '../lib/api'
import { formatDateTime, formatPrice, ORDER_STATUS_LABELS } from '../lib/format'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { Breadcrumb } from '../components/Breadcrumb'
import { useToast } from '../state/ToastContext'

const PAID_STATUSES = new Set<OrderStatus>([
  'pending_shipment',
  'pending_receipt',
  'pending_review',
  'completed',
  'refunding',
  'refunded',
])

function useCountdown(target?: string) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!target) {
      setSeconds(0)
      return
    }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000))
      setSeconds(diff)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [target])
  return seconds
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function PaymentPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

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

  const remaining = useCountdown(order?.paymentExpireAt)

  const pay = async () => {
    setPaying(true)
    try {
      await orderApi.pay(orderId, { paymentMethod: 'mock' })
      toast('支付成功')
      navigate(`/orders/${orderId}`, { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : '支付失败', 'error')
      void load()
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>
  if (!order) return <div className="page"><EmptyState title="订单不存在" /></div>

  const paid = PAID_STATUSES.has(order.status)
  const cancelled = order.status === 'cancelled'
  const expirePassed = order.paymentExpireAt
    ? new Date(order.paymentExpireAt).getTime() <= Date.now()
    : false
  const expired = order.status === 'pending_payment' && expirePassed
  const canPay = order.status === 'pending_payment' && !expired

  let statusClass = ''
  let statusIcon = <CreditCard size={34} />
  let statusTitle = `待支付 ${formatPrice(order.total)}`
  let statusDesc = '使用模拟支付完成付款'

  if (paid) {
    statusClass = 'success'
    statusIcon = <CheckCircle2 size={34} />
    statusTitle = '订单已支付'
    statusDesc = `当前状态：${ORDER_STATUS_LABELS[order.status]}`
  } else if (cancelled) {
    statusClass = 'muted'
    statusIcon = <XCircle size={34} />
    statusTitle = '订单已取消'
    statusDesc = '该订单已取消，无法继续支付'
  } else if (expired) {
    statusClass = 'muted'
    statusIcon = <Clock3 size={34} />
    statusTitle = '支付已超时'
    statusDesc = '订单支付时限已过，请返回订单列表查看'
  }

  return (
    <div className="page payment-page">
      <Breadcrumb
        items={[
          { label: '首页', to: '/' },
          { label: '我的订单', to: '/orders' },
          { label: '订单支付' },
        ]}
      />

      <div className="payment-panel">
        <div className={`payment-status ${statusClass}`}>
          {statusIcon}
          <h1>{statusTitle}</h1>
          <p>{statusDesc}</p>
        </div>

        <div className="payment-info">
          <div className="summary-line">
            <span>订单号</span>
            <b>{order.orderNo}</b>
          </div>
          <div className="summary-line">
            <span>创建时间</span>
            <b>{formatDateTime(order.createdAt)}</b>
          </div>
          {order.paymentExpireAt && canPay && (
            <div className="summary-line countdown-line">
              <span>
                <Clock3 size={15} />
                支付剩余
              </span>
              <b className={remaining <= 300 ? 'urgent' : ''}>{formatDuration(remaining)}</b>
            </div>
          )}
        </div>

        <div className="payment-actions">
          {canPay ? (
            <button
              type="button"
              className="button primary"
              onClick={pay}
              disabled={paying}
            >
              {paying ? '支付中...' : '确认支付'}
            </button>
          ) : (
            <Link to={`/orders/${order.id}`} className="button primary">
              查看订单
            </Link>
          )}
          <Link to="/orders" className="button secondary">
            返回订单列表
          </Link>
        </div>
      </div>
    </div>
  )
}
