import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Package, SlidersHorizontal } from 'lucide-react'
import type { Category, Product } from '../types'
import { categoryApi, productApi, type ProductListParams } from '../lib/api'
import { ProductCard } from '../components/ProductCard'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'

const SORTS: { value: ProductListParams['sort']; label: string }[] = [
  { value: 'default', label: '综合' },
  { value: 'sales_desc', label: '销量' },
  { value: 'price_asc', label: '价格' },
]

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const categoryId = searchParams.get('categoryId') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<ProductListParams['sort']>('default')
  const [error, setError] = useState('')

  useEffect(() => {
    categoryApi
      .list()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const params: ProductListParams = {
      page: 1,
      pageSize: 12,
      sort,
      ...(keyword ? { keyword } : {}),
      ...(categoryId ? { categoryId } : {}),
    }
    productApi
      .list(params)
      .then((data) => {
        if (cancelled) return
        setProducts(data.list)
        setPage(data.page)
        setHasMore(data.hasMore)
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
  }, [keyword, categoryId, sort])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const params: ProductListParams = {
      page: page + 1,
      pageSize: 12,
      sort,
      ...(keyword ? { keyword } : {}),
      ...(categoryId ? { categoryId } : {}),
    }
    try {
      const data = await productApi.list(params)
      setProducts((prev) => [...prev, ...data.list])
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingMore(false)
    }
  }

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  )

  const selectCategory = (id: string) => {
    const next = new URLSearchParams(searchParams)
    if (id === categoryId) next.delete('categoryId')
    else next.set('categoryId', id)
    setSearchParams(next)
  }

  return (
    <div className="page catalog-page">
      <div className="catalog-layout">
        <aside className="filter-rail">
          <div className="filter-title">
            <SlidersHorizontal size={17} />
            <span>筛选</span>
          </div>
          <button
            type="button"
            className={!categoryId ? 'filter-item active' : 'filter-item'}
            onClick={() => selectCategory('')}
          >
            <Package size={16} />
            全部
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={category.id === categoryId ? 'filter-item active' : 'filter-item'}
              onClick={() => selectCategory(category.id)}
            >
              <Package size={16} />
              {category.name}
            </button>
          ))}
        </aside>

        <div className="catalog-main">
          <div className="catalog-toolbar">
            <div>
              <h1>{currentCategory?.name || (keyword ? `“${keyword}”` : '全部商品')}</h1>
              <p>
                {keyword ? `搜索 “${keyword}” 的结果` : currentCategory?.eyebrow || '浏览全部在售商品'}
              </p>
            </div>
            <div className="segmented">
              {SORTS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={sort === item.value ? 'active' : ''}
                  onClick={() => setSort(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : error && products.length === 0 ? (
            <EmptyState title="加载失败" description={error} />
          ) : products.length ? (
            <>
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <div className="load-more-row">
                {hasMore ? (
                  <button type="button" className="button secondary" onClick={loadMore}>
                    {loadingMore ? '加载中...' : '加载更多'}
                  </button>
                ) : (
                  <span className="end-note">已经到底了</span>
                )}
              </div>
            </>
          ) : (
            <EmptyState title="没有找到相关商品" description="换个关键词或分类试试" />
          )}
        </div>
      </div>
    </div>
  )
}
