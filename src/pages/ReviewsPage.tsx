import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, MessageSquareText } from 'lucide-react'
import type { PendingReviewItem } from '../types'
import { orderApi } from '../lib/api'
import { formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { ReviewStars } from '../components/ReviewStars'
import { useToast } from '../state/ToastContext'

interface Draft {
  rating: number
  content: string
  anonymous: boolean
}

function defaultDraft(): Draft {
  return { rating: 5, content: '', anonymous: false }
}

export function ReviewsPage() {
  const [items, setItems] = useState<PendingReviewItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState('')
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const data = await orderApi.pendingReviews()
      setItems(data)
      setDrafts((prev) => {
        const next = { ...prev }
        for (const item of data) {
          if (!next[item.orderItemId]) next[item.orderItemId] = defaultDraft()
        }
        return next
      })
    } catch (err) {
      toast(err instanceof Error ? err.message : '待评价列表加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, PendingReviewItem[]>()
    for (const item of items) {
      const group = map.get(item.orderId) ?? []
      group.push(item)
      map.set(item.orderId, group)
    }
    return Array.from(map.entries())
  }, [items])

  const updateDraft = (orderItemId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [orderItemId]: { ...prev[orderItemId], ...patch } }))
  }

  const submitGroup = async (orderId: string, groupItems: PendingReviewItem[]) => {
    const reviews = groupItems.map((item) => {
      const draft = drafts[item.orderItemId]
      return {
        orderItemId: item.orderItemId,
        productId: item.productId,
        rating: draft.rating,
        content: draft.content.trim(),
        anonymous: draft.anonymous,
      }
    })
    if (reviews.some((review) => !review.content)) {
      toast('请填写评价内容', 'error')
      return
    }
    setSubmitting(orderId)
    try {
      await orderApi.submitReviews(orderId, { reviews })
      toast('评价提交成功')
      const submittedIds = new Set(groupItems.map((item) => item.orderItemId))
      setItems((prev) => prev.filter((item) => !submittedIds.has(item.orderItemId)))
    } catch (err) {
      toast(err instanceof Error ? err.message : '提交失败', 'error')
    } finally {
      setSubmitting('')
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>

  return (
    <div className="page reviews-page">
      <div className="page-heading">
        <div>
          <h1>待评价</h1>
          <p>{items.length ? `${items.length} 件商品等待评价` : '没有待评价的商品'}</p>
        </div>
        <Link to="/orders" className="icon-text-button">
          <CheckSquare size={17} />
          返回订单
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState title="全部商品都已经评价过了" icon={MessageSquareText} />
      ) : (
        <div className="review-workbench">
          {groups.map(([orderId, groupItems]) => (
            <section className="review-group" key={orderId}>
              <header>
                <div>
                  <strong>{groupItems[0].orderNo}</strong>
                  <span>{groupItems.length} 件商品</span>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => submitGroup(orderId, groupItems)}
                  disabled={submitting === orderId}
                >
                  {submitting === orderId ? '提交中...' : '提交本单评价'}
                </button>
              </header>

              <div className="review-forms">
                {groupItems.map((item) => {
                  const draft = drafts[item.orderItemId] ?? defaultDraft()
                  return (
                    <article className="review-form" key={item.orderItemId}>
                      <div className="review-form-head">
                        <img src={item.productImage || productImage({ id: item.productId, name: item.productName })} alt={item.productName} />
                        <div>
                          <strong>{item.productName}</strong>
                          <span>{formatPrice(item.unitPrice)} × {item.quantity}</span>
                        </div>
                      </div>
                      <div className="review-form-field">
                        <span>评分</span>
                        <ReviewStars value={draft.rating} onChange={(rating) => updateDraft(item.orderItemId, { rating })} />
                      </div>
                      <textarea
                        value={draft.content}
                        onChange={(event) => updateDraft(item.orderItemId, { content: event.target.value })}
                        placeholder="分享使用感受"
                        rows={3}
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={draft.anonymous}
                          onChange={(event) => updateDraft(item.orderItemId, { anonymous: event.target.checked })}
                        />
                        匿名评价
                      </label>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
