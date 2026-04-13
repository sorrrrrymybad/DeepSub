# DeepSub 设计文档

**日期：** 2026-04-13
**作者：** Sorrymybad
**状态：** 已批准

---

## 概述

DeepSub 是一个视频字幕自动翻译工具，从 SMB 网络存储中读取视频文件，提取或生成字幕，翻译为目标语言后将 SRT 文件写回原目录。提供可视化 Web 管理界面，支持批量处理、任务管理和定时扫描。

**安全前提：** 本工具设计为内网部署，不对公网暴露，当前版本无用户认证机制。

---

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 后端 API | Python + FastAPI |
| 任务队列 | Celery + Redis |
| 定时调度 | Celery Beat |
| 数据库 | SQLite（默认），可切换 PostgreSQL |
| 前端 | React（单页应用） |
| 视频处理 | ffmpeg / ffprobe |
| SMB 连接 | smbprotocol |
| 实时通信 | WebSocket |
| 部署 | Docker Compose（测试阶段直接本地运行） |

---

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    Docker Compose                    │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │ Frontend │   │ Backend  │   │  Celery Worker   │ │
│  │ (React)  │──▶│(FastAPI) │──▶│  (任务处理引擎)   │ │
│  └──────────┘   └──────────┘   └──────────────────┘ │
│                      │                  │            │
│                 ┌────▼────┐    ┌────────▼────────┐  │
│                 │  Redis  │    │   SMB 流式读取   │  │
│                 │(队列+缓存)│   │   视频文件       │  │
│                 └─────────┘   └─────────────────┘   │
│                      │                              │
│                 ┌────▼─────┐                        │
│                 │  SQLite  │                        │
│                 └──────────┘                        │
└─────────────────────────────────────────────────────┘
```

前端通过 WebSocket 接收实时任务进度更新。Nginx 同时托管前端静态文件并反向代理后端 API，对外只暴露单一端口（默认 3000）。

---

## 核心处理流程

**支持的视频格式：** MKV、MP4、AVI、TS、MOV（以 ffprobe 能识别为准；AVI 内嵌字幕支持有限）。

```
视频文件
    │
    ▼
1. ffprobe 检测内置字幕轨道
    │
    ├── 有内置字幕 ──▶ ffmpeg 提取字幕文本
    │                  轨道选择规则：
    │                  · 优先匹配源语言标签的完整字幕轨道
    │                  · 多条相同语言时排除 forced 轨道，选第一条
    │                  · 无语言标签（und/空）时默认选第一条字幕轨道
    │
    └── 无内置字幕 ──▶ 2. STT 音频转文字
                            · 本地 Faster-Whisper
                            · OpenAI Whisper API
                       （用户在设置中选择）
    │
    ▼
3. 检查目标 SRT 文件是否已存在
    · 默认策略：跳过（不覆盖）
    · 可在创建任务时选择：覆盖
    │
    ▼
4. 翻译引擎（用户可配置）
    · DeepLX
    · DeepL 官方 API
    · Google Translate
    · OpenAI / Claude LLM
    字幕按段落分批翻译，避免单次 API 调用超长
    │
    ▼
5. 生成 SRT 文件
   写回 SMB 原目录
   命名：原文件名.目标语言.srt（示例：movie.zh.srt）
```

**批量任务隔离策略：** 每个文件生成独立的 task 记录，单文件失败不影响其他文件继续处理。

**STT 和翻译引擎**均通过统一接口抽象，切换引擎不影响主流程。

**SMB 中断处理：** 视频文件先下载到本地临时目录再处理；SMB 中断导致下载失败时任务标记为 failed，支持手动重试。

---

## 数据模型

### smb_servers（SMB 服务器）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | |
| name | string | 显示名称 |
| host | string | 主机地址 |
| port | integer | 默认 445 |
| share | string | 顶级共享名 |
| domain | string | Windows 域（可空） |
| username | string | 认证用户名 |
| password | string | Fernet 加密存储，GET 接口不返回该字段 |
| created_at | datetime | |

### tasks（翻译任务）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | |
| smb_server_id | integer FK | |
| file_path | string | SMB 路径（含子目录） |
| status | enum | pending/running/done/failed/cancelled |
| source_lang | string | 源语言（auto 表示自动检测）|
| target_lang | string | 目标语言 |
| stt_engine | string | STT 引擎标识 |
| translate_engine | string | 翻译引擎标识 |
| overwrite | boolean | 是否覆盖已存在的 SRT 文件，默认 false |
| progress | integer | 0-100 |
| error_message | string | 失败原因摘要（可空）|
| celery_task_id | string | Celery 任务 ID，用于取消操作 |
| retry_count | integer | 已重试次数，默认 0 |
| started_at | datetime | 任务开始时间（可空）|
| finished_at | datetime | 任务结束时间（可空）|
| created_at | datetime | |
| updated_at | datetime | |

> 详细日志写入 `data/logs/{task_id}.log` 文件，数据库不存储全量日志。通过 `GET /api/tasks/{id}/logs` 流式返回。

### scheduled_jobs（定时任务）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | |
| smb_server_id | integer FK | |
| directory | string | 扫描目录 |
| cron_expr | string | Cron 表达式 |
| target_lang | string | |
| stt_engine | string | |
| translate_engine | string | |
| enabled | boolean | |
| source_lang | string | 源语言（auto 表示自动检测）|
| overwrite | boolean | 是否覆盖已存在的 SRT 文件，默认 false |
| last_run_at | datetime | 上次执行时间（可空）|
| last_run_status | string | 上次执行结果（可空）|
| created_at | datetime | |
| updated_at | datetime | |

### settings（系统配置）
| 字段 | 类型 | 说明 |
|------|------|------|
| key | string PK | 配置键 |
| value | string | 配置值，API Key 等敏感值用 Fernet 加密 |
| updated_at | datetime | |

> 加密密钥来自环境变量 `SECRET_KEY`（32 字节随机串）。GET 接口对 API Key 类字段返回 `"**MASKED**"`，不返回明文。

---

## API 端点

```
# 任务管理
POST   /api/tasks                创建任务；body 为 file_paths 数组，每条路径生成独立 task
GET    /api/tasks                列表（分页、状态筛选）
GET    /api/tasks/{id}           任务详情
DELETE /api/tasks/{id}           取消任务（revoke Celery task）
POST   /api/tasks/{id}/retry     重试失败任务
GET    /api/tasks/{id}/logs      流式返回任务日志文件

