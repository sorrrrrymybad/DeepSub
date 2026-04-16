# Whisper Model Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置页面 STT 区块增加模型状态检测和一键下载功能，下载时展示进度，模型已存在时给出提示。

**Architecture:** 后端新增两个接口——`GET /api/settings/stt/whisper/status` 检测模型是否已存在，`POST /api/settings/stt/whisper/download`（query param）触发后台线程下载并将进度写入 Redis；下载使用 `WhisperModel` 直接触发（无精确进度，固定显示 50% 过渡状态），完成后写 "done"；前端在 model_size 输入框旁展示状态 badge 和下载按钮，每秒轮询 status 接口更新；原有 `WhisperLocalEngine._load_model()` 自动下载逻辑保留不变。

**Tech Stack:** Python + FastAPI (Query param), threading.Thread, Redis (进度存储), React + TanStack Query v5 (轮询), i18next (中英文)

---

## 文件结构

| 文件 | 操作 | 说明 |
|---|---|---|
| `backend/worker/whisper_downloader.py` | 新建 | 模型存在检测、Redis 进度状态机、后台线程下载 |
| `backend/api/settings.py` | 修改 | 新增 `/stt/whisper/status` 和 `/stt/whisper/download` 两个路由（均用 Query param） |
| `frontend/src/api/settings.ts` | 修改 | 新增 `getWhisperStatus`、`postWhisperDownload`（均用 query string） |
| `frontend/src/i18n.ts` | 修改 | 新增中英文 whisper 相关 i18n key |
| `frontend/src/pages/SettingsPage.tsx` | 修改 | STT 区块增加状态 badge + 下载按钮 + 轮询逻辑 |

---

## Task 1: 后端 — whisper_downloader 模块

**Files:**
- Create: `backend/worker/whisper_downloader.py`

- [ ] **Step 1: 新建 `backend/worker/whisper_downloader.py`**

```python
"""Created by Sorrymybad."""
from __future__ import annotations

import threading

import redis as sync_redis

from core.config import settings

# Redis key 格式: whisper:download:<model_size>
# 值: "0" 初始, "50" 下载中, "done" 完成, "error:<msg>" 失败
_PROGRESS_TTL = 3600  # 1 hour


def _redis_key(model_size: str) -> str:
    return f"whisper:download:{model_size}"


def model_exists(model_size: str) -> bool:
    """检测本地模型是否已存在。

    faster-whisper 使用 huggingface_hub cache 格式，download_root 对应 cache_dir，
    目录结构为: <model_dir>/models--Systran--faster-whisper-<size>/snapshots/<hash>/model.bin
    """
    model_dir = settings.whisper_model_dir
    pattern = f"models--Systran--faster-whisper-{model_size}"
    target = model_dir / pattern
    return target.exists() and any(target.rglob("model.bin"))


def get_download_progress(model_size: str) -> dict:
    """返回当前下载状态。

    Returns:
        {
            "exists": bool,
            "downloading": bool,
            "progress": int | None,  # 0-100，仅 downloading=True 时有值
            "error": str | None,
        }
    """
    exists = model_exists(model_size)
    if exists:
        return {"exists": True, "downloading": False, "progress": None, "error": None}

    try:
        r = sync_redis.from_url(settings.redis_url)
        raw = r.get(_redis_key(model_size))
    except Exception:
        raw = None

    if raw is None:
        return {"exists": False, "downloading": False, "progress": None, "error": None}

    value = raw.decode() if isinstance(raw, bytes) else raw

    if value == "done":
        # 下载完成但 model_exists 还未检测到（极短暂的文件系统延迟）
        return {"exists": True, "downloading": False, "progress": 100, "error": None}
    if value.startswith("error:"):
        return {"exists": False, "downloading": False, "progress": None, "error": value[6:]}
    try:
        progress = int(value)
        return {"exists": False, "downloading": True, "progress": progress, "error": None}
    except ValueError:
        return {"exists": False, "downloading": False, "progress": None, "error": None}


def _download_worker(model_size: str) -> None:
    """在后台线程中执行模型下载，将进度写入 Redis。

    faster-whisper 不提供下载进度回调，使用固定进度状态：
    0 → 初始化, 50 → 下载中, done → 完成
    下载使用 WhisperModel(download_root=...) 保证与运行时加载路径完全一致。
    """
    key = _redis_key(model_size)
    try:
        r = sync_redis.from_url(settings.redis_url)
        r.set(key, "0", ex=_PROGRESS_TTL)

        from faster_whisper import WhisperModel

        r.set(key, "50", ex=_PROGRESS_TTL)
        # 使用与 WhisperLocalEngine._load_model() 完全相同的参数，
        # 保证下载路径和运行时缓存路径一致
        WhisperModel(model_size, download_root=str(settings.whisper_model_dir))

        r.set(key, "done", ex=_PROGRESS_TTL)

    except Exception as exc:
        try:
            r.set(key, f"error:{str(exc)[:200]}", ex=_PROGRESS_TTL)
        except Exception:
            pass


def start_download(model_size: str) -> bool:
    """启动后台下载线程。

    Returns:
        True 表示已启动，False 表示已在下载中（被 Redis 状态标记）。
    """
    status = get_download_progress(model_size)
    if status["downloading"]:
        return False

    t = threading.Thread(target=_download_worker, args=(model_size,), daemon=True)
    t.start()
    return True
```

