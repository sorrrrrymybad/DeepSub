# DeepSub Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 DeepSub 现有功能和路由的前提下，完成参考管理台风格的前端页面重构，支持 `auto + A/B/C` 三套主题、图标弹出菜单和设置页内部目录导航。

**Architecture:** 保留当前 `Vite + React + React Router + React Query + Tailwind` 架构，不调整 API 层与路由语义。通过新增主题状态层、统一 CSS 变量、重构全局 `Layout` 以及抽取页面级通用组件来实现整体换肤和信息层级重排。页面内部优先复用现有业务组件，避免改动接口和数据流。

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 3, React Router 7, @tanstack/react-query, i18next, Vitest, Testing Library

---

## 文件结构

```
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── test/
│   │   ├── setup.ts
│   │   └── renderWithProviders.tsx
│   ├── theme/
│   │   ├── ThemeProvider.tsx
│   │   ├── themeStorage.ts
│   │   ├── themeTypes.ts
│   │   └── ThemeProvider.test.tsx
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskLogDrawer.tsx
│   │   ├── SMBFileBrowser.tsx
│   │   ├── EngineSelector.tsx
│   │   ├── SettingsDirectory.tsx
│   │   ├── page/
│   │   │   ├── PageHero.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── SectionCard.tsx
│   │   │   ├── FilterTabs.tsx
│   │   │   └── EmptyState.tsx
│   │   └── atoms/
│   │       ├── Button.tsx
│   │       └── Badge.tsx
│   └── pages/
│       ├── TasksPage.tsx
│       ├── NewTaskPage.tsx
│       ├── SettingsPage.tsx
│       └── HistoryPage.tsx
└── docs/superpowers/
    ├── specs/2026-04-14-frontend-redesign-design.md
    └── plans/2026-04-14-frontend-redesign.md
```

### 文件职责

- `src/theme/*`：主题模式 `auto/a/b/c`、本地持久化、系统主题监听、向 `document.documentElement` 写入 `data-theme`。
- `src/index.css`：三套主题变量、全局背景、菜单浮层、页面级通用样式 token。
- `src/components/Layout.tsx`：侧栏、顶栏、语言菜单、主题菜单、移动端导航入口。
- `src/components/page/*`：hero、统计卡、分区卡、筛选标签、空态。
- `src/components/SettingsDirectory.tsx`：设置页内部目录、滚动定位、当前 section 高亮、移动端退化。
- `src/pages/*`：页面级信息重排，保持现有查询和提交逻辑。
- `src/test/*` 与 `*.test.tsx`：主题持久化、菜单交互、目录导航的前端回归测试。

---

### Task 1: 搭建测试基线与主题状态层

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/renderWithProviders.tsx`
- Create: `frontend/src/theme/themeTypes.ts`
- Create: `frontend/src/theme/themeStorage.ts`
- Create: `frontend/src/theme/ThemeProvider.tsx`
- Test: `frontend/src/theme/ThemeProvider.test.tsx`

- [ ] **Step 1: 为前端补上测试依赖**

```json
// frontend/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^26.0.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 配置 Vitest**

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

- [ ] **Step 3: 先写主题状态失败测试**

```tsx
// frontend/src/theme/ThemeProvider.test.tsx
it('defaults to auto and persists manual theme selection', async () => {
  render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
  expect(screen.getByText('auto')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'set-theme-a' }))
  expect(localStorage.getItem('deepsub:theme-mode')).toBe('a')
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- ThemeProvider.test.tsx`

Expected: FAIL，提示 `ThemeProvider` 或相关导出不存在

- [ ] **Step 5: 实现主题类型、存储和 Provider**

```ts
// frontend/src/theme/themeTypes.ts
export type ThemeMode = 'auto' | 'a' | 'b' | 'c'
export type ResolvedTheme = 'a' | 'b' | 'c'
```

```ts
// frontend/src/theme/themeStorage.ts
const STORAGE_KEY = 'deepsub:theme-mode'
export const loadThemeMode = (): ThemeMode => { /* localStorage 读取，默认 auto */ }
export const saveThemeMode = (mode: ThemeMode) => { /* localStorage 写入 */ }
```

```tsx
// frontend/src/theme/ThemeProvider.tsx
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 维护 mode、根据系统偏好解析 resolvedTheme
  // 向 document.documentElement 写入 data-theme / data-theme-mode
}
```

- [ ] **Step 6: 在入口挂载 ThemeProvider**

