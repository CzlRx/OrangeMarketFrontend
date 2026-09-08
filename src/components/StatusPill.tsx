import type { OrderStatus } from '../types'
import { ORDER_STATUS_LABELS } from '../lib/format'

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status-pill status-${status}`}>{ORDER_STATUS_LABELS[status]}</span>
}
