import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ReceiptText } from 'lucide-react'
import type { Order, OrderStatus } from '../types'
import { orderApi } from '../lib/api'
import { formatDateTime, formatPrice, ORDER_STATUS_TABS } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../state/ToastContext'

export function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyId, setBusyId] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  const load = useCallback(
    async (nextStatus: OrderStatus | '' = status, nextPage = 1) => {
      setLoading(nextPage === 1)
      try {
        const data = await orderApi.list({
          status: nextStatus,
          page: nextPage,
          pageSize: 10,
        })
        setOrders((prev) => (nextPage === 1 ? data.list : [...prev, ...data.list]))
        setPage(data.page)
        setHasMore(data.hasMore)
      } catch (err) {
        toast(err instanceof Error ? err.message : '订单加载失败', 'error')
      } finally {
        setLoading(false)
      }
    },
    [status, toast],
  )

  useEffect(() => {
    void load()
  }, [status, load])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    await load(status, page + 1)
    setLoadingMore(false)
  }

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm('确认取消该订单？')) return
    setBusyId(orderId)
    try {
      await orderApi.cancel(orderId)
      toast('订单已取消')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '取消失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const receiveOrder = async (orderId: string) => {
    if (!window.confirm('确认已收到商品？')) return
    setBusyId(orderId)
    try {
      await orderApi.receive(orderId)
      toast('确认收货成功')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="page orders-page">
      <div className="page-heading">
        <div>
          <h1>我的订单</h1>
          <p>跟踪每一笔购物</p>
        </div>
      </div>

      <div className="tabs-row">
        {ORDER_STATUS_TABS.map((tab) => (
          <button
            type="button"
            key={tab.value}
            className={status === tab.value ? 'active' : ''}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : orders.length === 0 ? (
        <EmptyState
          title="暂无相关订单"
          icon={ReceiptText}
          action={
            <Link to="/catalog" className="button primary">
              去逛逛
            </Link>
          }
        />
      ) : (
        <>
          <div className="order-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <header className="order-card-head">
                  <div>
                    <strong>{order.orderNo}</strong>
                    <time>{formatDateTime(order.createdAt)}</time>
                  </div>
                  <StatusPill status={order.status} />
                </header>
                <div className="order-card-body">
                  <div className="order-card-items">
                    {order.items.slice(0, 4).map((item) => (
                      <Link
                        to={`/product/${item.productId}`}
                        key={item.id || item.productId}
                        className="order-thumb"
                        title={item.productName}
                      >
                        <img src={item.productImage || productImage({ id: item.productId, name: item.productName })} alt={item.productName} />
                      </Link>
                    ))}
                  </div>
                  <div className="order-card-total">
                    <span>共 {order.items.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
                </div>
                <footer className="order-card-foot">
                  <Link to={`/orders/${order.id}`} className="button secondary small">
                    订单详情
                  </Link>
                  {order.status === 'pending_payment' && (
                    <>
                      <button
                        type="button"
                        className="button primary small"
                        onClick={() => navigate(`/payment/${order.id}`)}
                        disabled={busyId === order.id}
                      >
                        去支付
                      </button>
                      <button
                        type="button"
                        className="button ghost small"
                        onClick={() => cancelOrder(order.id)}
                        disabled={busyId === order.id}
                      >
                        取消订单
                      </button>
                    </>
                  )}
                  {order.status === 'pending_receipt' && (
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => receiveOrder(order.id)}
                      disabled={busyId === order.id}
                    >
                      确认收货
                    </button>
                  )}
                  {order.status === 'pending_review' && (
                    <Link to="/reviews" className="button primary small">
                      去评价
                    </Link>
                  )}
                </footer>
              </article>
            ))}
          </div>
          <div className="load-more-row">
            {hasMore ? (
              <button type="button" className="button secondary" onClick={loadMore}>
                {loadingMore ? '加载中...' : '加载更多'}
              </button>
            ) : (
              <span className="end-note">已经到底了</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
