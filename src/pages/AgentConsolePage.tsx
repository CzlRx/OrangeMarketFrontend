import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Headset } from 'lucide-react'
import { ChatBubble } from '../components/ChatBubble'
import { ConfirmModal } from '../components/Modal'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'
import { adminServiceApi } from '../lib/api'
import {
  chatSocket,
  filterSelfPresence,
  isSelfPresenceMessage,
  sameId,
  sortServiceMessages,
  upsertServiceMessages,
  wsChatToMessage,
} from '../lib/chatSocket'
import { nowLocalIso, relativeTime } from '../lib/format'
import type { ServiceMessage, ServiceSession } from '../types'

const PAGE_SIZE = 50
const LOBBY_POLL_INTERVAL = 4000
const SEND_CONFIRM_TIMEOUT = 3500

type WsState = 'connecting' | 'online' | 'denied'

export function AgentConsolePage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState<'lobby' | 'mine'>('lobby')
  const [lobby, setLobby] = useState<ServiceSession[]>([])
  const [mine, setMine] = useState<ServiceSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<ServiceSession | null>(null)
  const [messages, setMessages] = useState<ServiceMessage[]>([])
  const [page, setPage] = useState(1)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [input, setInput] = useState('')
  const [wsState, setWsState] = useState<WsState>('connecting')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [unread, setUnread] = useState<string[]>([])

  const bodyRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef<string | null>(null)
  const activeSessionRef = useRef<ServiceSession | null>(null)
  activeIdRef.current = activeId
  activeSessionRef.current = activeSession
  const userRef = useRef(user)
  userRef.current = user
  const messagesRef = useRef<ServiceMessage[]>([])
  messagesRef.current = messages
  const pendingRef = useRef<string[]>([])
  const lobbyIdsRef = useRef<Set<string>>(new Set())
  const mineIdsRef = useRef<Set<string>>(new Set())
  const lobbyLoadedRef = useRef(false)

  const scrollToBottom = (smooth = false) => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  const mergeMessage = useCallback((msg: ServiceMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => sameId(m.id, msg.id))) return prev
      return sortServiceMessages([...prev, msg])
    })
    requestAnimationFrame(() => scrollToBottom(true))
  }, [])

  const clearPendingByContent = useCallback((content: string) => {
    const matched = pendingRef.current.filter((tempId) =>
      messagesRef.current.some((m) => m.id === tempId && m.content === content),
    )
    if (matched.length === 0) return
    pendingRef.current = pendingRef.current.filter((id) => !matched.includes(id))
    setMessages((prev) => prev.filter((m) => !matched.includes(m.id)))
  }, [])

  /** 大厅不会实时推新单，轮询刷新（4s） */
  const refreshLists = useCallback(
    async (silent = true) => {
      try {
        const [lobbyPage, minePage] = await Promise.all([
          adminServiceApi.lobby({ page: 1, pageSize: 20 }),
          adminServiceApi.mine({ page: 1, pageSize: 20 }),
        ])
        if (lobbyLoadedRef.current) {
          const fresh = lobbyPage.list.filter((s) => !lobbyIdsRef.current.has(s.id))
          if (fresh.length > 0 && silent) {
            toast(`有 ${fresh.length} 个新的待接会话`, 'info')
          }
        }
        lobbyIdsRef.current = new Set(lobbyPage.list.map((s) => s.id))
        mineIdsRef.current = new Set(minePage.list.map((s) => s.id))
        setLobby(lobbyPage.list)
        setMine(minePage.list)
        lobbyLoadedRef.current = true
      } catch (err) {
        if (!silent) toast(err instanceof Error ? err.message : '获取会话列表失败', 'error')
      }
    },
    [toast],
  )

  useEffect(() => {
    void refreshLists()
    const timer = window.setInterval(() => {
      void refreshLists()
    }, LOBBY_POLL_INTERVAL)
    return () => window.clearInterval(timer)
  }, [refreshLists])

  // 列表刷新后同步当前会话的最新状态
  useEffect(() => {
    const id = activeId
    if (!id) return
    const found = [...mine, ...lobby].find((s) => s.id === id)
    if (found) setActiveSession(found)
  }, [mine, lobby, activeId])

  const selectSession = useCallback(
    async (id: string) => {
      activeIdRef.current = id
      setActiveId(id)
      setMessages([])
      setPage(1)
      setHasEarlier(false)
      setUnread((prev) => prev.filter((x) => x !== id))
      try {
        const first = await adminServiceApi.messages(id, { page: 1, pageSize: 1 })
        if (activeIdRef.current !== id) return
        const lastPage = Math.max(1, Math.ceil(first.total / PAGE_SIZE))
        const data =
          first.total > 1
            ? await adminServiceApi.messages(id, { page: lastPage, pageSize: PAGE_SIZE })
            : first
        if (activeIdRef.current !== id) return
        pendingRef.current = []
        setMessages(filterSelfPresence(sortServiceMessages(data.list), 'agent'))
        setPage(lastPage)
        setHasEarlier(lastPage > 1)
        requestAnimationFrame(() => scrollToBottom())
      } catch (err) {
        toast(err instanceof Error ? err.message : '获取会话消息失败', 'error')
      }
    },
    [toast],
  )

  const refreshActiveMessages = useCallback(async () => {
    const id = activeIdRef.current
    if (!id) return
    try {
      const first = await adminServiceApi.messages(id, { page: 1, pageSize: 1 })
      if (activeIdRef.current !== id) return
      const lastPage = Math.max(1, Math.ceil(first.total / PAGE_SIZE))
      const data =
        first.total > 1
          ? await adminServiceApi.messages(id, { page: lastPage, pageSize: PAGE_SIZE })
          : first
      if (activeIdRef.current !== id) return
      const confirmedContents = new Set(data.list.map((m) => m.content))
      pendingRef.current = pendingRef.current.filter((tempId) => {
        const temp = messagesRef.current.find((m) => m.id === tempId)
        return temp !== undefined && !confirmedContents.has(temp.content)
      })
      setMessages((prev) => {
        const kept = prev.filter(
          (m) => !String(m.id).startsWith('temp-') || !confirmedContents.has(m.content),
        )
        return upsertServiceMessages(kept, filterSelfPresence(data.list, 'agent'))
      })
    } catch {
      // 静默失败，等待下一次 WS 或轮询
    }
  }, [])

  const toastRef = useRef(toast)
  toastRef.current = toast
  const refreshListsRef = useRef(refreshLists)
  refreshListsRef.current = refreshLists
  const refreshActiveMessagesRef = useRef(refreshActiveMessages)
  refreshActiveMessagesRef.current = refreshActiveMessages
  const mergeMessageRef = useRef(mergeMessage)
  mergeMessageRef.current = mergeMessage
  const clearPendingByContentRef = useRef(clearPendingByContent)
  clearPendingByContentRef.current = clearPendingByContent

  // WS：进入页面即连接；回调走 ref，避免 effect 重建把连接掐掉
  useEffect(() => {
    const off = chatSocket.subscribe((event) => {
      switch (event.type) {
        case 'connected':
          setWsState(event.agent ? 'online' : 'denied')
          if (!event.agent) toastRef.current('当前账号没有客服权限', 'error')
          void refreshActiveMessagesRef.current()
          break
        case 'disconnected':
          setWsState((prev) => (prev === 'denied' ? prev : 'connecting'))
          break
        case 'pong':
          return
        case 'chat': {
          const selfId = userRef.current?.id
          const message = wsChatToMessage(event)
          if (sameId(event.sessionId, activeIdRef.current)) {
            if (event.senderType === 'agent' && event.senderId && sameId(event.senderId, selfId)) {
              clearPendingByContentRef.current(event.content)
            }
            if (!isSelfPresenceMessage(message, 'agent')) {
              mergeMessageRef.current(message)
            }
          } else if ([...mineIdsRef.current].some((id) => sameId(id, event.sessionId))) {
            setUnread((prev) =>
              prev.some((id) => sameId(id, event.sessionId)) ? prev : [...prev, event.sessionId],
            )
          }
          break
        }
        case 'session_claimed': {
          const selfId = userRef.current?.id
          if (sameId(event.agentId, selfId)) {
            toastRef.current('已接入会话', 'info')
          } else if (sameId(activeIdRef.current, event.sessionId)) {
            toastRef.current('该会话已被其他客服接单', 'error')
          }
          void refreshListsRef.current()
          break
        }
        case 'session_closed': {
          if (sameId(event.sessionId, activeIdRef.current)) {
            setActiveSession((prev) =>
              prev && sameId(prev.id, event.sessionId) ? { ...prev, status: 'closed' } : prev,
            )
            mergeMessageRef.current({
              id: event.messageId,
              sessionId: event.sessionId,
              senderType: 'system',
              senderId: event.closerId ?? null,
              content: event.content,
              createdAt: event.createdAt ?? nowLocalIso(),
            })
            const selfId = userRef.current?.id
            if (event.closerId && selfId && !sameId(event.closerId, selfId)) {
              toastRef.current(event.content, 'info')
            }
          }
          void refreshListsRef.current()
          break
        }
        case 'error':
          toastRef.current(event.message, 'error')
          break
      }
    })
    return off
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshActiveMessages()
    }, LOBBY_POLL_INTERVAL)
    return () => window.clearInterval(timer)
  }, [refreshActiveMessages])

  const claim = async (id: string) => {
    setClaimingId(id)
    try {
      const claimed = await adminServiceApi.claim(id)
      toast('接单成功')
      setTab('mine')
      setActiveSession(claimed)
      await Promise.all([refreshLists(), selectSession(id)])
    } catch (err) {
      // 40900：已被其他客服接单；42200：会话已关闭
      toast(err instanceof Error ? err.message : '接单失败', 'error')
      void refreshLists()
    } finally {
      setClaimingId(null)
    }
  }

  const closeActive = async () => {
    const current = activeSessionRef.current
    if (!current) return
    setConfirmClose(false)
    setClosing(true)
    try {
      await adminServiceApi.closeSession(current.id)
      setActiveSession((prev) =>
        prev && prev.id === current.id ? { ...prev, status: 'closed' } : prev,
      )
      toast('会话已结束')
      void refreshLists()
    } catch (err) {
      toast(err instanceof Error ? err.message : '结束会话失败', 'error')
    } finally {
      setClosing(false)
    }
  }

  const loadEarlier = async () => {
    const current = activeSession
    if (!current || page <= 1 || loadingEarlier) return
    setLoadingEarlier(true)
    try {
      const target = page - 1
      const data = await adminServiceApi.messages(current.id, {
        page: target,
        pageSize: PAGE_SIZE,
      })
      const el = bodyRef.current
      const prevHeight = el?.scrollHeight ?? 0
      setMessages((prev) =>
        upsertServiceMessages(prev, filterSelfPresence(data.list, 'agent')),
      )
      setPage(target)
      setHasEarlier(target > 1)
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      })
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载历史消息失败', 'error')
    } finally {
      setLoadingEarlier(false)
    }
  }

  const selfId = user?.id
  const mineActive =
    activeSession?.status === 'active' && Boolean(activeSession.agentId) && activeSession.agentId === selfId
  const takenByOther =
    activeSession?.status === 'active' && Boolean(activeSession.agentId) && activeSession.agentId !== selfId
  const canSend = Boolean(mineActive)

  const sendMessage = () => {
    const content = input.trim()
    const current = activeSessionRef.current
    if (!content || !current || !canSend) return
    if (content.length > 2000) {
      toast('消息内容不能超过 2000 字', 'error')
      return
    }

    const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    setMessages((prev) =>
      sortServiceMessages([
        ...prev,
        {
          id: tempId,
          sessionId: current.id,
          senderType: 'agent',
          senderId: selfId ?? null,
          content,
          createdAt: nowLocalIso(),
        },
      ]),
    )
    pendingRef.current.push(tempId)
    setInput('')
    requestAnimationFrame(() => scrollToBottom(true))

    const ok = chatSocket.send({ type: 'chat', sessionId: current.id, content })
    if (!ok) toast('连接已断开，正在重连，请稍候', 'error')

    window.setTimeout(() => {
      if (pendingRef.current.includes(tempId)) {
        pendingRef.current = pendingRef.current.filter((id) => id !== tempId)
        void selectSession(current.id)
      }
    }, SEND_CONFIRM_TIMEOUT)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      sendMessage()
    }
  }

  const list = tab === 'lobby' ? lobby : mine

  return (
    <div className="page agent-console-page">
      <Breadcrumb
        items={[
          { label: '首页', to: '/' },
          { label: '管理后台', to: '/admin' },
          { label: '客服工作台' },
        ]}
      />

      <div className="page-heading">
        <div>
          <h1>客服工作台</h1>
          <p>待接大厅每 4 秒自动刷新，接单后即可回复用户</p>
        </div>
        <span className={`service-conn${wsState === 'online' ? ' online' : ''}`}>
          <i className="conn-dot" />
          {wsState === 'online' ? '已连接' : wsState === 'denied' ? '无客服权限' : '连接中…'}
        </span>
      </div>

      {wsState === 'denied' ? (
        <div className="service-phase-tip">
          <p>当前账号没有客服权限，请使用 admin 账号登录</p>
          <Link to="/admin" className="button secondary">
            返回管理后台
          </Link>
        </div>
      ) : (
        <div className="agent-layout">
          <aside className="agent-sidebar">
            <div className="agent-tabs">
              <button
                className={`agent-tab${tab === 'lobby' ? ' active' : ''}`}
                onClick={() => setTab('lobby')}
              >
                待接大厅{lobby.length > 0 ? ` (${lobby.length})` : ''}
              </button>
              <button
                className={`agent-tab${tab === 'mine' ? ' active' : ''}`}
                onClick={() => setTab('mine')}
              >
                我的会话{mine.length > 0 ? ` (${mine.length})` : ''}
              </button>
            </div>
            <div className="session-list">
              {list.length === 0 && (
                <div className="session-empty">{tab === 'lobby' ? '暂无待接会话' : '暂未接待会话'}</div>
              )}
              {list.map((session) => (
                <button
                  key={session.id}
                  className={`session-item${activeId === session.id ? ' active' : ''}`}
                  onClick={() => void selectSession(session.id)}
                >
                  <span className="session-item-top">
                    <span className="session-title">
                      {session.userNickname || `用户 ${session.userId}`}
                    </span>
                    <span className="session-meta">{relativeTime(session.createdAt)}</span>
                  </span>
                  <span className="session-item-bottom">
                    <span className="session-meta">会话 #{session.id}</span>
                    <span className="session-tags">
                      {tab === 'lobby' && <i className="session-badge">待接单</i>}
                      {unread.includes(session.id) && <i className="session-badge unread">新消息</i>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="chat-panel">
            {activeSession ? (
              <>
                <header className="chat-panel-header">
                  <div className="chat-panel-user">
                    <strong>{activeSession.userNickname || `用户 ${activeSession.userId}`}</strong>
                    <span>会话 #{activeSession.id}</span>
                  </div>
                  <div className="chat-panel-actions">
                    {activeSession.status === 'closed' && (
                      <span className="service-pill muted">会话已结束</span>
                    )}
                    {takenByOther && <span className="service-pill muted">其他客服接待中</span>}
                    {activeSession.status === 'active' && !activeSession.agentId && (
                      <button
                        className="button primary"
                        disabled={claimingId === activeSession.id}
                        onClick={() => void claim(activeSession.id)}
                      >
                        {claimingId === activeSession.id ? '接单中…' : '接单'}
                      </button>
                    )}
                    {mineActive && (
                      <button className="button secondary" onClick={() => setConfirmClose(true)}>
                        结束会话
                      </button>
                    )}
                  </div>
                </header>

                <div className="service-body" ref={bodyRef}>
                  {hasEarlier && (
                    <div className="chat-earlier">
                      <button onClick={loadEarlier} disabled={loadingEarlier}>
                        {loadingEarlier ? '加载中…' : '加载更早的消息'}
                      </button>
                    </div>
                  )}
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      own={message.senderType === 'agent' && message.senderId === selfId}
                      counterpart="user"
                    />
                  ))}
                  {messages.length === 0 && (
                    <div className="chat-system">
                      <span>暂无消息，接单后即可回复用户</span>
                    </div>
                  )}
                </div>

                <footer className="service-footer">
                  {activeSession.status === 'closed' ? (
                    <div className="service-footer-closed">
                      <span>会话已结束</span>
                    </div>
                  ) : canSend ? (
                    <>
                      <textarea
                        className="service-input"
                        value={input}
                        maxLength={2000}
                        placeholder="回复用户，Enter 发送，Shift + Enter 换行"
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <button
                        className="button primary service-send"
                        onClick={sendMessage}
                        disabled={!input.trim()}
                      >
                        发送
                      </button>
                    </>
                  ) : (
                    <div className="service-footer-closed">
                      <span>
                        {takenByOther
                          ? '该会话由其他客服接待中'
                          : '接单后即可回复用户（当前可预览消息）'}
                      </span>
                    </div>
                  )}
                </footer>
              </>
            ) : (
              <div className="chat-panel-empty">
                <Headset size={32} />
                <p>从左侧选择一个会话开始接待</p>
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmModal
        open={confirmClose}
        title="结束会话"
        content="确定要结束当前客服会话吗？结束后用户将无法继续发言。"
        confirmText="结束会话"
        danger
        loading={closing}
        onConfirm={closeActive}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}
