import { RefreshCw, ServerCrash } from 'lucide-react'

export function ErrorState({
  title = '加载失败',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="empty-state" role="alert">
      <ServerCrash size={36} strokeWidth={1.6} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {onRetry && (
        <div className="error-state-actions">
          <button type="button" className="button primary" onClick={onRetry}>
            <RefreshCw size={15} />
            重新加载
          </button>
        </div>
      )}
    </div>
  )
}
