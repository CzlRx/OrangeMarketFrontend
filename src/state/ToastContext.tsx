import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  leaving?: boolean
}

interface ToastValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used within ToastProvider')
  return value
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<number[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
      window.setTimeout(() => remove(id), 220)
    },
    [remove],
  )

  const toast = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts((prev) => [...prev.slice(-2), { id, kind, message }])
      const timer = window.setTimeout(() => dismiss(id), 3200)
      timers.current.push(timer)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((item) => {
          const Icon = icons[item.kind]
          return (
            <div
              className={`toast toast-${item.kind}${item.leaving ? ' leaving' : ''}`}
              key={item.id}
              onClick={() => dismiss(item.id)}
            >
              <Icon size={17} />
              <span>{item.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
