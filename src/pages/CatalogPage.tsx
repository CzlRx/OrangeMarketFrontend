import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageSearch, RotateCcw, X } from 'lucide-react'
import type { Product } from '../types'
import { productApi, type ProductListParams } from '../lib/api'
import { ProductCard } from '../components/ProductCard'
import { ProductSkeletonGrid } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Breadcrumb } from '../components/Breadcrumb'
import { Pagination } from '../components/Pagination'
import { useCategories } from '../state/CategoryContext'

const PAGE_SIZE = 20
const MAX_FULL_PAGES = 20

const SORTS: { value: NonNullable<ProductListParams['sort']>; label: string }[] = [
  { value: 'default', label: '综合' },
  { value: 'sales_desc', label: '销量' },
  { value: 'price_asc', label: '价格' },
]

const PRICE_RANGES: { value: string; label: string; min?: number; max?: number }[] = [
  { value: '', label: '全部' },
  { value: '0-99', label: '0 - 99', min: 0, max: 99 },
  { value: '100-299', label: '100 - 299', min: 100, max: 299 },
  { value: '300-999', label: '300 - 999', min: 300, max: 999 },
  { value: '1000-', label: '1000 以上', min: 1000 },
]

function parsePriceRange(value: string) {
  const range = PRICE_RANGES.find((item) => item.value === value)
  return range ?? PRICE_RANGES[0]
}

function priceLabel(keyword: string) {
  return `“${keyword}”`
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { categories } = useCategories()

  const keyword = searchParams.get('keyword') ?? ''
  const categoryId = searchParams.get('categoryId') ?? ''
  const sort = (searchParams.get('sort') as ProductListParams['sort']) || 'default'
  const priceRange = searchParams.get('price') ?? ''
  const stockOnly = searchParams.get('stock') === '1'

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 前端过滤模式（价格区间 / 仅看有货）需要全量数据
  const needsFullFetch = Boolean(priceRange) || stockOnly

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams)
      if (value) next.set(key, value)
      else next.delete(key)
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    setPage(1)
  }, [keyword, categoryId, sort, priceRange, stockOnly])

  const baseParams = useMemo<ProductListParams>(
    () => ({
      pageSize: PAGE_SIZE,
      sort,
      ...(keyword ? { keyword } : {}),
      ...(categoryId ? { categoryId } : {}),
    }),
    [keyword, categoryId, sort],
  )

  const fetchAll = useCallback(async () => {
    const collected: Product[] = []
    let current = 1
    let hasMore = true
    while (hasMore && current <= MAX_FULL_PAGES) {
      const data = await productApi.list({ ...baseParams, page: current, pageSize: 50 })
      collected.push(...data.list)
      hasMore = data.hasMore
      current += 1
    }
    return collected
  }, [baseParams])

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      setError('')
      try {
        if (needsFullFetch) {
          const all = await fetchAll()
          const range = parsePriceRange(priceRange)
          const filtered = all.filter((product) => {
            if (stockOnly && product.stock <= 0) return false
            if (range.min !== undefined && product.price < range.min) return false
            if (range.max !== undefined && product.price > range.max) return false
            return true
          })
          setProducts(filtered.slice((targetPage - 1) * PAGE_SIZE, targetPage * PAGE_SIZE))
          setTotal(filtered.length)
        } else {
          const data = await productApi.list({ ...baseParams, page: targetPage, pageSize: PAGE_SIZE })
          setProducts(data.list)
          setTotal(data.total)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
        setProducts([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [baseParams, fetchAll, needsFullFetch, priceRange, stockOnly],
  )

  useEffect(() => {
    void load(page)
  }, [load, page])

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasActiveFilter = Boolean(keyword || categoryId || priceRange || stockOnly || sort !== 'default')

  const title = currentCategory?.name || (keyword ? `“${keyword}” 的搜索结果` : '全部商品')

  const selectedChips = [
    keyword ? { key: 'keyword', label: `关键词：${keyword}` } : null,
    currentCategory ? { key: 'categoryId', label: `分类：${currentCategory.name}` } : null,
    priceRange ? { key: 'price', label: `价格：${parsePriceRange(priceRange).label}` } : null,
    stockOnly ? { key: 'stock', label: '仅看有货' } : null,
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <div className="page catalog-page">
      <div className="catalog-head">
        <Breadcrumb
          items={[
            { label: '首页', to: '/' },
            ...(keyword
              ? [{ label: '搜索' }, { label: priceLabel(keyword) }]
              : [{ label: currentCategory?.name || '全部商品' }]),
          ]}
        />
        <div className="catalog-category-bar">
          <button
            type="button"
            className={`cat-chip${!categoryId ? ' active' : ''}`}
            onClick={() => setParam('categoryId', '')}
          >
            全部商品
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`cat-chip${category.id === categoryId ? ' active' : ''}`}
              onClick={() => setParam('categoryId', category.id === categoryId ? '' : category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-panel">
        <div className="filter-row">
          <span className="filter-label">价格</span>
          <div className="filter-options">
            {PRICE_RANGES.map((range) => (
              <button
                type="button"
                key={range.value || 'all'}
                className={`filter-option${priceRange === range.value ? ' active' : ''}`}
                onClick={() => setParam('price', priceRange === range.value ? '' : range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
          <label className="checkbox-label" style={{ marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={stockOnly}
              onChange={(event) => setParam('stock', event.target.checked ? '1' : '')}
            />
            仅看有货
          </label>
          {hasActiveFilter && (
            <button
              type="button"
              className="filter-reset"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              <RotateCcw size={12} />
              重置
            </button>
          )}
        </div>
      </div>

      {selectedChips.length > 0 && (
        <div className="selected-chips">
          <span className="chips-label">已选条件：</span>
          {selectedChips.map((chip) => (
            <span className="selected-chip" key={chip.key}>
              {chip.label}
              <button
                type="button"
                onClick={() => setParam(chip.key, '')}
                aria-label={`移除条件 ${chip.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="catalog-toolbar">
        <div className="sort-buttons">
          {SORTS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`sort-button${sort === item.value ? ' active' : ''}`}
              onClick={() => setParam('sort', item.value === 'default' ? '' : item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="toolbar-count">
          {title} · 共 <b>{total}</b> 件商品
        </span>
      </div>

      {loading ? (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <ProductSkeletonGrid count={8} />
        </div>
      ) : error ? (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <ErrorState description={error} onRetry={() => void load(page)} />
        </div>
      ) : products.length ? (
        <>
          <div className="product-grid" style={{ marginTop: 'var(--sp-4)' }}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="没有找到相关商品"
          description="换个关键词、分类或放宽筛选条件试试"
          action={
            <Link to="/catalog" className="button primary">
              浏览全部商品
            </Link>
          }
        />
      )}
    </div>
  )
}
