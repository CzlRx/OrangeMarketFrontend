import type { ServiceMessage, WsClientSend, WsServerEvent } from '../types'
import { getToken } from './api'
import { nowLocalIso } from './format'

type Listener = (event: WsServerEvent) => void

/** 雪花 / 自增 ID 一律当字符串比，避免 WS JSON 数字和 REST 字符串对不上 */
export function asId(value: unknown): string {
  if (value == null || value === '') return ''
  return String(value)
}

export function sameId(left: unknown, right: unknown) {
  const a = asId(left)
  const b = asId(right)
  return a !== '' && a === b
}

function normalizeEvent(event: WsServerEvent): WsServerEvent {
  switch (event.type) {
    case 'chat':
      return {
        ...event,
        sessionId: asId(event.sessionId),
        messageId: asId(event.messageId),
        senderId: event.senderId == null ? undefined : asId(event.senderId),
      }
    case 'session_claimed':
      return {
        ...event,
        sessionId: asId(event.sessionId),
        agentId: asId(event.agentId),
      }
    case 'session_closed':
      return {
        ...event,
        sessionId: asId(event.sessionId),
        messageId: asId(event.messageId),
        closerId: event.closerId == null ? undefined : asId(event.closerId),
      }
    case 'connected':
      return { ...event, userId: event.userId }
    default:
      return event
  }
}

/** WS chat 帧 → 消息模型（messageId 作为 id，供历史消息去重） */
export function wsChatToMessage(event: Extract<WsServerEvent, { type: 'chat' }>): ServiceMessage {
  return {
    id: asId(event.messageId),
    sessionId: asId(event.sessionId),
    senderType: event.senderType,
    senderId: event.senderId == null ? null : asId(event.senderId),
    content: event.content,
    createdAt: event.createdAt ?? nowLocalIso(),
  }
}

/** 消息按 id 升序（旧 → 新）；临时消息（temp- 前缀）排最后 */
export function sortServiceMessages(list: ServiceMessage[]) {
  return [...list].sort((a, b) => {
    const aId = asId(a.id)
    const bId = asId(b.id)
    const aTemp = aId.startsWith('temp-')
    const bTemp = bId.startsWith('temp-')
    if (aTemp !== bTemp) return aTemp ? 1 : -1
    if (aTemp && bTemp) return aId < bId ? -1 : 1
    try {
      const aNum = BigInt(aId)
      const bNum = BigInt(bId)
      if (aNum === bNum) return 0
      return aNum < bNum ? -1 : 1
    } catch {
      return aId < bId ? -1 : aId > bId ? 1 : 0
    }
  })
}

/** 「自己」的进入/离开提示文案：用户端不看用户的，客服端不看客服的 */
const SELF_PRESENCE_CONTENT: Record<'user' | 'agent', readonly string[]> = {
  user: ['用户已进入会话', '用户已离开会话', '用户已重新进入会话'],
  agent: ['客服已进入会话', '客服已离开会话', '客服已重新进入会话'],
}

/** 是否为「自己」的进入/离开/重新进入系统提示（后端会推给双方，本端应隐藏） */
export function isSelfPresenceMessage(message: ServiceMessage, side: 'user' | 'agent') {
  return (
    message.senderType === 'system' && SELF_PRESENCE_CONTENT[side].includes(message.content)
  )
}

/** 过滤列表中「自己」的进入/离开系统提示（历史消息与实时消息均适用） */
export function filterSelfPresence(list: ServiceMessage[], side: 'user' | 'agent') {
  return list.filter((message) => !isSelfPresenceMessage(message, side))
}

/** 按 id 合并消息列表（后写入覆盖先写入），保留 temp- 乐观消息 */
export function upsertServiceMessages(
  existing: ServiceMessage[],
  incoming: ServiceMessage[],
) {
  const temps = existing.filter((message) => asId(message.id).startsWith('temp-'))
  const byId = new Map<string, ServiceMessage>()
  for (const message of existing) {
    const id = asId(message.id)
    if (!id.startsWith('temp-')) byId.set(id, { ...message, id })
  }
  for (const message of incoming) {
    const id = asId(message.id)
    if (!id.startsWith('temp-')) byId.set(id, { ...message, id, sessionId: asId(message.sessionId) })
  }
  return sortServiceMessages([...byId.values(), ...temps])
}

const HEARTBEAT_INTERVAL = 25000
const RECONNECT_BASE_MS = 1500
const RECONNECT_MAX_MS = 10000

/**
 * 人工客服 WebSocket 单例：
 * - 连接 `ws(s)://{host}/ws/service?token={jwt}`（开发走 Vite 代理，生产走 Nginx 代理）
 * - 25s 心跳 ping，断线指数退避自动重连
 * - 以订阅人数管理连接：还有监听者时不会因为某个 effect 清理而把线掐死
 */
class ChatSocket {
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private attempts = 0
  private manualClose = false

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    const token = getToken()
    if (!token) return

    this.manualClose = false
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/service?token=${encodeURIComponent(token)}`,
    )
    this.ws = ws

    ws.onopen = () => {
      this.attempts = 0
      this.startHeartbeat()
    }
    ws.onmessage = (raw) => {
      let event: WsServerEvent
      try {
        event = JSON.parse(String(raw.data)) as WsServerEvent
      } catch {
        return
      }
      const normalized = normalizeEvent(event)
      this.listeners.forEach((listener) => listener(normalized))
    }
    ws.onclose = () => {
      this.stopHeartbeat()
      // 已被新连接替换时，忽略旧 socket 的 close，避免误报断开并叠加重连
      if (this.ws !== ws) return
      this.ws = null
      this.listeners.forEach((listener) => listener({ type: 'disconnected' }))
      if (!this.manualClose && this.listeners.size > 0) this.scheduleReconnect()
    }
    ws.onerror = () => {
      // 浏览器随后会触发 onclose，这里不要主动 close，避免误伤尚在握手的连接
    }
  }

  /** 订阅服务端事件并确保已连接；最后一名订阅者离开时才真正断开 */
  subscribe(listener: Listener) {
    this.listeners.add(listener)
    this.connect()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.close()
    }
  }

  /** 发送帧，返回是否已送入连接（未连接返回 false，等待自动重连） */
  send(payload: WsClientSend) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
      return true
    }
    this.connect()
    return false
  }

  /** 主动断开（已无订阅者时调用），不触发自动重连 */
  close() {
    this.manualClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    const ws = this.ws
    this.ws = null
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.close()
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'ping' })
    }, HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.attempts, RECONNECT_MAX_MS)
    this.attempts += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}

export const chatSocket = new ChatSocket()
