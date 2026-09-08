import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Clock3,
  Heart,
  LogOut,
  MapPin,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  UserRound,
} from 'lucide-react'
import type { Gender, UserProfile } from '../types'
import { userApi } from '../lib/api'
import { formatDate, maskPhone } from '../lib/format'
import { LoadingState } from '../components/LoadingState'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'

const QUICK_LINKS = [
  { to: '/orders', label: '我的订单', icon: ReceiptText },
  { to: '/addresses', label: '收货地址', icon: MapPin },
  { to: '/favorites', label: '我的收藏', icon: Heart },
  { to: '/history', label: '浏览足迹', icon: Clock3 },
  { to: '/reviews', label: '待评价', icon: MessageSquareText },
  { to: '/catalog', label: '去购物', icon: PackageCheck },
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

  return (
    <div className="page profile-page">
      <div className="profile-head">
        <div className="profile-avatar">
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserRound size={30} />}
        </div>
        <div>
          <h1>{profile?.nickname || '橙子用户'}</h1>
          <p>{profile ? maskPhone(profile.phone) : ''}</p>
        </div>
        <span className="role-badge">{profile?.role === 'ADMIN' || profile?.role === 'admin' ? '管理员' : '普通用户'}</span>
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
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link to={item.to} key={item.to} className="quick-link">
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          <button type="button" className="button secondary logout-button" onClick={handleLogout}>
            <LogOut size={17} />
            退出登录
          </button>
        </section>
      </div>
    </div>
  )
}
