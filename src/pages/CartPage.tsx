import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckSquare, ShoppingBag, Square, Trash2 } from 'lucide-react'
import type { Cart } from '../types'
import { cartApi } from '../lib/api'
import { formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { QuantityStepper } from '../components/QuantityStepper'
import { useCart } from '../state/CartContext'
import { useToast } from '../state/ToastContext'

export function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const navigate = useNavigate()
  const { refreshCount } = useCart()
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setCart(await cartApi.get())
    } catch (err) {
      toast(err instanceof Error ? err.message : '购物车加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const updateItem = async (cartItemId: string, patch: { quantity?: number; selected?: boolean }) => {
    setBusyId(cartItemId)
    try {
      await cartApi.updateItem(cartItemId, patch)
      await load()
      await refreshCount()
    } catch (err) {
      toast(err instanceof Error ? err.message : '更新失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const removeItem = async (cartItemId: string) => {
    setBusyId(cartItemId)
    try {
      await cartApi.deleteItem(cartItemId)
      await load()
      await refreshCount()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const setSelection = async (selected: boolean) => {
    setBusyId('selection')
    try {
      await cartApi.setSelection({ selected })
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const deleteSelected = async () => {
    setBusyId('selected')
    try {
      await cartApi.deleteSelected()
      await load()
      await refreshCount()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const allSelected = cart?.items.length ? cart.items.every((item) => item.selected) : false
  const checkout = () => {
    const ids = cart?.items.filter((item) => item.selected && item.product).map((item) => item.id)
    if (!ids?.length) {
      toast('请先选择要结算的商品', 'error')
      return
    }
    navigate(`/checkout?ids=${encodeURIComponent(ids.join(','))}`)
  }

  if (loading) return <div className="page"><LoadingState /></div>

  return (
    <div className="page cart-page">
      <div className="page-heading">
        <div>
          <h1>购物车</h1>
          <p>{cart?.items.length ? `${cart.items.length} 种商品` : '还没有商品'}</p>
        </div>
        {cart && cart.items.length > 0 && (
          <button
            type="button"
            className="icon-text-button"
            onClick={() => setSelection(!allSelected)}
            disabled={busyId === 'selection'}
          >
            {allSelected ? <CheckSquare size={17} /> : <Square size={17} />}
            {allSelected ? '取消全选' : '全选'}
          </button>
        )}
      </div>

      {!cart || cart.items.length === 0 ? (
        <EmptyState
          title="购物车还是空的"
          description="去挑选一些喜欢的商品吧"
          icon={ShoppingBag}
          action={
            <Link to="/catalog" className="button primary">
              去逛逛
            </Link>
          }
        />
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map((item) => {
              const product = item.product
              return (
                <article className="cart-item" key={item.id}>
                  <button
                    type="button"
                    className={`check-button${item.selected ? ' checked' : ''}`}
                    onClick={() => updateItem(item.id, { selected: !item.selected })}
                    disabled={busyId === item.id}
                    aria-label={item.selected ? '取消选择' : '选择'}
                  >
                    {item.selected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                  {product && (
                    <Link to={`/product/${product.id}`} className="cart-thumb">
                      <img src={productImage(product)} alt={product.name} />
                    </Link>
                  )}
                  <div className="cart-item-info">
                    {product ? (
                      <>
                        <Link to={`/product/${product.id}`} className="cart-item-name">
                          {product.name}
                        </Link>
                        <span className="cart-item-tags">
                          {product.tags.slice(0, 2).map((tag) => (
                            <i key={tag}>{tag}</i>
                          ))}
                        </span>
                        <div className="cart-item-price">
                          <strong>{formatPrice(item.effectivePrice ?? product.price)}</strong>
                          <span>运费 {item.shippingFee === 0 ? '包邮' : formatPrice(item.shippingFee ?? product.shippingFee)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="cart-item-offline">
                        <p>该商品已下架</p>
                        <span>请删除后重新选购</span>
                      </div>
                    )}
                  </div>
                  <div className="cart-item-controls">
                    {product && (
                      <QuantityStepper
                        value={item.quantity}
                        onChange={(quantity) => updateItem(item.id, { quantity })}
                        max={Math.max(1, product.stock)}
                        disabled={busyId === item.id}
                      />
                    )}
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => removeItem(item.id)}
                      disabled={busyId === item.id}
                      aria-label="删除"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              )
            })}

            <div className="cart-batch-actions">
              <button type="button" className="icon-text-button" onClick={deleteSelected} disabled={busyId === 'selected'}>
                <Trash2 size={16} />
                删除选中商品
              </button>
            </div>
          </div>

          <aside className="cart-summary">
            <h2>结算明细</h2>
            <div className="summary-line">
              <span>已选商品</span>
              <b>{cart.selectedCount} 种</b>
            </div>
            <div className="summary-line">
              <span>商品小计</span>
              <b>{formatPrice(cart.subtotal)}</b>
            </div>
            <div className="summary-line">
              <span>运费</span>
              <b>{cart.shippingFee === 0 ? '包邮' : formatPrice(cart.shippingFee)}</b>
            </div>
            <div className="summary-total">
              <span>应付</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <button
              type="button"
              className="button primary checkout-button"
              onClick={checkout}
              disabled={cart.selectedCount === 0}
            >
              去结算
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
