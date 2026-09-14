import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Headset } from 'lucide-react'
import { ChatBubble } from '../components/ChatBubble'
import { LoadingState } from '../components/LoadingState'
import { ConfirmModal } from '../components/Modal'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'
import { serviceApi } from '../lib/api'
import {
  chatSocket,
  filterSelfPresence,
  isSelfPresenceMessage,
  sameId,
  sortServiceMessages,
  upsertServiceMessages,
  wsChatToMessage,
} from '../lib/chatSocket'
import { nowLocalIso } from '../lib/format'
import type { ServiceMessage, ServiceSession } from '../types'

const PAGE_SIZE = 50
const SEND_CONFIRM_TIMEOUT = 3500

type Phase = 'loading' | 'ready' | 'error'

export function ServicePage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<ServiceSession | null>(null)
  const [messages, setMessages] = useState<ServiceMessage[]>([])
  const [page, setPage] = useState(1)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin'

  const bodyRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<ServiceSession | null>(null)
  sessionRef.current = session
  const userRef = useRef(user)
  userRef.current = user
  const messagesRef = useRef<ServiceMessage[]>([])
  messagesRef.current = messages
  const pendingRef = useRef<string[]>([])

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

  /** 清除与服务端回显内容相同的待确认消息 */
  const clearPendingByContent = useCallback((content: string) => {
    const matched = pendingRef.current.filter((tempId) =>
      messagesRef.current.some((m) => m.id === tempId && m.content === content),
    )
    if (matched.length === 0) return
    pendingRef.current = pendingRef.current.filter((id) => !matched.includes(id))
    setMessages((prev) => prev.filter((m) => !matched.includes(m.id)))
  }, [])

  /** 重新拉取最新一页（发送确认超时 / WS 重连后的兜底），按 id 去重合并 */
  const refreshLatest = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    try {
      const first = await serviceApi.messages(current.id, { page: 1, pageSize: 1 })
      const lastPage = Math.max(1, Math.ceil(first.total / PAGE_SIZE))
      const data =
        first.total > 1
          ? await serviceApi.messages(current.id, { page: lastPage, pageSize: PAGE_SIZE })
          : first
      // 服务端已确认的消息内容：用于清理对应的 temp 乐观消息
      const confirmedContents = new Set(data.list.map((m) => m.content))
      // pendingRef 只移除「已被服务端确认」的项，其余继续等回显
      pendingRef.current = pendingRef.current.filter((tempId) => {
        const temp = messagesRef.current.find((m) => m.id === tempId)
        return temp !== undefined && !confirmedContents.has(temp.content)
      })
      setMessages((prev) => {
        // temp：内容已被服务端确认的丢弃（真实消息会合并进来），未确认的保留
        const kept = prev.filter(
          (m) => !String(m.id).startsWith('temp-') || !confirmedContents.has(m.content),
        )
        return upsertServiceMessages(kept, filterSelfPresence(data.list, 'user'))
      })
    } catch {
      // 静默失败，等待下一次兜底
    }
  }, [])

  const bootstrap = useCallback(async (alive?: { current: boolean }) => {
    const still = () => alive === undefined || alive.current
    setPhase('loading')
    try {
      // 创建或复用进行中会话（同一用户同时只有一条 active 会话）
      const created = await serviceApi.createSession()
      if (!still()) return
      sessionRef.current = created
      setSession(created)

      // 分页按 id 升序，先查 total 再取最后一页（最新消息）
      const first = await serviceApi.messages(created.id, { page: 1, pageSize: 1 })
      if (!still()) return
      const lastPage = Math.max(1, Math.ceil(first.total / PAGE_SIZE))
      const data =
        first.total > 1
          ? await serviceApi.messages(created.id, { page: lastPage, pageSize: PAGE_SIZE })
          : first
      if (!still()) return
      pendingRef.current = []
      setMessages(filterSelfPresence(sortServiceMessages(data.list), 'user'))
      setPage(lastPage)
      setHasEarlier(lastPage > 1)
      setPhase('ready')
      requestAnimationFrame(() => scrollToBottom())
    } catch (err) {
      if (!still()) return
      setPhase('error')
      toast(err instanceof Error ? err.message : '接入客服失败', 'error')
    }
  }, [toast])

  const toastRef = useRef(toast)
  toastRef.current = toast
  const refreshLatestRef = useRef(refreshLatest)
  refreshLatestRef.current = refreshLatest
  const mergeMessageRef = useRef(mergeMessage)
  mergeMessageRef.current = mergeMessage
  const clearPendingByContentRef = useRef(clearPendingByContent)
  clearPendingByContentRef.current = clearPendingByContent

  useEffect(() => {
    // admin 是客服身份，不发起用户咨询，直接送往工作台
    if (isAdmin) return
    const alive = { current: true }
    void bootstrap(alive)
    return () => {
      alive.current = false
    }
  }, [bootstrap, isAdmin])

  // WS 事件订阅：不随 toast 等回调重建，避免把还在用的连接掐掉
  useEffect(() => {
    if (!session) return
    const off = chatSocket.subscribe((event) => {
      const current = sessionRef.current
      if (!current || event.type === 'pong') return
      switch (event.type) {
        case 'connected':
          setConnected(true)
          void refreshLatestRef.current()
          break
        case 'disconnected':
          setConnected(false)
          break
        case 'chat': {
          if (!sameId(event.sessionId, current.id)) return
          const selfId = userRef.current?.id
          if (event.senderType === 'user' && event.senderId && sameId(event.senderId, selfId)) {
            clearPendingByContentRef.current(event.content)
          }
          const message = wsChatToMessage(event)
          // 自己的进入/离开提示不展示（对方仍能看到）
          if (isSelfPresenceMessage(message, 'user')) return
          mergeMessageRef.current(message)
          break
        }
        case 'session_claimed':
          if (!sameId(event.sessionId, current.id)) return
          setSession((prev) =>
            prev && sameId(prev.id, event.sessionId) ? { ...prev, agentId: event.agentId } : prev,
          )
          break
        case 'session_closed':
          if (!sameId(event.sessionId, current.id)) return
          setSession((prev) =>
            prev
              ? { ...prev, status: 'closed', closedAt: event.createdAt ?? prev.closedAt }
              : prev,
          )
          mergeMessageRef.current({
            id: event.messageId,
            sessionId: event.sessionId,
            senderType: 'system',
            senderId: event.closerId ?? null,
            content: event.content,
            createdAt: event.createdAt ?? nowLocalIso(),
          })
          break
        case 'error':
          toastRef.current(event.message, 'error')
          break
      }
    })
    return off
  }, [session?.id])

  useEffect(() => {
    if (!session || session.status === 'closed') return
    const timer = window.setInterval(() => {
      void refreshLatest()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [session?.id, session?.status, refreshLatest])

  const loadEarlier = async () => {
    const current = session
    if (!current || page <= 1 || loadingEarlier) return
    setLoadingEarlier(true)
    try {
      const target = page - 1
      const data = await serviceApi.messages(current.id, { page: target, pageSize: PAGE_SIZE })
      const el = bodyRef.current
      const prevHeight = el?.scrollHeight ?? 0
      setMessages((prev) =>
        upsertServiceMessages(prev, filterSelfPresence(data.list, 'user')),
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

  const sendMessage = () => {
    const content = input.trim()
    const current = session
    if (!content || !current || current.status === 'closed') return
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
          senderType: 'user',
          senderId: user?.id ?? null,
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

    // 超时未收到回显则重新拉取，保证消息可见
    window.setTimeout(() => {
      if (pendingRef.current.includes(tempId)) {
        pendingRef.current = pendingRef.current.filter((id) => id !== tempId)
        void refreshLatest()
      }
    }, SEND_CONFIRM_TIMEOUT)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      sendMessage()
    }
  }

  const closeSession = async () => {
    const current = session
    if (!current) return
    setConfirmClose(false)
    setClosing(true)
    try {
      await serviceApi.closeSession(current.id)
      setSession((prev) => (prev ? { ...prev, status: 'closed' } : prev))
      toast('会话已结束')
    } catch (err) {
      toast(err instanceof Error ? err.message : '结束会话失败', 'error')
    } finally {
      setClosing(false)
    }
  }

  const restart = () => {
    setMessages([])
    pendingRef.current = []
    setConnected(false)
    void bootstrap()
  }

  const closed = session?.status === 'closed'

  // admin（客服身份）直接送往工作台
  if (isAdmin) return <Navigate to="/admin/service" replace />

  return (
    <div className="page service-page">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '在线客服' }]} />

      <div className="page-heading">
        <div>
          <h1>在线客服</h1>
          <p>有任何问题都可以在这里联系我们的人工客服</p>
        </div>
        <span className={`service-conn${connected ? ' online' : ''}`}>
          <i className="conn-dot" />
          {connected ? '已连接' : '连接中…'}
        </span>
      </div>

      <div className="service-card">
        <header className="service-header">
          <span className="service-header-title">
            <Headset size={16} />
            橙子市集 · 人工客服
          </span>
          <div className="service-header-actions">
            {!closed && session?.agentId && <span className="service-pill">客服已接入</span>}
            {!closed && !session?.agentId && phase === 'ready' && (
              <span className="service-pill muted">排队等待接入</span>
            )}
            {closed && <span className="service-pill muted">会话已结束</span>}
            {!closed && session && (
              <button className="chat-link-button" onClick={() => setConfirmClose(true)}>
                结束会话
              </button>
            )}
          </div>
        </header>

        {phase === 'loading' && <LoadingState label="正在为您接入客服" />}

        {phase === 'error' && (
          <div className="service-phase-tip">
            <p>接入客服失败，请稍后重试</p>
            <button className="button primary" onClick={restart}>
              重新接入
            </button>
          </div>
        )}

        {phase === 'ready' && session && (
          <>
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
                  own={message.senderType === 'user' && message.senderId === user?.id}
                  counterpart="agent"
                />
              ))}
              {messages.length === 0 && (
                <div className="chat-system">
                  <span>您好，请问有什么可以帮您？</span>
                </div>
              )}
            </div>

            <footer className="service-footer">
              {closed ? (
                <div className="service-footer-closed">
                  <span>会话已结束，期待再次为您服务</span>
                  <button className="button primary" onClick={restart}>
                    再次咨询
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    className="service-input"
                    value={input}
                    maxLength={2000}
                    placeholder="输入消息，Enter 发送，Shift + Enter 换行"
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
              )}
            </footer>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmClose}
        title="结束会话"
        content="确定要结束本次客服会话吗？结束后需要重新发起咨询。"
        confirmText="结束会话"
        danger
        loading={closing}
        onConfirm={closeSession}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}
