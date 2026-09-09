import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

function buildPages(current: number, total: number): (number | 'ellipsis-l' | 'ellipsis-r')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis-l' | 'ellipsis-r')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('ellipsis-l')
  for (let i = start; i <= end; i += 1) pages.push(i)
  if (end < total - 1) pages.push('ellipsis-r')
  pages.push(total)
  return pages
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages = buildPages(page, totalPages)

  return (
    <div className="pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="上一页"
      >
        <ChevronLeft size={15} />
      </button>
      {pages.map((item) =>
        typeof item === 'number' ? (
          <button
            type="button"
            key={item}
            className={item === page ? 'active' : ''}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="ellipsis">
            …
          </span>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="下一页"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
