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
  success: 'border-green-500/40 bg-green-500/40 text-on-primary-container',
  error: 'border-red-500/40 bg-red-500/40 text-on-primary-container',
  warning: 'border-yellow-500/40 bg-yellow-500/40 text-on-primary-container',
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [entering, setEntering] = useState<Set<number>>(new Set())
  const [leaving, setLeaving] = useState<Set<number>>(new Set())
  const autoTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const leaveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const remove = useCallback((id: number) => {
    clearTimeout(autoTimers.current.get(id))
    clearTimeout(leaveTimers.current.get(id))
    autoTimers.current.delete(id)
    leaveTimers.current.delete(id)
    setLeaving((prev) => { const next = new Set(prev); next.delete(id); return next })
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismiss = useCallback((id: number) => {
    // 先触发飞出动画，300ms 后再从列表移除
    clearTimeout(autoTimers.current.get(id))
    autoTimers.current.delete(id)
    setLeaving((prev) => new Set(prev).add(id))
    const t = setTimeout(() => remove(id), 300)
    leaveTimers.current.set(id, t)
  }, [remove])

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId++
      // 先标记为 entering（右侧偏移），下一帧移除标记触发飞入动画
      setEntering((prev) => new Set(prev).add(id))
      setToasts((prev) => [{ id, message, type }, ...prev])
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEntering((prev) => { const next = new Set(prev); next.delete(id); return next })
        })
      })
      const timer = setTimeout(() => dismiss(id), 5000)
      autoTimers.current.set(id, timer)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed right-4 top-[106px] z-40 flex flex-col gap-2 overflow-hidden" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            style={{ transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s' }}
            className={[
              'flex min-w-[260px] max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-card)]',
              TYPE_STYLES[toast.type],
              entering.has(toast.id) || leaving.has(toast.id) ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100',
            ].join(' ')}
          >
            <p className="flex-1 text-sm font-semibold leading-snug">{toast.message}</p>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
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
