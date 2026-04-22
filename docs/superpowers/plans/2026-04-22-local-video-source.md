# Local Video Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留 SMB 来源的同时，新增容器内本地目录视频来源，允许用户直接浏览并提交本地视频任务，处理时跳过上传并把字幕写回原目录。

**Architecture:** 继续复用现有 `tasks`、worker、任务中心和新建任务页，只在任务模型上新增 `source_type` 并把 `smb_server_id` 改为可空。后端新增本地目录浏览 API，worker 根据 `source_type` 在“准备输入视频”和“写回字幕”两个阶段分支执行；中间字幕提取、STT、翻译和日志流程保持不变。由于当前使用 SQLite + `Base.metadata.create_all()`，必须补一段轻量运行时 schema migration，把旧版 `tasks` 表重建为支持 `source_type` 和可空 `smb_server_id` 的结构。

**Tech Stack:** FastAPI / SQLAlchemy / SQLite / Celery / React 19 / TanStack Query / Vitest / pytest

**Spec:** `docs/superpowers/specs/2026-04-22-local-video-source-design.md`

---

## 文件清单

**新增**

- `backend/core/schema_migrations.py`
- `backend/api/local_files.py`
- `backend/tests/test_tmp_tasks_schema_migration.py`（临时测试，验证后删除）
- `backend/tests/test_tmp_local_files_api.py`（临时测试，验证后删除）
- `backend/tests/test_tmp_local_task_api.py`（临时测试，验证后删除）
- `backend/tests/test_tmp_local_worker_paths.py`（临时测试，验证后删除）
- `frontend/src/api/localFiles.ts`
- `frontend/src/components/LocalFileBrowser.tsx`

**修改**

- `backend/main.py`
- `backend/models/task.py`
- `backend/schemas/task.py`
- `backend/api/tasks.py`
- `backend/worker/subtitle_task.py`
- `frontend/src/api/tasks.ts`
- `frontend/src/pages/NewTaskPage.tsx`
- `frontend/src/pages/NewTaskPage.test.tsx`
- `frontend/src/components/TaskCard.tsx`
- `frontend/src/i18n.ts`
- `README.md`

**不修改**

- SMB 设置页结构
- 定时任务调度链路
- 翻译 / STT 引擎实现

---

## 关键约束

- 现有 SQLite 库必须可平滑启动，不能要求用户手工删库。
- 本地来源允许浏览容器内任意路径，但只读。
- 本地来源任务一律写回原视频同目录，命名规则保持 `原文件名.<目标语言>.srt`。
- 不引入 Alembic；使用当前项目风格的轻量运行时迁移。
- 临时测试文件按用户要求在验证完成后删除，不保留在最终工作树中。
- 不自动 `git commit`、不自动 `git push`。

---

## Task 1: 运行时迁移 `tasks` 表结构

**Files:**
- Create: `backend/core/schema_migrations.py`
- Modify: `backend/main.py`
- Modify: `backend/models/task.py`
- Test: `backend/tests/test_tmp_tasks_schema_migration.py`

- [ ] **Step 1: 写失败测试，覆盖旧版 `tasks` 表迁移到新结构**

```python
def test_migrate_tasks_table_adds_source_type_and_nullable_smb_server_id(tmp_path):
    # 创建旧结构 tasks 表：无 source_type，且 smb_server_id NOT NULL
    ...
    run_schema_migrations(engine)
    columns = read_task_columns(engine)
    assert columns["source_type"]["notnull"] == 0
    assert columns["smb_server_id"]["notnull"] == 0
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `cd backend && pytest backend/tests/test_tmp_tasks_schema_migration.py -v`
Expected: FAIL，表现为 `source_type` 缺失或 `smb_server_id` 仍为非空。

- [ ] **Step 3: 实现迁移 helper**

```python
def run_schema_migrations(engine):
    ensure_tasks_table_supports_source_types(engine)
