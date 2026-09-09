import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import type { FavoriteItem } from '../types'
import { socialApi } from '../lib/api'
import { formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { Breadcrumb } from '../components/Breadcrumb'
import { useToast } from '../state/ToastContext'

export function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const data = await socialApi.favorites({ pageSize: 50 })
      setItems(data.list)
    } catch (err) {
      toast(err instanceof Error ? err.message : '收藏加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (productId: string) => {
    setBusyId(productId)
    try {
      await socialApi.removeFavorite(productId)
      setItems((prev) => prev.filter((item) => item.productId !== productId))
      toast('已取消收藏')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>

  return (
    <div className="page favorites-page">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '我的收藏' }]} />

      <div className="page-heading">
        <div>
          <h1>我的收藏</h1>
          <p>{items.length} 件收藏商品</p>
        </div>
        <Link to="/catalog" className="button secondary">
          继续逛逛
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="还没有收藏"
          description="心仪的商品可以收藏起来"
          icon={Heart}
          action={
            <Link to="/catalog" className="button primary">
              去逛逛
            </Link>
          }
        />
      ) : (
        <div className="favorite-list">
          {items.map((item) => (
            <article className="favorite-row" key={item.id}>
              {item.product ? (
                <>
                  <Link to={`/product/${item.product.id}`} className="favorite-thumb">
                    <img src={productImage(item.product)} alt={item.product.name} />
                  </Link>
                  <div className="favorite-info">
                    <Link to={`/product/${item.product.id}`}>{item.product.name}</Link>
                    {item.product.subtitle && <p>{item.product.subtitle}</p>}
                    <strong>{formatPrice(item.product.price)}</strong>
                  </div>
                </>
              ) : (
                <div className="favorite-info">
                  <p>该商品已下架</p>
                </div>
              )}
              <button
                type="button"
                className="icon-button danger"
                onClick={() => remove(item.productId)}
                disabled={busyId === item.productId}
                aria-label="取消收藏"
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
