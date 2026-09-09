import type { OrderStatus } from '../types'

export function formatPrice(value: number) {
  return `¥${value.toFixed(2)}`
}

/** 拆分价格便于分层排版：¥ + 整数 + 小数 */
export function formatPriceParts(value: number) {
  const [int, dec] = Math.abs(value).toFixed(2).split('.')
  return { int, dec }
}

export function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function relativeTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value).getTime()
  if (Number.isNaN(date)) return value
  const diff = date - Date.now()
  const abs = Math.abs(diff)
  const minutes = Math.floor(abs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  pending_shipment: '待发货',
  pending_receipt: '待收货',
  pending_review: '待评价',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
}

export const ORDER_STATUS_TABS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'pending_payment', label: '待付款' },
  { value: 'pending_shipment', label: '待发货' },
  { value: 'pending_receipt', label: '待收货' },
  { value: 'pending_review', label: '待评价' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

export function maskPhone(phone: string) {
  if (/^\d{11}$/.test(phone)) return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  return phone
}
