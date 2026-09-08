import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Camera,
  Gamepad2,
  Headphones,
  Home as HomeIcon,
  Laptop,
  Package,
  Shirt,
  Smartphone,
  Speaker,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import type { Category, Product } from '../types'
import { categoryApi, productApi } from '../lib/api'
import { HERO_IMAGE } from '../lib/visuals'
import { ProductCard } from '../components/ProductCard'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Laptop,
  Smartphone,
  Headphones,
  Watch,
  Speaker,
  Camera,
  Gamepad2,
  Shirt,
  Home: HomeIcon,
}

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([categoryApi.list(), productApi.list({ page: 1, pageSize: 12 })])
      .then(([categoryData, productData]) => {
        if (cancelled) return
        setCategories(categoryData)
        setProducts(productData.list)
        setError('')
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
  }, [])

  return (
    <div className="page home-page">
      <section className="home-hero">
        <img src={HERO_IMAGE} alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-eyebrow">FRESH DIGITAL MARKET</p>
          <h1>橙子市集</h1>
          <p>新潮数码与生活好物，即买即享。</p>
          <Link to="/catalog" className="hero-cta">
            去逛逛
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="section-block category-strip" aria-label="商品分类">
        <div className="section-heading">
          <div>
            <h2>分类</h2>
            <p>按兴趣快速发现商品</p>
          </div>
          <Link to="/catalog">
            全部
            <ArrowRight size={16} />
          </Link>
        </div>
        {categories.length > 0 && (
          <div className="category-grid">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.icon] ?? Package
              return (
                <Link
                  key={category.id}
                  to={`/catalog?categoryId=${category.id}`}
                  className="category-tile"
                >
                  <span className="category-icon" style={{ backgroundColor: category.color || '#fff3e6' }}>
                    <Icon size={22} />
                  </span>
                  <strong>{category.name}</strong>
                  <span>{category.eyebrow}</span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>热卖精选</h2>
            <p>当前在售商品</p>
          </div>
          <Link to="/catalog">
            查看更多
            <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState title="加载失败" description={error} />
        ) : products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState title="暂时没有在售商品" />
        )}
      </section>
    </div>
  )
}
