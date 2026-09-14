import { Headset, UserRound } from 'lucide-react'
import type { ServiceMessage } from '../types'
import { formatChatTime } from '../lib/format'

interface ChatBubbleProps {
  message: ServiceMessage
  /** 是否是自己发送的消息（右侧展示） */
  own: boolean
  /** 头像使用的角色图标，决定对方一侧展示客服还是用户 */
  counterpart: 'agent' | 'user'
}

export function ChatBubble({ message, own, counterpart }: ChatBubbleProps) {
  if (message.senderType === 'system') {
    return (
      <div className="chat-system">
        <span>{message.content}</span>
      </div>
    )
  }

  const pending = String(message.id).startsWith('temp-')
  const Icon = counterpart === 'agent' ? Headset : UserRound

  return (
    <div className={`chat-row${own ? ' own' : ''}`}>
      <span className="chat-avatar" aria-hidden>
        <Icon size={16} />
      </span>
      <div className="chat-bubble-wrap">
        <div className={`chat-bubble${own ? ' own' : ''}`}>{message.content}</div>
        <div className="chat-time">
          {formatChatTime(message.createdAt)}
          {pending ? ' · 发送中' : ''}
        </div>
      </div>
    </div>
  )
}
