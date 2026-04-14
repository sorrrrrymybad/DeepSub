# Global Toast Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加全局 Toast 弹窗组件，在 header 右下方弹出，支持 info/success/error/warning 四种类型，带关闭按钮，3 秒后自动消失。

**Architecture:** 使用 React Context 模式，新建 `ToastContext.tsx` 提供 `ToastProvider` 和 `useToast` hook；`ToastProvider` 在 App 根层级包裹，在 DOM 中渲染 fixed 定位的 toast 列表；任意子组件通过 `useToast().show(message, type)` 触发。

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, @testing-library/react, vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/context/ToastContext.tsx` | 新建 | Toast 状态管理、Provider、useToast hook、Toast UI 渲染 |
| `frontend/src/context/ToastContext.test.tsx` | 新建 | ToastContext 单元测试 |
| `frontend/src/App.tsx` | 修改 | 添加 ToastProvider 包裹 |
| `frontend/src/test/renderWithProviders.tsx` | 修改 | 添加 ToastProvider 到测试工具 |

---

### Task 1: 创建 ToastContext

**Files:**
- Create: `frontend/src/context/ToastContext.tsx`

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/context/ToastContext.test.tsx`：

```tsx
import { screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'

function Trigger({ message, type }: { message: string; type?: 'info' | 'success' | 'error' | 'warning' }) {
  const { show } = useToast()
  return <button onClick={() => show(message, type ?? 'info')}>trigger</button>
}

function setup(type?: 'info' | 'success' | 'error' | 'warning') {
  return render(
    <ToastProvider>
      <Trigger message="测试消息" type={type} />
    </ToastProvider>
  )
}

describe('ToastContext', () => {
  it('点击触发后显示 toast 消息', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getByText('测试消息')).toBeInTheDocument()
  })

  it('点击关闭按钮后 toast 消失', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    await user.click(screen.getByRole('button', { name: /close|关闭/i }))
    expect(screen.queryByText('测试消息')).not.toBeInTheDocument()
  })

  it('3 秒后 toast 自动消失', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setup()
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getByText('测试消息')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    await waitFor(() => {
      expect(screen.queryByText('测试消息')).not.toBeInTheDocument()
    })
    vi.useRealTimers()
  })

  it('success 类型渲染正确', async () => {
    const user = userEvent.setup()
    setup('success')
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd frontend && npx vitest run src/context/ToastContext.test.tsx
```

预期：FAIL，模块不存在

- [ ] **Step 3: 实现 ToastContext**

新建 `frontend/src/context/ToastContext.tsx`：

```tsx
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
      {/* fixed 定位：header 高度约 98px，右上角 */}
      <div
        className="fixed right-4 top-[106px] z-40 flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={[
              'flex min-w-[260px] max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-card)]',
              'animate-in fade-in slide-in-from-right-4 duration-200',
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd frontend && npx vitest run src/context/ToastContext.test.tsx
```

预期：4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/ToastContext.tsx frontend/src/context/ToastContext.test.tsx
git commit -m "feat(toast): add ToastContext with provider and useToast hook"
```

---

### Task 2: 集成到 App

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/test/renderWithProviders.tsx`

- [ ] **Step 1: 修改 App.tsx，加入 ToastProvider**

在 `frontend/src/App.tsx` 中，在 `WebSocketProvider` 内层（或外层均可）加入 `ToastProvider`：

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import TasksPage from './pages/TasksPage'
import NewTaskPage from './pages/NewTaskPage'
import SettingsPage from './pages/SettingsPage'
import { WebSocketProvider } from './context/WebSocketContext'
import { ToastProvider } from './context/ToastContext'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/tasks" replace />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="tasks/new" element={<NewTaskPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: 修改 renderWithProviders.tsx，加入 ToastProvider**

```tsx
import { type ReactElement } from 'react'
import { render } from '@testing-library/react'
import { ToastProvider } from '../context/ToastContext'

export const renderWithProviders = (ui: ReactElement) =>
  render(<ToastProvider>{ui}</ToastProvider>)
```

- [ ] **Step 3: 运行全部测试，确认无回归**

```bash
cd frontend && npx vitest run
```

预期：所有测试 PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/test/renderWithProviders.tsx
git commit -m "feat(toast): integrate ToastProvider into App and test utils"
```

---

### Task 3: 验证

- [ ] **Step 1: 本地启动前端，手动验证**

在任一页面的浏览器控制台临时调用，或在某个组件里临时加一个测试按钮：

```ts
// 浏览器控制台无法直接调，需在组件内测试
// 临时在 TasksPage 顶部加一行：
const { show } = useToast()
// 然后加一个按钮：
<button onClick={() => show('保存成功', 'success')}>测试 Toast</button>
```

确认：
- toast 出现在右上角 header 下方
- 3 秒后自动消失
- 点 × 立即消失
- 四种类型颜色不同

- [ ] **Step 2: 移除临时测试代码**

- [ ] **Step 3: 最终测试**

```bash
cd frontend && npx vitest run
```

预期：全部 PASS
