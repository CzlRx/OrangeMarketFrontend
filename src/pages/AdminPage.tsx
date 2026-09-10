import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, ShieldBan, Truck } from 'lucide-react'
import type { AdminShipmentResult, AdminUserStatusResult } from '../types'
import { adminApi } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { Breadcrumb } from '../components/Breadcrumb'
import { ConfirmModal } from '../components/Modal'
import { StatusPill } from '../components/StatusPill'
import { useToast } from '../state/ToastContext'

export function AdminPage() {
  const { toast } = useToast()

  const [shipOrderId, setShipOrderId] = useState('')
  const [trackingNo, setTrackingNo] = useState('')
  const [shipping, setShipping] = useState(false)
  const [shipment, setShipment] = useState<AdminShipmentResult | null>(null)

  const [banUserId, setBanUserId] = useState('')
  const [banning, setBanning] = useState(false)
  const [bannedUser, setBannedUser] = useState<AdminUserStatusResult | null>(null)
  const [confirmBan, setConfirmBan] = useState(false)

  const submitShip = async (event: FormEvent) => {
    event.preventDefault()
    const orderId = shipOrderId.trim()
    const tracking = trackingNo.trim()
    if (!orderId || !tracking) {
      toast('请填写订单 ID 和快递单号', 'error')
      return
    }
    setShipping(true)
    try {
      const result = await adminApi.shipOrder(orderId, { trackingNo: tracking })
      setShipment(result)
      toast('发货成功')
      setShipOrderId('')
      setTrackingNo('')
    } catch (err) {
      toast(err instanceof Error ? err.message : '发货失败', 'error')
    } finally {
      setShipping(false)
    }
  }

  const submitBan = (event: FormEvent) => {
    event.preventDefault()
    if (!banUserId.trim()) {
      toast('请填写用户 ID', 'error')
      return
    }
    setConfirmBan(true)
  }

  const banUser = async () => {
    setConfirmBan(false)
    setBanning(true)
    try {
      const result = await adminApi.banUser(banUserId.trim())
      setBannedUser(result)
      toast('该用户已被封禁')
      setBanUserId('')
    } catch (err) {
      toast(err instanceof Error ? err.message : '封禁失败', 'error')
    } finally {
      setBanning(false)
    }
  }

  return (
    <div className="page admin-page">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '管理后台' }]} />

      <div className="page-heading">
        <div>
          <h1>管理后台</h1>
          <p>订单发货与用户封禁管理</p>
        </div>
        <Link to="/profile" className="icon-text-button">
          返回个人中心
        </Link>
      </div>

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="checkout-section">
            <div className="section-title">
              <Truck size={17} />
              <h2>订单发货</h2>
            </div>
            <form onSubmit={submitShip}>
              <div className="form-grid">
                <label>
                  <span>订单 ID</span>
                  <input
                    value={shipOrderId}
                    onChange={(event) => setShipOrderId(event.target.value.trim())}
                    placeholder="待发货订单的 ID"
                  />
                </label>
                <label>
                  <span>快递单号</span>
                  <input
                    value={trackingNo}
                    onChange={(event) => setTrackingNo(event.target.value)}
                    placeholder="发货快递单号"
                    maxLength={128}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="button primary" disabled={shipping}>
                  {shipping ? '发货中...' : '确认发货'}
                </button>
              </div>
              <p className="muted-note">仅“待发货”状态的订单可以发货，发货后订单转为“待收货”</p>
            </form>
          </section>

          <section className="checkout-section">
            <div className="section-title">
              <ShieldBan size={17} />
              <h2>封禁用户</h2>
            </div>
            <form onSubmit={submitBan}>
              <div className="form-grid">
                <label className="wide-field">
                  <span>用户 ID</span>
                  <input
                    value={banUserId}
                    onChange={(event) => setBanUserId(event.target.value.trim())}
                    placeholder="要封禁的用户 ID"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="button secondary" disabled={banning}>
                  {banning ? '处理中...' : '封禁该用户'}
                </button>
              </div>
              <p className="muted-note">封禁后该用户将被强制下线且无法再登录，管理员账号不可被封禁</p>
            </form>
          </section>
        </div>

        <aside className="checkout-summary">
          <h2>最近操作</h2>
          {shipment ? (
            <>
              <div className="summary-line">
                <span>订单号</span>
                <b>{shipment.orderNo}</b>
              </div>
              <div className="summary-line">
                <span>订单状态</span>
                <b><StatusPill status={shipment.status} /></b>
              </div>
              <div className="summary-line">
                <span>快递单号</span>
                <b>{shipment.trackingNo}</b>
              </div>
              <div className="summary-line">
                <span>发货时间</span>
                <b>{formatDateTime(shipment.shippedAt)}</b>
              </div>
            </>
          ) : (
            <p className="muted-note">
              <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              暂无发货记录
            </p>
          )}
          {bannedUser && (
            <>
              <div className="summary-line">
                <span>已封禁用户</span>
                <b>{bannedUser.userId}</b>
              </div>
              <div className="summary-line">
                <span>用户状态</span>
                <b>{bannedUser.status === 'disabled' ? '已封禁' : bannedUser.status}</b>
              </div>
            </>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={confirmBan}
        title="封禁用户"
        content={`确定封禁用户 ${banUserId} 吗？封禁后该用户将立即退出登录且无法再登录。`}
        confirmText="确认封禁"
        danger
        onConfirm={banUser}
        onCancel={() => setConfirmBan(false)}
      />
    </div>
  )
}
