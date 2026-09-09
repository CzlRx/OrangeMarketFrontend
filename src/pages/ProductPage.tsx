import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import type { Product, ProductDetail, Review } from '../types'
import { productApi, socialApi } from '../lib/api'
import { formatDateTime, formatPrice, formatPriceParts } from '../lib/format'
import { productImage } from '../lib/visuals'
import { QuantityStepper } from '../components/QuantityStepper'
import { ReviewStars } from '../components/ReviewStars'
import { DetailSkeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Breadcrumb } from '../components/Breadcrumb'
import { ProductCard } from '../components/ProductCard'
import { useAuth } from '../state/AuthContext'
import { useCart } from '../state/CartContext'
import { useToast } from '../state/ToastContext'
import { useCategories } from '../state/CategoryContext'

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
  const { categories } = useCategories()

  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [zooming, setZooming] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%')
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    productApi
      .detail(productId)
      .then((data) => {
        setDetail(data)
        setReviews(data.reviews)
        setQuantity(1)
        setImageIndex(0)
        const { product } = data
        if (product.categoryId) {
          productApi
            .list({ categoryId: product.categoryId, pageSize: 8 })
            .then((rec) => setRecommendations(rec.list.filter((item) => item.id !== productId).slice(0, 4)))
            .catch(() => setRecommendations([]))
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => setLoading(false))
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

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
  const currentCategory = useMemo(
    () => categories.find((category) => category.id === product?.categoryId),
    [categories, product],
  )

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

  const images = product?.images?.length ? product.images : [productImage(product)]
  const stepImage = (direction: 1 | -1) => {
    setImageIndex((index) => (index + direction + images.length) % images.length)
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

  if (loading) {
    return (
      <div className="page product-page">
        <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '商品详情' }]} />
        <DetailSkeleton />
      </div>
    )
  }

  if (error || !detail || !product) {
    return (
      <div className="page product-page">
        <ErrorState title="商品加载失败" description={error || '商品不存在或已下架'} onRetry={load} />
      </div>
    )
  }

  const { int, dec } = formatPriceParts(product.price)
  const hasDiscount = product.originalPrice > product.price

  const specs: { label: string; value: string }[] = [
    { label: '商品名称', value: product.name },
    { label: '商品编号', value: product.id },
    { label: '商品价格', value: formatPrice(product.price) },
    ...(hasDiscount ? [{ label: '划线价', value: formatPrice(product.originalPrice) }] : []),
    { label: '库存', value: `${product.stock} 件` },
    { label: '销量', value: `${product.sales} 件` },
    { label: '运费', value: product.shippingFee === 0 ? '包邮' : formatPrice(product.shippingFee) },
    ...(typeof product.rating === 'number' ? [{ label: '商品评分', value: `${product.rating.toFixed(1)} 分` }] : []),
  ]

  return (
    <div className="page product-page">
      <Breadcrumb
        items={[
          { label: '首页', to: '/' },
          ...(currentCategory
            ? [{ label: currentCategory.name, to: `/catalog?categoryId=${currentCategory.id}` }]
            : [{ label: '全部商品', to: '/catalog' }]),
          { label: product.name },
        ]}
      />

      <section className="product-layout">
        <div className="product-gallery">
          <div
            className={`gallery-main${zooming ? ' zoomable' : ''}`}
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              const x = ((event.clientX - rect.left) / rect.width) * 100
              const y = ((event.clientY - rect.top) / rect.height) * 100
              setZoomOrigin(`${x}% ${y}%`)
            }}
          >
            <img
              src={images[imageIndex] ?? images[0]}
              alt={product.name}
              style={{ transformOrigin: zoomOrigin }}
            />
            {images.length > 1 && (
              <>
                <button type="button" className="gallery-nav prev" onClick={() => stepImage(-1)} aria-label="上一张">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="gallery-nav next" onClick={() => stepImage(1)} aria-label="下一张">
                  <ChevronRight size={18} />
                </button>
                <span className="gallery-count">
                  {imageIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((image, index) => (
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
          {product.tags.length > 0 && (
            <div className="product-tags">
              {product.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
          <h1>{product.name}</h1>
          {product.subtitle && <p className="product-subtitle">{product.subtitle}</p>}

          <div className="rating-line">
            {typeof product.rating === 'number' && (
              <>
                <ReviewStars value={Math.round(product.rating)} />
                <span>{product.rating.toFixed(1)} 分</span>
                <span className="divider" />
              </>
            )}
            <span>已售 {product.sales} 件</span>
            <span className="divider" />
            <span>{product.reviewCount} 条评价</span>
          </div>

          <div className="price-panel">
            <span className="big-price">
              <span className="symbol">¥</span>
              <span className="int">{int}</span>
              <span className="dec">.{dec}</span>
            </span>
            {hasDiscount && <del>{formatPrice(product.originalPrice)}</del>}
            <span className="ship-note">
              运费 {product.shippingFee === 0 ? '包邮' : formatPrice(product.shippingFee)}
            </span>
          </div>

          <p className="stock-line">
            库存 <b>{product.stock}</b> 件{product.stock <= 0 && ' · 暂时缺货'}
          </p>

          <div className="purchase-row">
            <span>数量</span>
            <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, product.stock)} />
          </div>

          <div className="purchase-actions">
            <button
              type="button"
              className="button primary"
              onClick={buyNow}
              disabled={product.stock <= 0}
            >
              立即购买
            </button>
            <button
              type="button"
              className="button accent"
              onClick={addToCartAction}
              disabled={product.stock <= 0}
            >
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
              <Truck size={15} />
              48 小时内发货
            </span>
            <span>
              <ShieldCheck size={15} />
              正品保障
            </span>
            <span>
              <RefreshCw size={15} />
              七天无理由退换
            </span>
          </div>
        </div>
      </section>

      <section className="detail-panel">
        <div className="section-title">
          <h2>规格参数</h2>
        </div>
        <table className="spec-table">
          <tbody>
            {specs.map((spec) => (
              <tr key={spec.label}>
                <th>{spec.label}</th>
                <td>{spec.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {product.description && (
          <>
            <div className="section-title" style={{ marginTop: 'var(--sp-5)' }}>
              <h2>商品详情</h2>
            </div>
            <p className="product-description">{product.description}</p>
          </>
        )}
      </section>

      <section className="detail-panel">
        <div className="section-title" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2>用户评价</h2>
          <span style={{ color: 'var(--color-ink-3)', fontSize: 'var(--fs-xs)' }}>
            共 {summary?.reviewCount ?? 0} 条
          </span>
          <div className="segmented" style={{ marginLeft: 'auto' }}>
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
              <strong>
                {summary.average.toFixed(1)}
                <i> 分</i>
              </strong>
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
          {reviews.length === 0 && <EmptyState title="暂无评价" description="购买后快来分享使用感受吧" />}
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <h2>相关推荐</h2>
              <p className="sub">看了又看</p>
            </div>
          </div>
          <div className="product-grid">
            {recommendations.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