```

实现要点：
- 检查 `tasks` 表列定义
- 若缺少 `source_type` 或 `smb_server_id` 仍为 `NOT NULL`，则重建表：
  - 创建 `tasks_new`
  - 拷贝旧数据并把 `source_type` 回填为 `'smb'`
  - 删除旧表并重命名

- [ ] **Step 4: 在 `lifespan()` 中把迁移放在 `Base.metadata.create_all()` 之后执行**

```python
Base.metadata.create_all(bind=engine)
run_schema_migrations(engine)
```

- [ ] **Step 5: 更新 ORM 模型，加入 `source_type` 并允许 `smb_server_id` 为空**

```python
source_type: Mapped[str] = mapped_column(String, default="smb")
smb_server_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

- [ ] **Step 6: 重新运行测试，确认通过**

Run: `cd backend && pytest backend/tests/test_tmp_tasks_schema_migration.py -v`
Expected: PASS。

- [ ] **Step 7: 删除临时测试文件**

Run: `rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_tasks_schema_migration.py`

---

## Task 2: 扩展任务 schema 与创建接口校验

**Files:**
- Modify: `backend/schemas/task.py`
- Modify: `backend/api/tasks.py`
- Test: `backend/tests/test_tmp_local_task_api.py`

- [ ] **Step 1: 写失败测试，覆盖 `smb` / `local` 任务创建校验**

```python
def test_create_local_tasks_without_smb_server_id(client):
    resp = client.post("/api/tasks", json={
        "source_type": "local",
        "file_paths": ["/mnt/videos/demo.mp4"],
        "target_lang": "zh",
        "stt_engine": "whisper_local",
        "translate_engine": "deeplx",
    })
    assert resp.status_code == 201

def test_reject_local_tasks_with_smb_server_id(client):
    ...
    assert resp.status_code == 400
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `cd backend && pytest backend/tests/test_tmp_local_task_api.py -v`
Expected: FAIL，当前 schema 不接受 `source_type` 或错误放行非法字段组合。

- [ ] **Step 3: 在 `TaskCreate` / `TaskResponse` 中加入 `source_type`**

```python
class TaskCreate(BaseModel):
    source_type: str = "smb"
    smb_server_id: int | None = None
```

- [ ] **Step 4: 在 schema 层加组合校验**

校验规则：
- `source_type` 只允许 `smb` / `local`
- `smb` 必须带 `smb_server_id`
- `local` 不允许带 `smb_server_id`
- `local` 的 `file_paths` 必须为绝对路径

- [ ] **Step 5: 更新 `create_tasks()`，正确保存 `source_type` 和可空 `smb_server_id`**

```python
task = Task(
    source_type=data.source_type,
    smb_server_id=data.smb_server_id,
    ...
)
```

- [ ] **Step 6: 确保返回体、列表和详情都能返回 `source_type`**

Run: `cd backend && pytest backend/tests/test_tmp_local_task_api.py -v`
Expected: PASS。

- [ ] **Step 7: 删除临时测试文件**

Run: `rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_local_task_api.py`

---

## Task 3: 新增本地目录浏览 API

**Files:**
- Create: `backend/api/local_files.py`
- Modify: `backend/main.py`
- Test: `backend/tests/test_tmp_local_files_api.py`

- [ ] **Step 1: 写失败测试，覆盖目录列出与异常路径**

```python
def test_browse_local_directory_returns_files_and_dirs(client, tmp_path):
    ...
    resp = client.get("/api/local-files/browse", params={"path": str(tmp_path)})
    assert resp.status_code == 200
    assert resp.json() == [...]

def test_browse_local_directory_rejects_non_directory(client, tmp_path):
    ...
    assert resp.status_code == 400
```

- [ ] **Step 2: 运行测试，确认接口不存在而失败**

Run: `cd backend && pytest backend/tests/test_tmp_local_files_api.py -v`
Expected: FAIL，返回 `404`。

- [ ] **Step 3: 新建 `local_files` 路由**

```python
router = APIRouter(prefix="/api/local-files", tags=["local-files"])

@router.get("/browse")
def browse_local_directory(path: str = "/"):
    ...
