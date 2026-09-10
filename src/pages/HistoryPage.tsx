import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock3, Trash2 } from 'lucide-react'
import type { BrowseHistoryItem } from '../types'
import { socialApi } from '../lib/api'
import { formatDateTime, formatPrice } from '../lib/format'
import { productImage } from '../lib/visuals'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { ConfirmModal } from '../components/Modal'
import { Breadcrumb } from '../components/Breadcrumb'
import { useToast } from '../state/ToastContext'

export function HistoryPage() {
  const [browse, setBrowse] = useState<BrowseHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      const browseData = await socialApi.browseHistory({ pageSize: 50 })
      setBrowse(browseData.list)
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
    setConfirmClear(false)
    try {
      await socialApi.clearBrowse()
      setBrowse([])
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
          <p>最近看过的商品，搜索记录请点击顶部搜索框查看</p>
        </div>
      </div>

      {browse.length === 0 ? (
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
            <button type="button" className="icon-text-button danger" onClick={() => setConfirmClear(true)}>
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
      )}

      <ConfirmModal
        open={confirmClear}
        title="清空浏览足迹"
        content="确定清空全部浏览足迹吗？清空后不可恢复。"
        confirmText="清空"
        danger
        onConfirm={clearBrowse}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
