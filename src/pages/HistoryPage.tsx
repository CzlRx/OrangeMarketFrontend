import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock3, Search, Trash2 } from 'lucide-react'
import type { BrowseHistoryItem, SearchHistoryItem } from '../types'
import { socialApi } from '../lib/api'
import { formatDateTime, formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { ConfirmModal } from '../components/Modal'
import { Breadcrumb } from '../components/Breadcrumb'
import { useToast } from '../state/ToastContext'

type View = 'browse' | 'search'

export function HistoryPage() {
  const [view, setView] = useState<View>('browse')
  const [browse, setBrowse] = useState<BrowseHistoryItem[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [confirmClear, setConfirmClear] = useState<View | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const [browseData, searchData] = await Promise.all([
        socialApi.browseHistory({ pageSize: 50 }),
        socialApi.searchHistory({ pageSize: 50 }),
      ])
      setBrowse(browseData.list)
      setSearchHistory(searchData.list)
    } catch (err) {
      toast(err instanceof Error ? err.message : '记录加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const removeBrowse = async (historyId: string) => {
    setBusyId(historyId)
    try {
      await socialApi.deleteBrowse(historyId)
      setBrowse((prev) => prev.filter((item) => item.id !== historyId))
      toast('已删除')
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const clearBrowse = async () => {
    setConfirmClear(null)
    try {
      await socialApi.clearBrowse()
      setBrowse([])
      toast('已清空')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const removeSearch = async (historyId: string) => {
    setBusyId(historyId)
    try {
      await socialApi.deleteSearch(historyId)
      setSearchHistory((prev) => prev.filter((item) => item.id !== historyId))
      toast('已删除')
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setBusyId('')
    }
  }

  const clearSearch = async () => {
    setConfirmClear(null)
    try {
      await socialApi.clearSearch()
      setSearchHistory([])
      toast('已清空')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>

  return (
    <div className="page history-page">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '浏览足迹' }]} />

      <div className="page-heading">
        <div>
          <h1>浏览足迹</h1>
          <p>最近看过的商品和搜索关键词</p>
        </div>
      </div>

      <div className="tabs-row">
        <button type="button" className={view === 'browse' ? 'active' : ''} onClick={() => setView('browse')}>
          <Clock3 size={16} />
          浏览足迹
        </button>
        <button type="button" className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>
          <Search size={16} />
          搜索历史
        </button>
      </div>

      {view === 'browse' ? (
        browse.length === 0 ? (
          <EmptyState
            title="暂无浏览足迹"
            icon={Clock3}
            action={
              <Link to="/catalog" className="button primary">
                去逛逛
              </Link>
            }
          />
        ) : (
          <div className="history-list">
          <div className="history-list-actions">
            <button type="button" className="icon-text-button danger" onClick={() => setConfirmClear('browse')}>
              <Trash2 size={16} />
              清空足迹
            </button>
          </div>
            {browse.map((item) => (
              <article className="history-row" key={item.id}>
                {item.product && (
                  <Link to={`/product/${item.product.id}`} className="history-thumb">
                    <img src={productImage(item.product)} alt={item.product.name} />
                  </Link>
                )}
                <div className="history-info">
                  {item.product ? (
                    <>
                      <Link to={`/product/${item.product.id}`}>{item.product.name}</Link>
                      <span>{formatPrice(item.product.price)}</span>
                    </>
                  ) : (
                    <p>商品已下架</p>
                  )}
                  <time>{formatDateTime(item.viewedAt)}</time>
                </div>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => removeBrowse(item.id)}
                  disabled={busyId === item.id}
                  aria-label="删除"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        )
      ) : searchHistory.length === 0 ? (
        <EmptyState title="暂无搜索历史" icon={Search} />
      ) : (
        <div className="history-list">
          <div className="history-list-actions">
            <button type="button" className="icon-text-button danger" onClick={() => setConfirmClear('search')}>
              <Trash2 size={16} />
              清空记录
            </button>
          </div>
          {searchHistory.map((item) => (
            <article className="keyword-row" key={item.id}>
              <Link to={`/catalog?keyword=${encodeURIComponent(item.keyword)}`}>{item.keyword}</Link>
              <span>{formatDateTime(item.searchedAt)}</span>
              <button
                type="button"
                className="icon-button danger"
                onClick={() => removeSearch(item.id)}
                disabled={busyId === item.id}
                aria-label="删除"
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={confirmClear === 'browse'}
        title="清空浏览足迹"
        content="确定清空全部浏览足迹吗？清空后不可恢复。"
        confirmText="清空"
        danger
        onConfirm={clearBrowse}
        onCancel={() => setConfirmClear(null)}
      />
      <ConfirmModal
        open={confirmClear === 'search'}
        title="清空搜索记录"
        content="确定清空全部搜索记录吗？清空后不可恢复。"
        confirmText="清空"
        danger
        onConfirm={clearSearch}
        onCancel={() => setConfirmClear(null)}
      />
    </div>
  )
}