```

实现要点：
- 使用 `pathlib.Path`
- 校验存在、可访问、且为目录
- 返回 `name`、`is_dir`、`size`
- 只列一层，不递归

- [ ] **Step 4: 在 `backend/main.py` 注册新路由**

```python
from api.local_files import router as local_files_router
app.include_router(local_files_router)
```

- [ ] **Step 5: 重新运行测试，确认通过**

Run: `cd backend && pytest backend/tests/test_tmp_local_files_api.py -v`
Expected: PASS。

- [ ] **Step 6: 删除临时测试文件**

Run: `rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_local_files_api.py`

---

## Task 4: 让 worker 支持本地来源输入与本地字幕写回

**Files:**
- Modify: `backend/worker/subtitle_task.py`
- Test: `backend/tests/test_tmp_local_worker_paths.py`

- [ ] **Step 1: 写失败测试，覆盖本地来源路径准备与输出路径计算**

```python
def test_prepare_source_video_copies_local_file_to_tmp(tmp_path):
    ...
    assert prepared_path.exists()

def test_write_output_subtitle_skips_existing_local_srt_when_overwrite_false(tmp_path):
    ...
    assert existing_content == original_content
```

- [ ] **Step 2: 运行测试，确认当前失败**

Run: `cd backend && pytest backend/tests/test_tmp_local_worker_paths.py -v`
Expected: FAIL，当前 worker 仅支持 SMB。

- [ ] **Step 3: 在 worker 中抽出 `prepare_source_video()`**

```python
def prepare_source_video(task, db, tmp_dir, task_logger):
    if task.source_type == "smb":
        ...
    if task.source_type == "local":
        ...
```

本地分支要求：
- 校验文件存在
- 校验为文件
- 校验扩展名受支持
- 复制到 `tmp/task_id/video.xxx`

- [ ] **Step 4: 抽出 `write_output_subtitle()`**

```python
def write_output_subtitle(task, client, tmp_dir, segments, task_logger):
    ...
