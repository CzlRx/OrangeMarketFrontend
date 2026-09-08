import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        title="页面不存在"
        description="你访问的页面可能已经移动或删除"
        icon={Compass}
        action={
          <Link to="/" className="button primary">
            返回首页
          </Link>
        }
      />
    </div>
  )
}
