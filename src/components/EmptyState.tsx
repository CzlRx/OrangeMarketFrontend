import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <Icon size={36} strokeWidth={1.6} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