# SMB 服务器
GET    /api/smb                  服务器列表（不含 password 字段）
POST   /api/smb                  添加服务器
PUT    /api/smb/{id}             更新服务器
DELETE /api/smb/{id}             删除服务器
POST   /api/smb/{id}/test        测试连接
GET    /api/smb/{id}/browse      浏览目录（query param: ?path=/subdir）

# 设置（引擎配置、API Key）
GET    /api/settings/stt         获取 STT 引擎配置（API Key 脱敏）
PATCH  /api/settings/stt         更新 STT 引擎配置
GET    /api/settings/translate   获取翻译引擎配置（API Key 脱敏）
PATCH  /api/settings/translate   更新翻译引擎配置

# 定时任务
GET    /api/schedules            定时任务列表
POST   /api/schedules            创建定时任务
PUT    /api/schedules/{id}       更新定时任务
DELETE /api/schedules/{id}       删除定时任务

# 实时通信
WS     /ws/tasks                 全局任务状态推送（前端按 task_id 过滤）
```

---

## 错误处理

**统一 API 错误响应格式：**
```json
{ "error": "描述信息", "code": "ERROR_CODE" }
```

**任务级错误处理：**
- Celery 任务异常时捕获异常，将 `status` 更新为 `failed`，`error_message` 记录摘要，详细堆栈写入日志文件
- STT / 翻译 API 调用失败：最多重试 3 次，指数退避（1s、2s、4s），超过后任务标记为 failed
- ffmpeg 执行超时（默认 30 分钟）：终止进程，任务标记为 failed

**重试次数限制：** `retry_count` 超过 5 次后，UI 禁用重试按钮，防止无限循环。

---

## Web 界面功能模块

### 任务中心（首页）
- 任务列表：状态、进度条、耗时（`finished_at - started_at`）、失败原因摘要
- 操作：取消（运行中）、重试（失败）
- 实时日志面板：点击任务查看流式日志
- 批量操作：全选、批量取消/重试

> 注：当前版本不支持暂停单个任务（Celery 不原生支持暂停/恢复）。

### 新建任务
- 选择已配置的 SMB 服务器
- 文件浏览器：浏览目录结构，勾选文件或整个目录（批量）
- 配置：源语言（自动/手动）、目标语言、STT 引擎、翻译引擎、冲突策略（跳过/覆盖）
- 预览文件列表后提交

### 设置
- SMB 服务器管理：增删改、连接测试
- STT 引擎配置：API Key、本地 Whisper 模型选择
- 翻译引擎配置：各引擎 API Key
- 定时任务：Cron 配置，自动扫描新文件，查看上次执行状态

### 历史记录
- 已完成任务归档
- 按日期/SMB 服务器/状态筛选

---

## 项目目录结构

```
DeepSub/
├── frontend/                  # React 项目
│   ├── src/
│   │   ├── pages/             # 任务中心、新建任务、设置、历史
│   │   ├── components/        # 公共组件
│   │   └── api/               # API 调用封装
│   └── package.json
├── backend/
│   ├── api/                   # FastAPI 路由
│   ├── tasks/                 # Celery 任务定义
│   ├── engines/               # 引擎抽象层
│   │   ├── stt/               # whisper_local.py, openai_whisper.py
│   │   └── translate/         # deeplx.py, deepl.py, google.py, openai.py
│   ├── smb/                   # SMB 连接与文件操作
│   ├── models/                # 数据库模型（SQLAlchemy）
│   ├── core/                  # 配置、数据库初始化、加密工具
│   └── main.py                # FastAPI 入口
├── data/                      # 本地运行数据目录（gitignore）
│   ├── db/                    # SQLite 文件
│   ├── whisper-models/        # Whisper 模型缓存
│   ├── logs/                  # 任务日志（{task_id}.log）
│   └── tmp/                   # 视频临时下载缓存
├── docker-compose.yml
├── .env.example               # 环境变量模板（含 SECRET_KEY）
└── docs/
    └── superpowers/specs/
        └── 2026-04-13-deepsub-design.md
```

---

## 本地开发运行方式（测试阶段）

```bash
# 启动 Redis
redis-server

# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Celery Worker
celery -A tasks worker --loglevel=info

# Celery Beat（定时任务）
celery -A tasks beat --loglevel=info

# 前端
cd frontend
npm install
npm run dev
```

---

## 部署（发布阶段）

```bash
docker compose up -d
```

对外暴露单一端口（默认 3000），Nginx 托管前端并反向代理后端 API。

**数据持久化 volumes：**
- `./data/db` → SQLite
- `./data/whisper-models` → Whisper 模型
- `./data/logs` → 任务日志
- `./data/tmp` → 视频临时缓存

**临时文件清理策略：** 任务完成（无论成功或失败）后立即删除 `data/tmp/{task_id}/` 目录。服务启动时清理 `data/tmp/` 下所有残留文件（处理异常退出遗留的孤立临时文件）。
