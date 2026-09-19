import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Camera,
  Clock3,
  CreditCard,
  Heart,
  LogOut,
  MapPin,
  MessageSquareText,
  Package,
  ReceiptText,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react'
import type { Gender, OrderStatus, UserProfile } from '../types'
import { orderApi, userApi } from '../lib/api'
import { OSS_IMAGE_ACCEPT, uploadImageToOss } from '../lib/ossUpload'
import { formatDate, maskPhone } from '../lib/format'
import { LoadingState } from '../components/LoadingState'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'

const QUICK_LINKS = [
  { to: '/orders', label: '我的订单', icon: ReceiptText },
  { to: '/addresses', label: '收货地址', icon: MapPin },
  { to: '/favorites', label: '我的收藏', icon: Heart },
  { to: '/history', label: '浏览足迹', icon: Clock3 },
  { to: '/reviews', label: '待评价', icon: MessageSquareText },
  { to: '/catalog', label: '去购物', icon: Package },
]

const ORDER_ENTRIES: { status: OrderStatus; label: string; icon: typeof CreditCard }[] = [
  { status: 'pending_payment', label: '待付款', icon: CreditCard },
  { status: 'pending_shipment', label: '待发货', icon: Package },
  { status: 'pending_receipt', label: '待收货', icon: Truck },
  { status: 'pending_review', label: '待评价', icon: MessageSquareText },
]

export function ProfilePage() {
  const { user, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(user)
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [gender, setGender] = useState<Gender>((user?.gender as Gender) ?? 0)
  const [birthday, setBirthday] = useState(user?.birthday ?? '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({})
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    userApi
      .me()
      .then((data) => {
        setProfile(data)
        setNickname(data.nickname)
        setGender((data.gender as Gender) ?? 0)
        setBirthday(data.birthday ?? '')
      })
      .catch((err) => toast(err instanceof Error ? err.message : '资料加载失败', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    Promise.all(
      ORDER_ENTRIES.map((entry) =>
        orderApi
          .list({ status: entry.status, page: 1, pageSize: 1 })
          .then((data) => [entry.status, data.total] as const)
          .catch(() => [entry.status, 0] as const),
      ),
    ).then((entries) => {
      setOrderCounts(Object.fromEntries(entries))
    })
  }, [])

  const applyProfile = (data: UserProfile) => {
    setProfile(data)
    setUser(data)
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !profile) return
    setUploadingAvatar(true)
    try {
      const result = await uploadImageToOss({
        file,
        scene: 'avatar',
        userId: profile.id,
      })
      applyProfile(await userApi.update({ avatarUrl: result.accessUrl }))
      toast('头像已更新')
    } catch (err) {
      toast(err instanceof Error ? err.message : '头像上传失败', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim()) {
      toast('昵称不能为空', 'error')
      return
    }
    setSaving(true)
    try {
      const updated = await userApi.update({
        nickname: nickname.trim(),
        gender,
        birthday: birthday || undefined,
      })
      setProfile(updated)
      setUser(updated)
      toast('资料已保存')
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    toast('已退出登录', 'info')
    navigate('/')
  }

  if (loading && !profile) return <div className="page"><LoadingState /></div>

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin'
  const quickLinks = isAdmin
    ? [{ to: '/admin', label: '管理后台', icon: ShieldCheck }, ...QUICK_LINKS]
    : QUICK_LINKS

  return (
    <div className="page profile-page">
      <Breadcrumb items={[{ label: '首页', to: '/' }, { label: '个人中心' }]} />

      <div className="profile-hero">
        <button
          type="button"
          className={`profile-avatar${uploadingAvatar ? ' uploading' : ''}`}
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          aria-label="更换头像"
        >
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserRound size={28} />}
          <span className="profile-avatar-overlay">
            {uploadingAvatar ? <span className="loader light" /> : <Camera size={18} />}
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept={OSS_IMAGE_ACCEPT}
          hidden
          onChange={handleAvatarChange}
        />
        <div className="profile-hero-info">
          <h1>
            {profile?.nickname || '橙子用户'}
            <span className="role-badge">
              {profile?.role === 'ADMIN' || profile?.role === 'admin' ? '管理员' : '普通用户'}
            </span>
          </h1>
          <p>{profile ? `手机号 ${maskPhone(profile.phone)}` : ''}</p>
          <p className="muted-note">点击头像更换，支持 jpeg / png / webp / gif，不超过 2MB</p>
        </div>
      </div>

      <div className="order-entries">
        {ORDER_ENTRIES.map((entry) => (
          <Link
            key={entry.status}
            to={`/orders?status=${entry.status}`}
            className="order-entry"
          >
            <span className="entry-count">{orderCounts[entry.status] ?? 0}</span>
            <entry.icon size={20} />
            <span>{entry.label}</span>
          </Link>
        ))}
      </div>

      <div className="profile-layout">
        <section className="profile-card">
          <h2>个人资料</h2>
          <form className="profile-form" onSubmit={save}>
            <label>
              <span>昵称</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={30} />
            </label>
            <label>
              <span>性别</span>
              <div>
                <div className="segmented">
                  {([0, 1, 2] as Gender[]).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={gender === value ? 'active' : ''}
                      onClick={() => setGender(value)}
                    >
                      {value === 0 ? '保密' : value === 1 ? '男' : '女'}
                    </button>
                  ))}
                </div>
              </div>
            </label>
            <label>
              <span>生日</span>
              <input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
            </label>
            <div className="profile-meta">
              <span>注册信息</span>
              <p>最近登录 {profile?.lastLoginAt ? formatDate(profile.lastLoginAt) : '-'}</p>
            </div>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? '保存中...' : '保存资料'}
            </button>
          </form>
        </section>

        <section className="quick-links">
          <h2>常用功能</h2>
          <div className="quick-grid">
            {quickLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link to={item.to} key={item.to} className="quick-link">
                  <Icon size={19} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          <button type="button" className="button secondary logout-button" onClick={handleLogout}>
            <LogOut size={16} />
            退出登录
          </button>
        </section>
      </div>
    </div>
  )
}
