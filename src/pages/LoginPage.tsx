import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Phone, RefreshCw, ShieldCheck } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, login } = useAuth()
  const { toast } = useToast()

  const [phone, setPhone] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaKey, setCaptchaKey] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const loadCaptcha = async () => {
    try {
      const data = await authApi.captcha()
      setCaptchaImage(data.image)
      setCaptchaKey(data.captchaKey)
      setCaptchaCode('')
    } catch (err) {
      toast(err instanceof Error ? err.message : '验证码加载失败', 'error')
    }
  }

  useEffect(() => {
    void loadCaptcha()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setInterval(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  if (user) {
    const redirect = searchParams.get('redirect')
    return <Navigate to={redirect || '/'} replace />
  }

  const sendSms = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      toast('请输入正确的手机号', 'error')
      return
    }
    if (!captchaCode.trim() || !captchaKey) {
      toast('请先输入图形验证码', 'error')
      return
    }
    setSending(true)
    try {
      await authApi.sendSms({
        phone,
        purpose: 'login',
        captchaKey,
        captchaCode: captchaCode.trim(),
      })
      setCountdown(60)
      toast('验证码已发送')
    } catch (err) {
      toast(err instanceof Error ? err.message : '发送失败', 'error')
      if (captchaImage) void loadCaptcha()
    } finally {
      setSending(false)
    }
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^1\d{10}$/.test(phone)) {
      toast('请输入正确的手机号', 'error')
      return
    }
    if (!smsCode.trim()) {
      toast('请输入短信验证码', 'error')
      return
    }
    setLoading(true)
    try {
      await login(phone, smsCode.trim())
      toast('登录成功')
      navigate(searchParams.get('redirect') || '/', { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : '登录失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page login-page">
      <div className="login-panel">
        <div className="login-heading">
          <span className="brand-mark">
            <ShieldCheck size={20} />
          </span>
          <h1>登录橙子市集</h1>
          <p>任意 1 开头的 11 位手机号均可体验</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <label>
            <span>手机号</span>
            <div className="input-with-icon">
              <Phone size={17} />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="请输入手机号"
              />
            </div>
          </label>

          <label>
            <span>图形验证码</span>
            <div className="captcha-row">
              <div className="input-with-icon">
                <KeyRound size={17} />
                <input
                  value={captchaCode}
                  onChange={(event) => setCaptchaCode(event.target.value.toUpperCase().slice(0, 4))}
                  autoComplete="off"
                  maxLength={4}
                  placeholder="图形验证码"
                />
              </div>
              <button
                type="button"
                className="captcha-image"
                onClick={loadCaptcha}
                title="点击刷新"
              >
                {captchaImage ? <img src={captchaImage} alt="图形验证码" /> : <RefreshCw size={18} />}
              </button>
            </div>
          </label>

          <label>
            <span>短信验证码</span>
            <div className="sms-row">
              <div className="input-with-icon">
                <KeyRound size={17} />
                <input
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="请输入短信验证码"
                />
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={sendSms}
                disabled={sending || countdown > 0}
              >
                {countdown > 0 ? `${countdown}s` : '发送验证码'}
              </button>
            </div>
          </label>

          <button type="submit" className="button primary login-submit" disabled={loading}>
            {loading ? '登录中...' : '登录 / 自动注册'}
          </button>
        </form>

        <div className="login-extra">
          <Link to="/">返回首页</Link>
        </div>
      </div>
    </div>
  )
}