- [ ] **Step 2: 提交**

```bash
git add backend/worker/whisper_downloader.py
git commit -m "feat: add whisper model downloader worker"
```

---

## Task 2: 后端 — 新增两个 API 路由

**Files:**
- Modify: `backend/api/settings.py`

- [ ] **Step 1: 在 `backend/api/settings.py` 顶部 import 行补充 `Query`**

找到：
```python
from fastapi import APIRouter, Depends
```
改为：
```python
from fastapi import APIRouter, Depends, Query
```

- [ ] **Step 2: 在文件末尾追加两个路由**

```python
# ---------------------------------------------------------------------------
# Whisper model management
# ---------------------------------------------------------------------------

@router.get("/stt/whisper/status")
def get_whisper_status(model_size: str = Query(default="base")):
    """检测指定模型是否已下载，以及当前下载进度。"""
    from worker.whisper_downloader import get_download_progress
    return get_download_progress(model_size)


@router.post("/stt/whisper/download")
def trigger_whisper_download(model_size: str = Query(...)):
    """触发后台下载指定模型（query param: model_size）。"""
    from worker.whisper_downloader import get_download_progress, start_download

    status = get_download_progress(model_size)
    if status["exists"]:
        return {"ok": False, "reason": "already_exists", **status}
    if status["downloading"]:
        return {"ok": False, "reason": "already_downloading", **status}

    start_download(model_size)
    return {"ok": True, "reason": "started", **get_download_progress(model_size)}
```

- [ ] **Step 3: 手动验证路由注册正确**

启动后端后访问 `http://localhost:8000/docs`，确认出现：
- `GET /api/settings/stt/whisper/status`
- `POST /api/settings/stt/whisper/download`

用 Swagger UI 分别测试两个接口返回正常 JSON。

- [ ] **Step 4: 提交**

```bash
git add backend/api/settings.py
git commit -m "feat: add whisper model status and download endpoints"
```

---

## Task 3: 前端 — API 客户端扩展

**Files:**
- Modify: `frontend/src/api/settings.ts`

- [ ] **Step 1: 将 `frontend/src/api/settings.ts` 替换为以下内容**

```typescript
import { client } from './client'

export interface WhisperStatus {
  exists: boolean
  downloading: boolean
  progress: number | null
  error: string | null
}

export const settingsApi = {
  getSystem: () => client.get('/settings/system').then(r => r.data),
  patchSystem: (data: Record<string, string>) => client.patch('/settings/system', data),
  getSTT: () => client.get('/settings/stt').then(r => r.data),
  patchSTT: (data: Record<string, string>) => client.patch('/settings/stt', data),
  getTranslate: () => client.get('/settings/translate').then(r => r.data),
  patchTranslate: (data: Record<string, string>) => client.patch('/settings/translate', data),
  // 均使用 query string，与后端 Query(...) 参数对应
  getWhisperStatus: (modelSize: string): Promise<WhisperStatus> =>
    client.get('/settings/stt/whisper/status', { params: { model_size: modelSize } }).then(r => r.data),
  postWhisperDownload: (modelSize: string): Promise<{ ok: boolean; reason: string } & WhisperStatus> =>
    client.post('/settings/stt/whisper/download', null, { params: { model_size: modelSize } }).then(r => r.data),
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/api/settings.ts
git commit -m "feat: add whisper status and download api client methods"
```