```tsx
// frontend/src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
```

- [ ] **Step 7: 再次运行主题测试确认通过**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- ThemeProvider.test.tsx`

Expected: PASS

- [ ] **Step 8: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/package.json frontend/vite.config.ts frontend/src/main.tsx frontend/src/test frontend/src/theme
git commit -m "feat: add frontend theme state and test setup"
```

---

### Task 2: 建立三主题 CSS Variables 与共用页面组件

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/atoms/Button.tsx`
- Modify: `frontend/src/components/atoms/Badge.tsx`
- Create: `frontend/src/components/page/PageHero.tsx`
- Create: `frontend/src/components/page/StatCard.tsx`
- Create: `frontend/src/components/page/SectionCard.tsx`
- Create: `frontend/src/components/page/FilterTabs.tsx`
- Create: `frontend/src/components/page/EmptyState.tsx`
- Test: `frontend/src/components/page/StatCard.test.tsx`

- [ ] **Step 1: 先写统计卡主题样式测试**

```tsx
// frontend/src/components/page/StatCard.test.tsx
it('renders title, value and tone class', () => {
  render(<StatCard title="Running" value="12" tone="accent" />)
  expect(screen.getByText('Running')).toBeInTheDocument()
  expect(screen.getByText('12')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- StatCard.test.tsx`

Expected: FAIL，提示 `StatCard` 不存在

- [ ] **Step 3: 把 Tailwind 颜色改成 CSS 变量映射**

```js
// frontend/tailwind.config.js
colors: {
  background: 'var(--color-background)',
  'on-background': 'var(--color-on-background)',
  surface: 'var(--color-surface)',
  'surface-soft': 'var(--color-surface-soft)',
  primary: 'var(--color-primary)',
  ...
}
```

- [ ] **Step 4: 在全局样式写三套主题 token**

```css
/* frontend/src/index.css */
:root[data-theme='a'] { --color-background: ... }
:root[data-theme='b'] { --color-background: ... }
:root[data-theme='c'] { --color-background: ... }
```

- [ ] **Step 5: 实现页面级通用组件**

```tsx
// frontend/src/components/page/StatCard.tsx
export default function StatCard({ title, value, tone = 'default', hint }: Props) {
  return <article className={`stat-card stat-card--${tone}`}>...</article>
}
```

```tsx
// frontend/src/components/page/PageHero.tsx
export default function PageHero({ eyebrow, title, description, actions, aside }: Props) { ... }
```

- [ ] **Step 6: 统一 Button / Badge 为新主题皮肤**

```tsx
// frontend/src/components/atoms/Button.tsx
const variants = {
  primary: 'btn btn--primary',
  secondary: 'btn btn--secondary',
  ghost: 'btn btn--ghost',
}
```

- [ ] **Step 7: 再次运行组件测试**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- StatCard.test.tsx`

Expected: PASS

- [ ] **Step 8: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/tailwind.config.js frontend/src/index.css frontend/src/components/atoms/Button.tsx frontend/src/components/atoms/Badge.tsx frontend/src/components/page
git commit -m "feat: add theme tokens and shared page components"
```

---

### Task 3: 重构全局 Layout 与图标弹出菜单

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/Layout.test.tsx`

- [ ] **Step 1: 先写 Layout 菜单交互失败测试**

```tsx
// frontend/src/components/Layout.test.tsx
it('opens theme menu and closes after selecting a theme', async () => {
  renderWithProviders(<Layout />)
  await user.click(screen.getByRole('button', { name: /theme/i }))
  expect(screen.getByRole('menu', { name: /theme/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- Layout.test.tsx`

Expected: FAIL，提示缺少主题按钮或菜单

- [ ] **Step 3: 重构 Layout 为管理台骨架**

```tsx
// frontend/src/components/Layout.tsx
// 侧栏：品牌、导航
// 顶栏：刷新、语言图标菜单、主题图标菜单
// 主区：统一容器和页面背景装饰
```

- [ ] **Step 4: 实现语言和主题的图标弹层菜单**

```tsx
// language menu
<button aria-haspopup="menu" aria-expanded={languageMenuOpen}>...</button>
{languageMenuOpen && <div role="menu">...</div>}
```

```tsx
// theme menu
{themeMenuOpen && (
  <div role="menu" aria-label="theme">
    <button>跟随系统</button>
    <button>A 暖灰玻璃</button>
    <button>B 深色运维</button>
    <button>C 白底企业</button>
  </div>
)}
```

- [ ] **Step 5: 加入点击外部关闭和切换后自动收起逻辑**

```tsx
useEffect(() => {
  if (!themeMenuOpen) return
  const handlePointerDown = (event: MouseEvent) => { ... }
}, [themeMenuOpen])
```

- [ ] **Step 6: 再次运行 Layout 测试**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- Layout.test.tsx`

Expected: PASS

- [ ] **Step 7: 运行构建验证 Layout 集成**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run build`

Expected: BUILD SUCCESS

- [ ] **Step 8: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/src/components/Layout.tsx frontend/src/App.tsx frontend/src/components/Layout.test.tsx
git commit -m "feat: redesign app shell with icon menus"
```

---

### Task 4: 重构 TasksPage、TaskCard 与 TaskLogDrawer

**Files:**
- Modify: `frontend/src/pages/TasksPage.tsx`
- Modify: `frontend/src/components/TaskCard.tsx`
- Modify: `frontend/src/components/TaskLogDrawer.tsx`
- Test: `frontend/src/pages/TasksPage.test.tsx`

- [ ] **Step 1: 先写 TasksPage 信息层级失败测试**

```tsx
// frontend/src/pages/TasksPage.test.tsx
it('renders hero, summary cards and task list together', async () => {
  render(<TasksPage />)
  expect(await screen.findByText(/全部任务/i)).toBeInTheDocument()
  expect(screen.getByText(/运行中/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- TasksPage.test.tsx`

Expected: FAIL，缺少 hero 或统计卡内容

- [ ] **Step 3: 把 TasksPage 改成准首页**

```tsx
// frontend/src/pages/TasksPage.tsx
// PageHero + 4 个 StatCard + FilterTabs + task list + pagination
```

- [ ] **Step 4: 将 TaskCard 改成新主题卡片**

```tsx
// frontend/src/components/TaskCard.tsx
// 卡片化容器、统一操作区、运行进度条和错误态
```

- [ ] **Step 5: 将 TaskLogDrawer 改成主题兼容抽屉**

```tsx
// frontend/src/components/TaskLogDrawer.tsx
// 增加遮罩、头部、滚动区和错误态皮肤
```

- [ ] **Step 6: 再次运行页面测试**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- TasksPage.test.tsx`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/src/pages/TasksPage.tsx frontend/src/components/TaskCard.tsx frontend/src/components/TaskLogDrawer.tsx frontend/src/pages/TasksPage.test.tsx
git commit -m "feat: turn tasks page into dashboard-style overview"
```

---

### Task 5: 重构 NewTaskPage、SMBFileBrowser 与 EngineSelector

**Files:**
- Modify: `frontend/src/pages/NewTaskPage.tsx`
- Modify: `frontend/src/components/SMBFileBrowser.tsx`
- Modify: `frontend/src/components/EngineSelector.tsx`
- Test: `frontend/src/pages/NewTaskPage.test.tsx`

- [ ] **Step 1: 先写 NewTaskPage 布局失败测试**

```tsx
// frontend/src/pages/NewTaskPage.test.tsx
it('renders smb selection, parameter section and selected file summary', async () => {
  render(<NewTaskPage />)
  expect(screen.getByText(/选择 SMB/i)).toBeInTheDocument()
  expect(screen.getByText(/已选文件/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- NewTaskPage.test.tsx`

Expected: FAIL

- [ ] **Step 3: 把 NewTaskPage 改成步骤感两栏布局**

```tsx
// frontend/src/pages/NewTaskPage.tsx
// 左侧：SMB + Browser
// 右侧：4 个参数块 + 已选文件摘要 + 提交按钮
```

- [ ] **Step 4: 重写 SMBFileBrowser 视觉层级**

```tsx
// frontend/src/components/SMBFileBrowser.tsx
// 目录头、文件列表、空态/错误态统一到 SectionCard 风格
```

- [ ] **Step 5: 重写 EngineSelector 为统一 field 样式**

```tsx
// frontend/src/components/EngineSelector.tsx
// 标签、说明、select 样式与全局 token 对齐
```

- [ ] **Step 6: 再次运行 NewTaskPage 测试**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- NewTaskPage.test.tsx`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/src/pages/NewTaskPage.tsx frontend/src/components/SMBFileBrowser.tsx frontend/src/components/EngineSelector.tsx frontend/src/pages/NewTaskPage.test.tsx
git commit -m "feat: redesign new task workflow page"
```

---

### Task 6: 重构 SettingsPage 与页面内设置目录

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/components/SettingsDirectory.tsx`
- Test: `frontend/src/components/SettingsDirectory.test.tsx`
- Test: `frontend/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 先写设置目录失败测试**

```tsx
// frontend/src/components/SettingsDirectory.test.tsx
it('renders section entries and marks the active section', () => {
  render(<SettingsDirectory sections={[...]} activeSection="smb" onSelect={() => {}} />)
  expect(screen.getByText('SMB 服务器')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- SettingsDirectory.test.tsx`

Expected: FAIL

- [ ] **Step 3: 实现 SettingsDirectory**

```tsx
// frontend/src/components/SettingsDirectory.tsx
// 桌面端左侧目录
// 移动端顶部 tabs / 目录栏
// 支持点击 section 锚点滚动
```

- [ ] **Step 4: 重构 SettingsPage 为目录 + 内容双栏**

```tsx
// frontend/src/pages/SettingsPage.tsx
// Overview -> SMB -> STT -> Translate
// 左侧目录，右侧多个 SectionCard
```

- [ ] **Step 5: 写页面级验证测试并运行**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- SettingsDirectory.test.tsx SettingsPage.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/src/pages/SettingsPage.tsx frontend/src/components/SettingsDirectory.tsx frontend/src/components/SettingsDirectory.test.tsx frontend/src/pages/SettingsPage.test.tsx
git commit -m "feat: add settings directory navigation"
```

---

### Task 7: 重构 HistoryPage、统一状态面板并完成验证

**Files:**
- Modify: `frontend/src/pages/HistoryPage.tsx`
- Modify: `frontend/src/components/page/EmptyState.tsx`
- Test: `frontend/src/pages/HistoryPage.test.tsx`
- Test: `frontend/src/components/Layout.test.tsx`
- Test: `frontend/src/theme/ThemeProvider.test.tsx`

- [ ] **Step 1: 先写历史页轻量归档失败测试**

```tsx
// frontend/src/pages/HistoryPage.test.tsx
it('renders archive summary and history list', async () => {
  render(<HistoryPage />)
  expect(await screen.findByText(/已完成任务归档/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test -- HistoryPage.test.tsx`

Expected: FAIL

- [ ] **Step 3: 重构 HistoryPage 与统一空态**

```tsx
// frontend/src/pages/HistoryPage.tsx
// 头部摘要 + 列表 + 分页
```

```tsx
// frontend/src/components/page/EmptyState.tsx
// 统一空态 / 错误态 / 重试按钮容器
```

- [ ] **Step 4: 运行完整前端测试**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run test`

Expected: PASS

- [ ] **Step 5: 运行生产构建验证**

Run: `cd /Users/dev/Documents/git/DeepSub/frontend && npm run build`

Expected: BUILD SUCCESS

- [ ] **Step 6: 手工验证**

Run:

```bash
cd /Users/dev/Documents/git/DeepSub/frontend
npm run dev
```

Expected:

- `Tasks` 页显示 hero、统计卡、筛选区和任务列表
- `New Task` 页为步骤感布局
- `Settings` 页存在页面内部目录
- 顶栏语言/主题图标按钮可弹出菜单
- 三主题可切换且刷新后保持
- 移动端宽度下页面退化为单列

- [ ] **Step 7: 提交**

```bash
cd /Users/dev/Documents/git/DeepSub
git add frontend/src/pages/HistoryPage.tsx frontend/src/components/page/EmptyState.tsx frontend/src/pages/HistoryPage.test.tsx
git commit -m "feat: finalize frontend redesign"
```

---

## 额外说明

- 当前仓库里还没有前端测试基线，因此计划第一步先补 Vitest 和 Testing Library。
- 主题实现必须以 CSS Variables 为中心，不要把 `A/B/C` 写成分散的硬编码类名判断。
- 实现时不要改动 API 调用签名，所有视觉重排都建立在现有查询逻辑之上。
- 提交步骤写在计划里是为了保证阶段边界清晰；实际执行前仍需遵守仓库规则，在你确认提交内容无误后再执行提交。

---

## 完成验证

实现完成后，至少保留以下证据：

- `npm run test` 的通过结果
- `npm run build` 的通过结果
- 主题切换、语言切换、设置目录和移动端退化的手工验证说明

