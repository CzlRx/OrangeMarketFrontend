import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface CrumbItem {
  label: string
  to?: string
}

export function Breadcrumb({ items }: { items: CrumbItem[] }) {
  return (
    <nav className="breadcrumb" aria-label="面包屑">
      {items.map((item, index) => {
        const last = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {item.to && !last ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className={last ? 'current crumb-title' : 'current'}>{item.label}</span>
            )}
            {!last && <ChevronRight size={13} />}
          </span>
        )
      })}
    </nav>
  )
}