---

## Task 4: 前端 — i18n 文案

**Files:**
- Modify: `frontend/src/i18n.ts`

- [ ] **Step 1: 在英文语言包 `en.translation.settings` 的末尾（`}` 前）新增 `whisper` 字段**

位置在 `fields: { ... },` 之后：

```typescript
whisper: {
  statusChecking: "Checking...",
  statusExists: "Downloaded",
  statusMissing: "Not downloaded",
  statusDownloading: "Downloading {{progress}}%",
  statusError: "Error",
  btnDownload: "Download",
  btnDownloading: "Downloading...",
  alreadyExists: "Model already downloaded",
  downloadStarted: "Download started",
  downloadError: "Download failed: {{msg}}",
},
```

- [ ] **Step 2: 在中文语言包 `zh.translation.settings` 的末尾（`}` 前）新增 `whisper` 字段**

```typescript
whisper: {
  statusChecking: "检测中...",
  statusExists: "已下载",
  statusMissing: "未下载",
  statusDownloading: "下载中 {{progress}}%",
  statusError: "出错",
  btnDownload: "下载模型",
  btnDownloading: "下载中...",
  alreadyExists: "模型已存在",
  downloadStarted: "已开始下载",
  downloadError: "下载失败：{{msg}}",
},
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/i18n.ts
git commit -m "feat: add i18n keys for whisper model download ui"
```

---

## Task 5: 前端 — SettingsPage STT 区块改造

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: 在 `SettingsPage` 组件内，`sttData` 查询下方新增 whisper 状态轮询和下载处理逻辑**

找到：
```typescript
const { data: sttData } = useQuery({ queryKey: ['settings-stt'], queryFn: settingsApi.getSTT })
```

在其下方插入：

```typescript
// 取当前 model_size：优先用用户正在编辑的值，fallback 到已保存值
const currentModelSize = sttForm['whisper_local_model_size'] ?? sttData?.['whisper_local_model_size'] ?? 'base'

const { data: whisperStatus, refetch: refetchWhisperStatus } = useQuery({
  queryKey: ['whisper-status', currentModelSize],
  queryFn: () => settingsApi.getWhisperStatus(currentModelSize),
  // TanStack Query v5: refetchInterval 函数接收 Query 对象
  refetchInterval: (query) => {
    const data = query.state.data
    if (data?.downloading) return 1000  // 下载中每秒轮询
    return false                         // 其他状态停止轮询
  },
  enabled: !!currentModelSize,
})

const [isSubmittingDownload, setIsSubmittingDownload] = useState(false)

const handleWhisperDownload = async () => {
  if (isSubmittingDownload || whisperStatus?.downloading) return
  setIsSubmittingDownload(true)
  try {
    const result = await settingsApi.postWhisperDownload(currentModelSize)
    if (result.reason === 'already_exists') {
      show(t('settings.whisper.alreadyExists'), 'success')
    } else if (result.ok) {
      show(t('settings.whisper.downloadStarted'), 'success')
    } else if (result.error) {
      show(t('settings.whisper.downloadError', { msg: result.error }), 'error')
    }
  } catch (e: unknown) {
    show(e instanceof Error ? e.message : t('common.error'), 'error')
  } finally {
    setIsSubmittingDownload(false)
    // POST 返回后立即刷新状态，触发轮询（若 downloading=true 则自动开始）
    void refetchWhisperStatus()
  }
}
```

- [ ] **Step 2: 替换 STT 区块的 `ConfigFieldsSection` 为自定义渲染**

找到现有代码：
```tsx
<section ref={sectionRefs.stt} className="scroll-mt-[122px]">
  <SectionCard
    eyebrow="Speech"
    title={t('settings.sttTitle')}
    description={t('settings.sttDesc')}
    actions={<Button variant="secondary" onClick={handleSaveSTT}>{t('settings.commitStt')}</Button>}
  >
    <ConfigFieldsSection
      fields={sttFields}
      values={{ ...(sttData ?? {}), ...sttForm } as Record<string, string>}
      onChange={(key, value) => setSttForm((current) => ({ ...current, [key]: value }))}
    />
  </SectionCard>
</section>
```

替换为：

