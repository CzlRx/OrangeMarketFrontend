export function ProductSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i} style={{ animationDelay: `${i * 45}ms` }}>
          <div className="skeleton skeleton-media" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-line price" />
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="product-layout" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: '1 / 1', borderRadius: 'var(--r-md)' }} />
      <div className="product-info">
        <div className="skeleton skeleton-line" style={{ height: 24, width: '70%' }} />
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-line" style={{ height: 56, width: '100%' }} />
        <div className="skeleton skeleton-line" style={{ width: '55%' }} />
        <div className="skeleton skeleton-line" style={{ height: 48, width: '80%' }} />
      </div>
    </div>
  )
}
