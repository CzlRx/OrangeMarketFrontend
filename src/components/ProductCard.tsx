import { Link } from 'react-router-dom'
import { ShoppingCart, Star } from 'lucide-react'
import type { Product } from '../types'
import { formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { useCart } from '../state/CartContext'
import { useToast } from '../state/ToastContext'

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart()
  const { toast } = useToast()

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
      <Link to={`/product/${product.id}`} className="product-media">
        <img src={productImage(product)} alt={product.name} loading="lazy" />
        {product.originalPrice > product.price && (
          <span className="discount-flag">
            {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
          </span>
        )}
      </Link>
      <div className="product-body">
        <div className="product-tags">
          {product.tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <Link to={`/product/${product.id}`} className="product-name">
          {product.name}
        </Link>
        {product.subtitle && <p className="product-subtitle">{product.subtitle}</p>}
        <div className="product-meta">
          <div className="product-price">
            <strong>{formatPrice(product.price)}</strong>
            {product.originalPrice > product.price && (
              <del>{formatPrice(product.originalPrice)}</del>
            )}
          </div>
          <div className="product-rating">
            {typeof product.rating === 'number' && (
              <>
                <Star size={14} fill="currentColor" />
                <span>{product.rating.toFixed(1)}</span>
              </>
            )}
            <span>已售 {product.sales}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="quick-add"
        onClick={quickAdd}
        aria-label={`加入购物车：${product.name}`}
      >
        <ShoppingCart size={18} />
      </button>
    </article>
  )
}
