import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UserProfile } from '../types'
import {
  authApi,
  cartApi,
  clearSession,
  getToken,
  isSessionExpired,
  readGuestCart,
  saveGuestCart,
  saveSession,
  USER_KEY,
  userApi,
} from '../lib/api'

interface AuthValue {
  user: UserProfile | null
  loading: boolean
  login: (phone: string, smsCode: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: UserProfile) => void
}

const AuthContext = createContext<AuthValue | null>(null)

function readStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(() => readStoredUser())
  const [loading, setLoading] = useState(() => Boolean(getToken()) && !isSessionExpired())

  const loadProfile = useCallback(async () => {
    if (!getToken() || isSessionExpired()) {
      clearSession()
      setUserState(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const profile = await userApi.me()
      setUserState(profile)
      localStorage.setItem(USER_KEY, JSON.stringify(profile))
    } catch {
      setUserState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()
    const handleAuthUpdate = () => {
      if (!getToken() || isSessionExpired()) {
        setUserState(null)
        setLoading(false)
      } else {
        void loadProfile()
      }
    }
    window.addEventListener('orange_market_auth_updated', handleAuthUpdate)
    return () => window.removeEventListener('orange_market_auth_updated', handleAuthUpdate)
  }, [loadProfile])

  const setUser = useCallback((profile: UserProfile) => {
    setUserState(profile)
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
  }, [])

  const login = useCallback(async (phone: string, smsCode: string) => {
    const data = await authApi.login({ phone, smsCode })
    saveSession(data)

    const guestItems = readGuestCart()
    if (guestItems.length > 0) {
      try {
        await cartApi.merge({ items: guestItems })
        saveGuestCart([])
      } catch {
        // Merge failure should not block login.
      }
    }

    const profile = await userApi.me()
    setUser(profile)
  }, [setUser])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Local logout still applies when the server session is already gone.
    }
    clearSession()
    setUserState(null)
  }, [])

  const refreshUser = useCallback(async () => {
    await loadProfile()
  }, [loadProfile])

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser, setUser }),
    [user, loading, login, logout, refreshUser, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
