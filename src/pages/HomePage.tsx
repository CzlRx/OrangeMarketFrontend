import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Headset,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import type { Product } from '../types'
import { productApi } from '../lib/api'
import { BANNER_SLIDES } from '../lib/visuals'
import { categoryIcon } from '../lib/categoryIcons'
import { useCategories } from '../state/CategoryContext'
import { ProductCard } from '../components/ProductCard'
import { ProductSkeletonGrid } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'

const SERVICE_ITEMS = [
  { icon: ShieldCheck, label: '正品保障' },
  { icon: Truck, label: '极速发货' },
  { icon: RotateCcw, label: '七天退换' },
  { icon: Headset, label: '售后无忧' },
]

function ProductSection({
  title,
  sub,
  products,
  loading,
  error,
  onRetry,
  to = '/catalog',
  moreLabel = '查看更多',
}: {
  title: string
  sub?: string
  products: Product[]
  loading: boolean
  error: string
  onRetry: () => void
  to?: string
  moreLabel?: string
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        <Link to={to} className="section-more">
          {moreLabel}
          <ArrowRight size={15} />
        </Link>
      </div>
      {loading ? (
        <ProductSkeletonGrid count={4} />
      ) : error ? (
        <ErrorState description={error} onRetry={onRetry} />
      ) : products.length ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无相关商品" />
      )}
    </section>
  )
}

function Banner() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (BANNER_SLIDES.length <= 1) return
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % BANNER_SLIDES.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="home-banner" aria-label="推荐活动">
      <div className="banner-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {BANNER_SLIDES.map((slide) => (
          <div className="banner-slide" key={slide.title}>
            <img src={slide.image} alt={slide.title} />
            <div className="banner-overlay" />
            <div className="banner-content">
              <span className="banner-eyebrow">{slide.eyebrow}</span>
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              <Link to={slide.to} className="banner-cta">
                立即选购
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ))}
      </div>
      {BANNER_SLIDES.length > 1 && (
        <div className="banner-dots">
          {BANNER_SLIDES.map((slide, index) => (
            <button
              type="button"
              key={slide.title}
              className={index === active ? 'active' : ''}
              onClick={() => setActive(index)}
              aria-label={`切换到第 ${index + 1} 张 banner`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function HomePage() {
  const { categories, loaded: categoriesLoaded } = useCategories()
  const [hotProducts, setHotProducts] = useState<Product[]>([])
  const [latestProducts, setLatestProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      productApi.list({ page: 1, pageSize: 12, sort: 'sales_desc' }),
      productApi.list({ page: 1, pageSize: 12, sort: 'default' }),
    ])
      .then(([hot, latest]) => {
        setHotProducts(hot.list)
        setLatestProducts(latest.list)
        setError('')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const promoProducts = useMemo(
    () => hotProducts.filter((product) => product.originalPrice > product.price).slice(0, 4),
    [hotProducts],
  )

  const newProducts = useMemo(() => {
    const tagged = latestProducts.filter((product) => product.tags.includes('新品'))
    return (tagged.length >= 4 ? tagged : latestProducts).slice(0, 4)
  }, [latestProducts])

  const featuredProducts = useMemo(
    () =>
      [...hotProducts]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 8),
    [hotProducts],
  )

  return (
    <div className="page home-page">
      <Banner />

      <section className="service-strip" aria-label="服务保障">
        {SERVICE_ITEMS.map((item) => (
          <span className="service-strip-item" key={item.label}>
            <item.icon size={24} />
            <b>{item.label}</b>
          </span>
        ))}
      </section>

      <section className="section-block" aria-label="商品分类">
        <div className="section-heading">
          <div>
            <h2>商品分类</h2>
            <p className="sub">按兴趣快速发现好物</p>
          </div>
          <Link to="/catalog" className="section-more">
            全部分类
            <ArrowRight size={15} />
          </Link>
        </div>
        {categories.length > 0 ? (
          <div className="category-grid">
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon)
              return (
                <Link
                  key={category.id}
                  to={`/catalog?categoryId=${category.id}`}
                  className="category-tile"
                >
                  <span className="category-icon" style={{ backgroundColor: category.color || '#f5f5f5' }}>
                    <Icon size={22} />
                  </span>
                  <strong>{category.name}</strong>
                </Link>
              )
            })}
          </div>
        ) : categoriesLoaded ? (
          <EmptyState title="暂无分类" />
        ) : (
          <div className="category-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div className="skeleton" key={i} style={{ height: 110, borderRadius: 'var(--r-lg)' }} />
            ))}
          </div>
        )}
      </section>

      {!loading && !error && promoProducts.length >= 4 && (
        <section className="promo-banner" aria-label="限时特惠">
          <div className="promo-card primary">
            <span className="promo-eyebrow">LIMITED OFFER</span>
            <h3>限时特惠</h3>
            <p>爆款直降，好价不等人</p>
            <Link to="/catalog?sort=price_asc" className="promo-cta">
              去抢购
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="promo-card dark">
            <span className="promo-eyebrow">HOT SALE</span>
            <h3>热卖榜单</h3>
            <p>大家都在买的人气好物</p>
            <Link to="/catalog?sort=sales_desc" className="promo-cta">
              查看榜单
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="promo-card warm">
            <span className="promo-eyebrow">NEW IN</span>
            <h3>新品首发</h3>
            <p>每周上新，抢先体验</p>
            <Link to="/catalog" className="promo-cta">
              去看看
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}

      <ProductSection
        title="限时特惠"
        sub="超值好价，售完即止"
        products={promoProducts}
        loading={loading}
        error={error}
        onRetry={load}
        to="/catalog?sort=price_asc"
      />

      <ProductSection
        title="热卖商品"
        sub="人气爆款，值得信赖"
        products={hotProducts.slice(0, 4)}
        loading={loading}
        error={error}
        onRetry={load}
        to="/catalog?sort=sales_desc"
      />

      <ProductSection
        title="新品推荐"
        sub="每周上新，抢先体验"
        products={newProducts}
        loading={loading}
        error={error}
        onRetry={load}
      />

      <ProductSection
        title="精选好物"
        sub="高分口碑之选"
        products={featuredProducts}
        loading={loading}
        error={error}
        onRetry={load}
      />
    </div>
  )
}
