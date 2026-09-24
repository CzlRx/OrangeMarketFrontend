import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, CreditCard, XCircle } from 'lucide-react'
import type { Order, OrderStatus, PayOrderResult } from '../types'
import { orderApi } from '../lib/api'
import { formatDateTime, formatPrice, ORDER_STATUS_LABELS } from '../lib/format'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { Breadcrumb } from '../components/Breadcrumb'
import { QrCodeImage } from '../components/QrCodeImage'
import { useToast } from '../state/ToastContext'

const PAID_STATUSES = new Set<OrderStatus>([
  'pending_shipment',
  'pending_receipt',
  'pending_review',
  'completed',
  'refunding',
  'refunded',
])

const POLL_INTERVAL_MS = 3000

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

function isPaidStatus(status: OrderStatus) {
  return PAID_STATUSES.has(status)
}

export function PaymentPage() {
  const { orderId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [payResult, setPayResult] = useState<PayOrderResult | null>(null)
  const [creatingQr, setCreatingQr] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [mockPaying, setMockPaying] = useState(false)
  const initiatingRef = useRef(false)
  const redirectedRef = useRef(false)
  const returnSyncedRef = useRef(false)

  const goToPaidOrder = useCallback(
    (message = '支付成功') => {
      if (redirectedRef.current) return
      redirectedRef.current = true
      toast(message)
      navigate(`/orders/${orderId}`, { replace: true })
    },
    [navigate, orderId, toast],
  )

  const load = useCallback(async () => {
    try {
      const latest = await orderApi.detail(orderId)
      setOrder(latest)
      return latest
    } catch (err) {
      toast(err instanceof Error ? err.message : '订单加载失败', 'error')
      return null
    } finally {
      setLoading(false)
    }
  }, [orderId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const remaining = useCountdown(order?.paymentExpireAt)
  const expirePassed = order?.paymentExpireAt
    ? new Date(order.paymentExpireAt).getTime() <= Date.now()
    : false
  const expired = order?.status === 'pending_payment' && expirePassed
  const canPay = order?.status === 'pending_payment' && !expired

  const createAlipay = useCallback(async (tradeType: 'qr' | 'wap') => {
    if (!orderId || initiatingRef.current) return
    initiatingRef.current = true
    setCreatingQr(true)
    setPayResult(null)
    try {
      const result = await orderApi.pay(orderId, { paymentMethod: 'alipay', tradeType })
      setPayResult(result)
      if (isPaidStatus(result.status)) {
        goToPaidOrder()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '发起支付宝支付失败', 'error')
    } finally {
      initiatingRef.current = false
      setCreatingQr(false)
    }
  }, [goToPaidOrder, orderId, toast])

  const checkoutReady = Boolean(payResult?.qrCode || payResult?.payUrl)

  useEffect(() => {
    if (!canPay || searchParams.get('alipayReturn') !== '1' || returnSyncedRef.current) return
    returnSyncedRef.current = true
    void syncPaid(true)
  }, [canPay, searchParams])

  useEffect(() => {
    if (!canPay || !checkoutReady) return
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const latest = await orderApi.detail(orderId)
          setOrder(latest)
          if (isPaidStatus(latest.status)) {
            goToPaidOrder()
          } else if (latest.status === 'cancelled') {
            setPayResult(null)
          }
        } catch {
          /* 轮询失败时保留当前二维码，由用户手动查单 */
        }
      })()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [canPay, checkoutReady, goToPaidOrder, orderId])

  useEffect(() => {
    if (expired) {
      void orderApi.detail(orderId).then(setOrder).catch(() => undefined)
    }
  }, [expired, orderId])

  const syncPaid = async (silent = false) => {
    setSyncing(true)
    try {
      const result = await orderApi.syncPayment(orderId)
      setPayResult((current) => ({
        ...result,
        qrCode: result.qrCode || current?.qrCode,
        payUrl: result.payUrl || current?.payUrl,
      }))
      if (isPaidStatus(result.status) || result.paidAt) {
        goToPaidOrder()
        return
      }
      const latest = await orderApi.detail(orderId)
      setOrder(latest)
      if (isPaidStatus(latest.status)) {
        goToPaidOrder()
        return
      }
      if (!silent) {
        toast(payResult?.payUrl ? '尚未查询到付款，请在收银台完成支付后再试' : '尚未查询到付款，请扫码完成支付后再试', 'error')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '查单失败', 'error')
      void load()
    } finally {
      setSyncing(false)
    }
  }

  const payByMock = async () => {
    setMockPaying(true)
    try {
      await orderApi.pay(orderId, { paymentMethod: 'mock' })
      goToPaidOrder()
    } catch (err) {
      toast(err instanceof Error ? err.message : '模拟支付失败', 'error')
      void load()
    } finally {
      setMockPaying(false)
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>
  if (!order) return <div className="page"><EmptyState title="订单不存在" /></div>

  const paid = isPaidStatus(order.status)
  const cancelled = order.status === 'cancelled'
  const qrCode = payResult?.qrCode
  const payUrl = payResult?.payUrl

  let statusClass = ''
  let statusIcon = <CreditCard size={34} />
  let statusTitle = `待支付 ${formatPrice(order.total)}`
  let statusDesc = payUrl
    ? '打开手机网站收银台，使用沙箱买家账号登录并付款'
    : qrCode
      ? '请使用支付宝扫一扫，完成付款'
      : '请选择当面扫码或手机网站支付'

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

        {canPay && (
          <div className="payment-qr">
            {creatingQr && !qrCode && !payUrl ? (
              <p className="payment-qr-hint">正在创建支付宝订单…</p>
            ) : qrCode ? (
              <>
                <QrCodeImage value={qrCode} />
                <p className="payment-qr-hint">打开支付宝扫一扫</p>
                <p className="payment-qr-amount">{formatPrice(order.total)}</p>
              </>
            ) : payUrl ? (
              <>
                <p className="payment-qr-hint">沙箱环境请在收银台使用买家账号付款，不要用日常支付宝扫码。</p>
                <p className="payment-qr-amount">{formatPrice(order.total)}</p>
                <a className="button primary" href={payUrl}>
                  前往支付宝收银台
                </a>
              </>
            ) : (
              <div className="payment-actions">
                <button type="button" className="button primary" onClick={() => void createAlipay('qr')} disabled={creatingQr}>
                  当面扫码支付
                </button>
                <button type="button" className="button secondary" onClick={() => void createAlipay('wap')} disabled={creatingQr}>
                  手机网站支付
                </button>
              </div>
            )}
          </div>
        )}

        <div className="payment-actions">
          {canPay ? (
            <>
              <button
                type="button"
                className="button primary"
                onClick={() => void syncPaid()}
                disabled={syncing || creatingQr || (!qrCode && !payUrl)}
              >
                {syncing ? '查询中...' : '我已完成支付'}
              </button>
              {qrCode && (
                <button type="button" className="button secondary" onClick={() => void createAlipay('wap')} disabled={creatingQr}>
                  改用手机网站支付
                </button>
              )}
              {payUrl && (
                <button type="button" className="button secondary" onClick={() => void createAlipay('qr')} disabled={creatingQr}>
                  改用当面扫码
                </button>
              )}
              {import.meta.env.DEV && (
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => void payByMock()}
                  disabled={mockPaying}
                >
                  {mockPaying ? '支付中...' : '模拟支付（仅开发）'}
                </button>
              )}
            </>
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
