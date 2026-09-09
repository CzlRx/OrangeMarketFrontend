import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Category } from '../types'
import { categoryApi } from '../lib/api'

interface CategoryValue {
  categories: Category[]
  loaded: boolean
}

const CategoryContext = createContext<CategoryValue | null>(null)

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    categoryApi
      .list()
      .then((data) => {
        if (!cancelled) setCategories(data)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <CategoryContext.Provider value={{ categories, loaded }}>
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategories() {
  const value = useContext(CategoryContext)
  if (!value) throw new Error('useCategories must be used within CategoryProvider')
  return value
}
