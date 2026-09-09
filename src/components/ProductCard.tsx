import { Link } from 'react-router-dom'
import { ShoppingCart, Star } from 'lucide-react'
import type { Product } from '../types'
import { formatPriceParts } from '../lib/format'
import { productImage } from '../lib/visuals'
import { useCart } from '../state/CartContext'
import { useToast } from '../state/ToastContext'

const PRIORITY_TAGS = ['新品', '热卖', '限时', '精选', '特惠']

function pickTags(tags: string[]) {
  const preferred = tags.filter((tag) => PRIORITY_TAGS.includes(tag))
  const rest = tags.filter((tag) => !PRIORITY_TAGS.includes(tag))
  return [...preferred, ...rest].slice(0, 2)
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart()
  const { toast } = useToast()
  const { int, dec } = formatPriceParts(product.price)
  const hasDiscount = product.originalPrice > product.price

  const quickAdd = async () => {
    try {
      await addToCart(product.id, 1)
      toast('已加入购物车')
    } catch (error) {
      toast(error instanceof Error ? error.message : '加入购物车失败', 'error')
    }
  }

  return (
    <article className="product-card">
      <Link to={`/product/${product.id}`} className="product-media" aria-label={product.name}>
        <img src={productImage(product)} alt={product.name} loading="lazy" />
        {hasDiscount && (
          <span className="discount-flag">
            {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
          </span>
        )}
      </Link>

      <div className="product-body">
        <div className="product-tags">
          {pickTags(product.tags).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <Link to={`/product/${product.id}`} className="product-name" title={product.name}>
          {product.name}
        </Link>
        {product.subtitle && <p className="product-subtitle">{product.subtitle}</p>}
        <div className="product-meta">
          <span className="product-price">
            <span className="symbol">¥</span>
            <span className="int">{int}</span>
            <span className="dec">.{dec}</span>
            {hasDiscount && <del>{formatPriceParts(product.originalPrice).int}</del>}
          </span>
          <span className="product-rating">
            {typeof product.rating === 'number' && product.rating > 0 && (
              <>
                <Star size={13} fill="currentColor" />
                <span>{product.rating.toFixed(1)}</span>
              </>
            )}
            <span>已售 {product.sales}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        className="quick-add"
        onClick={quickAdd}
        aria-label={`加入购物车：${product.name}`}
      >
        <ShoppingCart size={17} />
      </button>
    </article>
  )
}
