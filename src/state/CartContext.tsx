import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cartApi, getToken, readGuestCart, saveGuestCart } from '../lib/api'

interface CartValue {
  count: number
  refreshCount: () => Promise<void>
  addToCart: (productId: string, quantity?: number) => Promise<void>
}

const CartContext = createContext<CartValue | null>(null)

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used within CartProvider')
  return value
}

function guestCount() {
  return readGuestCart().reduce((total, item) => total + item.quantity, 0)
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)

  const refreshCount = useCallback(async () => {
    if (!getToken()) {
      setCount(guestCount())
      return
    }
    try {
      const cart = await cartApi.get()
      setCount(cart.items.reduce((total, item) => total + item.quantity, 0))
    } catch {
      setCount(0)
    }
  }, [])

  useEffect(() => {
    void refreshCount()
    const handleAuth = () => void refreshCount()
    const handleGuest = () => {
      if (!getToken()) setCount(guestCount())
    }
    window.addEventListener('orange_market_auth_updated', handleAuth)
    window.addEventListener('orange_market_guest_cart_updated', handleGuest)
    return () => {
      window.removeEventListener('orange_market_auth_updated', handleAuth)
      window.removeEventListener('orange_market_guest_cart_updated', handleGuest)
    }
  }, [refreshCount])

  const addToCart = useCallback(
    async (productId: string, quantity = 1) => {
      if (getToken()) {
        await cartApi.addItem({ productId, quantity })
        await refreshCount()
        return
      }
      const items = readGuestCart()
      const existing = items.find((item) => item.productId === productId)
      if (existing) {
        existing.quantity += quantity
      } else {
        items.push({ productId, quantity, selected: true })
      }
      saveGuestCart(items)
      setCount(guestCount())
    },
    [refreshCount],
  )

  const value = useMemo(
    () => ({ count, refreshCount, addToCart }),
    [count, refreshCount, addToCart],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
