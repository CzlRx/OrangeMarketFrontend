export function LoadingState({ label = '正在加载' }: { label?: string }) {
  return (
    <div className="loading-state">
      <span className="loader" />
      <span>{label}</span>
    </div>
  )
}