```

本地分支要求：
- 直接写到原视频目录
- `overwrite=false` 时存在则跳过
- 日志记录目标路径

- [ ] **Step 5: 在主流程中按 `source_type` 调整日志和进度文案**

保持进度区间：
- 准备视频 `5 -> 20`
- 中间处理 `20 -> 95`
- 写回 `95 -> 100`

- [ ] **Step 6: 重新运行测试，确认通过**

Run: `cd backend && pytest backend/tests/test_tmp_local_worker_paths.py -v`
Expected: PASS。

- [ ] **Step 7: 删除临时测试文件**

Run: `rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_local_worker_paths.py`

---

## Task 5: 前端新增来源切换与本地文件浏览器

**Files:**
- Create: `frontend/src/api/localFiles.ts`
- Create: `frontend/src/components/LocalFileBrowser.tsx`
- Modify: `frontend/src/api/tasks.ts`
- Modify: `frontend/src/pages/NewTaskPage.tsx`
- Modify: `frontend/src/pages/NewTaskPage.test.tsx`
- Modify: `frontend/src/i18n.ts`

- [ ] **Step 1: 先改现有 `NewTaskPage.test.tsx`，加入本地来源渲染与提交用例**

```tsx
it('switches to local source and hides smb selector', async () => {
  ...
  expect(screen.queryByLabelText(/SMB Server|SMB 服务器/i)).not.toBeInTheDocument()
})
```

```tsx
it('submits local tasks without smb_server_id', async () => {
  ...
  expect(tasksApi.create).toHaveBeenCalledWith(expect.objectContaining({
    source_type: 'local',
    file_paths: ['/mnt/videos/movie.mp4'],
  }))
})
```

- [ ] **Step 2: 运行前端单测，确认当前失败**

Run: `cd frontend && npm test -- --runInBand src/pages/NewTaskPage.test.tsx`
Expected: FAIL，页面还没有来源切换和本地 API。

- [ ] **Step 3: 增加本地文件 API 封装与浏览组件**

```ts
export const localFilesApi = {
  browse: (path: string) => client.get('/local-files/browse', { params: { path } })
}
```

组件要求：
- 交互尽量对齐 `SMBFileBrowser`
- 支持排序、返回、全选、取消全选
- 只允许选择视频文件

- [ ] **Step 4: 扩展 `tasksApi` 的 payload 类型**

```ts
export interface CreateTasksPayload {
  source_type: 'smb' | 'local'
  smb_server_id?: number
  ...
}
```

- [ ] **Step 5: 改造 `NewTaskPage`**

要求：
- 新增来源类型 state
- `smb` 时显示 SMB 服务器和 `SMBFileBrowser`
- `local` 时显示 `LocalFileBrowser`
- 切换来源时清空已选文件
- 本地提交不带 `smb_server_id`
- 错误提示按来源区分

- [ ] **Step 6: 补充中英文文案**

包括：
- 来源类型标题
- `SMB`
- `本地目录`
- 本地来源空状态和提交错误提示

- [ ] **Step 7: 重新运行测试，确认通过**

Run: `cd frontend && npm test -- --runInBand src/pages/NewTaskPage.test.tsx`
Expected: PASS。

---

## Task 6: 任务卡片来源标识、README 与全量验证

**Files:**
- Modify: `frontend/src/components/TaskCard.tsx`
- Modify: `frontend/src/i18n.ts`
- Modify: `README.md`

- [ ] **Step 1: 给 `TaskCard` 增加来源标识展示**

```tsx
<Badge variant="neutral">{task.source_type === 'local' ? 'LOCAL' : 'SMB'}</Badge>
```

- [ ] **Step 2: 在 README 增加 Docker 挂载说明**

文档必须说明：
- 需要把宿主机视频目录同时挂到 `backend` 和 `worker`
- 挂载后的容器路径必须一致
- 示例：`/data/videos:/mnt/videos`

- [ ] **Step 3: 运行后端验证**

Run: `cd backend && pytest -q`
Expected: 现有测试和临时验证全部通过；若因临时测试已删除导致无用例，至少保证命令退出码为 `0`。

- [ ] **Step 4: 运行前端验证**

Run: `cd frontend && npm test`
Expected: PASS。

- [ ] **Step 5: 运行前端构建验证**

Run: `cd frontend && npm run build`
Expected: PASS。

- [ ] **Step 6: 手工验证本地来源链路**

1. 在 `docker-compose.yml` 对应环境中，把视频目录挂到 `backend` 和 `worker`
2. 打开“新建任务”，切换到“本地目录”
3. 浏览 `/mnt/videos`，选中视频并提交
4. 在任务中心确认出现 `LOCAL` 标识
5. 任务完成后确认同目录出现 `*.zh.srt`
6. 用现有 SMB 来源再提一次任务，确认未回归

- [ ] **Step 7: 清理所有临时测试文件并复查工作树**

Run:
```bash
rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_tasks_schema_migration.py
rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_local_files_api.py
rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_local_task_api.py
rm -f /Users/dev/Documents/git/DeepSub/backend/tests/test_tmp_local_worker_paths.py
git status --short
```

Expected:
- 不再存在上述临时测试文件
- 工作树只保留正式代码与文档改动

---

## 实施顺序说明

推荐严格按以下顺序执行：

1. 先做 schema migration，确保旧库可启动
2. 再做任务 schema / API 校验，确保数据能写入
3. 再做本地目录浏览 API
4. 再接 worker 本地来源分支
5. 最后改前端与文档

不要先改前端。前端先落地会掩盖后端 schema 和 worker 分支的真实阻塞点。

---

## 完成定义

满足以下条件才算完成：

- 旧数据库启动后自动迁移 `tasks` 表成功
- `POST /api/tasks` 同时支持 `smb` 和 `local`
- `GET /api/local-files/browse` 可读浏览容器路径
- 本地视频任务不走上传，字幕写回原目录
- 新建任务页可切换来源并正确提交
- 任务中心能区分 `SMB` / `LOCAL`
- README 已说明 Docker 挂载方式
- 所有临时测试文件已删除
