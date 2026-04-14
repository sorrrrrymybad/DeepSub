import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  show: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ show: () => {} })

const TYPE_STYLES: Record<ToastType, string> = {
  info: 'border-primary bg-primary-container text-on-primary-container',
  success: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
}

const TYPE_ICONS: Record<ToastType, string> = {
  info: 'ℹ',
  success: '✓',
  error: '✕',
  warning: '⚠',
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId++
      setToasts((prev) => [{ id, message, type }, ...prev])
      const timer = setTimeout(() => dismiss(id), 3000)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* fixed 定位：header 高度约 98px，右上角偏下 */}
      <div className="fixed right-4 top-[106px] z-40 flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              'flex min-w-[260px] max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-card)]',
              TYPE_STYLES[toast.type],
            ].join(' ')}
          >
            <span className="mt-0.5 shrink-0 text-sm font-bold" aria-hidden>
              {TYPE_ICONS[toast.type]}
            </span>
            <p className="flex-1 text-sm font-semibold leading-snug">{toast.message}</p>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => dismiss(toast.id)}
              className="mt-0.5 shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