```tsx
<section ref={sectionRefs.stt} className="scroll-mt-[122px]">
  <SectionCard
    eyebrow="Speech"
    title={t('settings.sttTitle')}
    description={t('settings.sttDesc')}
    actions={<Button variant="secondary" onClick={handleSaveSTT}>{t('settings.commitStt')}</Button>}
  >
    <div className="grid gap-4 md:grid-cols-2">
      {/* Whisper Local — 带状态 badge 和下载按钮 */}
      <div>
        <label
          htmlFor="whisper_local_model_size"
          className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
        >
          {t('settings.fields.whisperLocal')}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="whisper_local_model_size"
            type="text"
            value={sttForm['whisper_local_model_size'] ?? sttData?.['whisper_local_model_size'] ?? ''}
            onChange={(e) => setSttForm((current) => ({ ...current, whisper_local_model_size: e.target.value }))}
            autoComplete="off"
            className="flex-1 rounded-2xl px-4 py-3 text-sm"
          />
          {/* 状态 badge */}
          {(() => {
            if (!whisperStatus) return (
              <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-surface-container text-on-surface-variant">
                {t('settings.whisper.statusChecking')}
              </span>
            )
            if (whisperStatus.downloading) return (
              <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-primary/10 text-primary">
                {t('settings.whisper.statusDownloading', { progress: whisperStatus.progress ?? 0 })}
              </span>
            )
            if (whisperStatus.exists) return (
              <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-success,#22c55e)]/10 text-[var(--color-success,#22c55e)]">
                {t('settings.whisper.statusExists')}
              </span>
            )
            if (whisperStatus.error) return (
              <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-error-container text-on-error-container">
                {t('settings.whisper.statusError')}
              </span>
            )
            return (
              <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-surface-container text-on-surface-variant">
                {t('settings.whisper.statusMissing')}
              </span>
            )
          })()}
          {/* 下载按钮：已存在或下载中时禁用 */}
          <button
            type="button"
            onClick={() => void handleWhisperDownload()}
            disabled={isSubmittingDownload || whisperStatus?.downloading || whisperStatus?.exists}
            className="shrink-0 inline-flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {(isSubmittingDownload || whisperStatus?.downloading)
              ? t('settings.whisper.btnDownloading')
              : t('settings.whisper.btnDownload')}
          </button>
        </div>
      </div>
      {/* OpenAI Whisper API Key — 保持原有渲染 */}
      <FormField
        id="openai_whisper_api_key"
        label={t('settings.fields.openaiWhisper')}
        type="password"
        value={sttForm['openai_whisper_api_key'] ?? sttData?.['openai_whisper_api_key'] ?? ''}
        onChange={(value) => setSttForm((current) => ({ ...current, openai_whisper_api_key: value }))}
      />
    </div>
  </SectionCard>
</section>
```

- [ ] **Step 3: 在浏览器中验证**

1. 打开设置页，滚动到 ASR 区块
2. 输入 `base`，badge 显示「未下载」或「已下载」
3. 若未下载，点击「下载模型」，toast 提示「已开始下载」，badge 切换为「下载中 50%」
4. 下载完成后 badge 变为绿色「已下载」，按钮变灰不可点
5. 修改 model_size 输入值，badge 立即切换为「检测中...」并重新查询新模型状态
6. 切换语言，所有文案正确显示

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add whisper model status badge and download button to STT settings"
```

---

## Task 6: 验收检查

- [ ] **Step 1: 确认原有任务流程未受影响**

  `WhisperLocalEngine._load_model()` 代码未改动，任务运行时若模型不存在仍会自动下载，行为不变。

- [ ] **Step 2: 确认 POST 端点 query param 正常解析**

  用 curl 测试：
  ```bash
  curl -X POST "http://localhost:8000/api/settings/stt/whisper/download?model_size=base"
  ```
  应返回 `{"ok": true/false, "reason": "...", "exists": ..., ...}`，不出现 422 错误。

- [ ] **Step 3: 确认下载完成后 `model_exists()` 检测正确**

  下载完 `base` 后检查目录：
  ```bash
  ls data/whisper-models/models--Systran--faster-whisper-base/snapshots/
  # 应存在 <hash>/ 子目录，其中含 model.bin
  ```
  此时 `GET /api/settings/stt/whisper/status?model_size=base` 应返回 `exists: true`。
