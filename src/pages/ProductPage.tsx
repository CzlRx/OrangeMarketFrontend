import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Heart,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import type { ProductDetail, Review } from '../types'
import { productApi, socialApi } from '../lib/api'
import { formatDateTime, formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { QuantityStepper } from '../components/QuantityStepper'
import { ReviewStars } from '../components/ReviewStars'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../state/AuthContext'
import { useCart } from '../state/CartContext'
import { useToast } from '../state/ToastContext'

type ReviewFilter = 'all' | 'good' | 'medium' | 'bad'

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'good', label: '好评' },
  { value: 'medium', label: '中评' },
  { value: 'bad', label: '差评' },
]

export function ProductPage() {
  const { productId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToCart } = useCart()
  const { toast } = useToast()

  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    productApi
      .detail(productId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setReviews(data.reviews)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!user || !productId) return
    socialApi
      .favorites({ pageSize: 50 })
      .then((data) => setFavorited(data.list.some((item) => item.productId === productId)))
      .catch(() => setFavorited(false))
    socialApi.recordBrowse({ productId }).catch(() => undefined)
  }, [user, productId])

  useEffect(() => {
    if (detail && imageIndex >= detail.product.images.length) setImageIndex(0)
  }, [detail, imageIndex])

  const product = detail?.product
  const summary = detail?.reviewSummary

  const loadReviews = async (nextFilter: ReviewFilter) => {
    setFilter(nextFilter)
    try {
      const data = await productApi.reviews(productId, { filter: nextFilter, page: 1, pageSize: 10 })
      setReviews(data.list)
    } catch (err) {
      toast(err instanceof Error ? err.message : '评价加载失败', 'error')
    }
  }

  const addToCartAction = async () => {
    try {
      await addToCart(productId, quantity)
      toast('已加入购物车')
    } catch (err) {
      toast(err instanceof Error ? err.message : '加入失败', 'error')
    }
  }

  const buyNow = () => {
    const redirect = `/checkout?productId=${productId}&quantity=${quantity}`
    if (!user) navigate(`/login?redirect=${encodeURIComponent(redirect)}`)
    else navigate(redirect)
  }

  const toggleFavorite = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/product/${productId}`)}`)
      return
    }
    setSubmitting(true)
    try {
      if (favorited) {
        await socialApi.removeFavorite(productId)
        setFavorited(false)
        toast('已取消收藏')
      } else {
        await socialApi.addFavorite({ productId })
        setFavorited(true)
        toast('已收藏')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const reviewCounts = useMemo(
    () => [
      { filter: 'all' as const, count: summary?.allCount ?? 0 },
      { filter: 'good' as const, count: summary?.goodCount ?? 0 },
      { filter: 'medium' as const, count: summary?.mediumCount ?? 0 },
      { filter: 'bad' as const, count: summary?.badCount ?? 0 },
    ],
    [summary],
  )

  if (loading) return <div className="page"><LoadingState /></div>
  if (error || !detail || !product) {
    return (
      <div className="page">
        <EmptyState title="商品加载失败" description={error || '商品不存在或已下架'} />
      </div>
    )
  }

  return (
    <div className="page product-page">
      <section className="product-layout">
        <div className="product-gallery">
          <div className="gallery-main">
            <img src={productImage(product, imageIndex)} alt={product.name} />
          </div>
          {product.images.length > 1 && (
            <div className="gallery-thumbs">
              {product.images.map((image, index) => (
                <button
                  type="button"
                  key={image}
                  className={index === imageIndex ? 'active' : ''}
                  onClick={() => setImageIndex(index)}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <div className="product-tags">
            {product.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <h1>{product.name}</h1>
          {product.subtitle && <p className="product-subtitle">{product.subtitle}</p>}
          <div className="rating-line">
            <ReviewStars value={product.rating ?? 0} />
            <span>{product.rating?.toFixed(1)} 分</span>
            <span>已售 {product.sales}</span>
            <span>{product.reviewCount} 条评价</span>
          </div>
          <div className="price-panel">
            <strong>{formatPrice(product.price)}</strong>
            {product.originalPrice > product.price && (
              <del>{formatPrice(product.originalPrice)}</del>
            )}
            <span>运费 {product.shippingFee === 0 ? '包邮' : formatPrice(product.shippingFee)}</span>
          </div>
          <p className="stock-line">库存 {product.stock} 件</p>

          <div className="purchase-row">
            <span>数量</span>
            <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, product.stock)} />
          </div>

          <div className="purchase-actions">
            <button type="button" className="button primary" onClick={buyNow}>
              立即购买
            </button>
            <button type="button" className="button accent" onClick={addToCartAction}>
              <ShoppingCart size={17} />
              加入购物车
            </button>
            <button
              type="button"
              className={`icon-button favorite-button${favorited ? ' active' : ''}`}
              onClick={toggleFavorite}
              disabled={submitting}
              aria-label={favorited ? '取消收藏' : '收藏'}
              title={favorited ? '取消收藏' : '收藏'}
            >
              <Heart size={20} fill={favorited ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="service-row">
            <span>
              <Truck size={16} />
              48 小时内发货
            </span>
            <span>
              <ShieldCheck size={16} />
              正品保障
            </span>
            <span>
              <RefreshCw size={16} />
              售后无忧
            </span>
          </div>
        </div>
      </section>

      {product.description && (
        <section className="section-block product-description">
          <h2>商品详情</h2>
          <p>{product.description}</p>
        </section>
      )}

      <section className="section-block review-section">
        <div className="section-heading">
          <div>
            <h2>用户评价</h2>
            <p>共 {summary?.reviewCount ?? 0} 条评价</p>
          </div>
          <div className="segmented">
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.value}
                className={filter === item.value ? 'active' : ''}
                onClick={() => loadReviews(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {summary && (
          <div className="review-summary">
            <div className="summary-score">
              <strong>{summary.average.toFixed(1)}</strong>
              <ReviewStars value={Math.round(summary.average)} />
              <span>好评率 {(summary.goodRate * 100).toFixed(0)}%</span>
            </div>
            <div className="summary-bars">
              {reviewCounts.map((item) => (
                <div className="summary-bar" key={item.filter}>
                  <span>{FILTERS.find((f) => f.value === item.filter)?.label}</span>
                  <div>
                    <i
                      style={{
                        width: `${summary.allCount ? (item.count / summary.allCount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <b>{item.count}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="review-list">
          {reviews.map((review) => (
            <article className="review-item" key={review.id}>
              <div className="review-head">
                <div className="review-avatar">
                  {review.avatar ? <img src={review.avatar} alt="" /> : review.userName.slice(0, 1)}
                </div>
                <div>
                  <strong>{review.userName}</strong>
                  <div className="review-meta">
                    <ReviewStars value={review.rating} />
                    <time>{formatDateTime(review.createdAt)}</time>
                  </div>
                </div>
              </div>
              <p>{review.content}</p>
            </article>
          ))}
          {reviews.length === 0 && <EmptyState title="暂无评价" />}
        </div>
      </section>
    </div>
  )
}
