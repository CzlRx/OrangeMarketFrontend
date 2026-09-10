import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock3, Search, Trash2, X } from 'lucide-react'
import type { SearchHistoryItem } from '../types'
import { socialApi } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useCategories } from '../state/CategoryContext'
import { useToast } from '../state/ToastContext'

export function SearchBar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { categories } = useCategories()
  const { toast } = useToast()

  const [keyword, setKeyword] = useState('')
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  const loggedIn = Boolean(user)

  const loadHistory = useCallback(() => {
    if (!loggedIn) {
      setHistory([])
      return
    }
    socialApi
      .searchHistory({ page: 1, pageSize: 8 })
      .then((data) => setHistory(data.list))
      .catch(() => setHistory([]))
  }, [loggedIn])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const runSearch = (value: string) => {
    const trimmed = value.trim()
    setFocused(false)
    if (trimmed) {
      if (loggedIn) {
        socialApi
          .recordSearch({ keyword: trimmed })
          .then((item) => {
            setHistory((prev) => {
              const next = [item, ...prev.filter((h) => h.keyword !== item.keyword)]
              return next.slice(0, 8)
            })
          })
          .catch(() => undefined)
      }
      navigate(`/catalog?keyword=${encodeURIComponent(trimmed)}`)
    } else {
      navigate('/catalog')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    runSearch(keyword)
  }

  const clearHistory = async () => {
    try {
      await socialApi.clearSearch()
      setHistory([])
    } catch {
      toast('搜索历史清除失败', 'error')
    }
  }

  const removeHistoryItem = async (historyId: string) => {
    try {
      await socialApi.deleteSearch(historyId)
      setHistory((prev) => prev.filter((item) => item.id !== historyId))
    } catch {
      toast('删除搜索记录失败', 'error')
    }
  }

  const showDropdown = focused

  return (
    <div className="header-search" ref={wrapperRef}>
      <form className="search-box" onSubmit={submit}>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onFocus={() => {
            setFocused(true)
            loadHistory()
          }}
          placeholder="搜索商品，如：蓝牙耳机"
          aria-label="搜索商品"
          maxLength={50}
        />
        {keyword && (
          <button
            type="button"
            className="search-clear"
            onClick={() => setKeyword('')}
            aria-label="清空搜索词"
          >
            <X size={15} />
          </button>
        )}
        <button type="submit" className="search-submit" aria-label="搜索">
          <Search size={16} />
          搜索
        </button>
      </form>

      {showDropdown && (
        <div className="search-dropdown">
          {loggedIn && history.length > 0 && (
            <div className="search-group">
              <div className="search-group-head">
                <span>最近搜索</span>
                <button type="button" onClick={clearHistory}>
                  <Trash2 size={12} />
                  清空
                </button>
              </div>
              <div className="search-chips">
                {history.map((item) => (
                  <div key={item.id} className="search-chip">
                    <button
                      type="button"
                      className="search-chip-main"
                      onClick={() => {
                        setKeyword(item.keyword)
                        runSearch(item.keyword)
                      }}
                    >
                      <Clock3 size={12} style={{ color: 'var(--color-ink-3)' }} />
                      <span>{item.keyword}</span>
                    </button>
                    <button
                      type="button"
                      className="search-chip-remove"
                      aria-label={`删除搜索记录 ${item.keyword}`}
                      onClick={() => void removeHistoryItem(item.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div className="search-group">
              <div className="search-group-head">
                <span>热门分类</span>
              </div>
              <div className="search-chips">
                {categories.slice(0, 8).map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className="search-chip"
                    onClick={() => {
                      setFocused(false)
                      navigate(`/catalog?categoryId=${category.id}`)
                    }}
                  >
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
