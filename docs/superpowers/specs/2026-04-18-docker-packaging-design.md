---
title: DeepSub Docker 封装设计
date: 2026-04-18
author: Sorrymybad
status: approved
---

# DeepSub Docker 封装设计

## 概览

将 DeepSub 打包为多容器 Docker 应用，通过 `docker compose up --build` 一键启动生产环境。共 4 个服务：

- `frontend`（Nginx，serve 前端静态资源 + 反代 API/WebSocket）
- `backend`（FastAPI / uvicorn）
- `worker`（Celery worker + beat，由 `start_worker.py` 同时启动）
- `redis`

backend / worker 共用同一个 Python 镜像（同一个 Dockerfile，仅 compose 层 `command` 不同）。

仅提供生产模式；本地开发继续在宿主机直接运行 Python / Vite。

---

## 1. 镜像与 Dockerfile

### `backend/Dockerfile`（被 backend / worker 共用）

- 基础镜像：`python:3.11-slim`
- 系统依赖：`apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*`（含 ffprobe）
- 工作目录：`/app`
- 先拷贝 `requirements.txt` 安装依赖（利用层缓存），再拷贝源码
- 默认 `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`
- worker 在 compose 里覆盖为 `python start_worker.py`

### `frontend/Dockerfile`（多阶段）

- **Stage 1** `node:24-alpine`：`npm ci` + `npm run build` → `/app/dist`
- **Stage 2** `nginx:alpine`：拷贝 `dist` 到 `/usr/share/nginx/html`，附带自定义 `nginx.conf`

### `frontend/nginx.conf`

- `/` → 静态文件，SPA fallback 到 `index.html`（`try_files $uri /index.html`）
- `/api/` → `proxy_pass http://backend:8000/`
- `/ws/` → 反代 backend，带 `Upgrade` / `Connection` 头以支持 WebSocket

### `.dockerignore`

- `backend/.dockerignore`：`__pycache__`、`tests/`、`*.db`、`.env`、`celerybeat-schedule.db`
- `frontend/.dockerignore`：`node_modules`、`dist`

---

## 2. docker-compose.yml 服务定义

### `redis`

- `image: redis:7-alpine`
- volume：`redis_data:/data`（named volume）
- 不暴露端口到宿主

### `backend`

- `build: ./backend`
- `command: uvicorn main:app --host 0.0.0.0 --port 8000`
- `env_file: .env`
- volumes：`./data:/app/data`（bind mount）
- `depends_on: [redis]`
- 不直接暴露端口，由 frontend Nginx 反代

### `worker`（含 beat）

- `build: ./backend`（共用镜像）
- `command: python start_worker.py`
- `env_file: .env`
- volumes：`./data:/app/data`
- `depends_on: [redis]`

### `frontend`

- `build: ./frontend`
- `ports: ["${FRONTEND_PORT:-80}:80"]`
- `depends_on: [backend]`

### volumes

- `redis_data:`（named volume）

业务数据（SQLite、字幕产物、日志、whisper 模型）通过 bind mount `./data` 暴露给用户直接管理。

---

## 3. 配置与环境变量

### `.env.example`（仓库根目录）

```
DATABASE_URL=sqlite:////app/data/db/deepsub.db
REDIS_URL=redis://redis:6379/0
SECRET_KEY=change-me-to-a-32-byte-random-string
DATA_DIR=/app/data
LOG_DIR=/app/data/logs
TMP_DIR=/app/data/tmp
WHISPER_MODEL_DIR=/app/data/whisper-models
FRONTEND_PORT=80
```

### 关键说明

- `SECRET_KEY`：用于 `core/crypto.py` 中 Fernet 对称加密，加密存入 SQLite 的 SMB 密码、第三方 API key 等。**一旦丢失，所有已加密数据无法解密**，必须持久化在 `.env` 中。
- `REDIS_URL` 使用 compose 服务名 `redis`。
- 容器内路径全部基于 `/app/data`，对应宿主 `./data`。
- SQLite 路径 `/app/data/db/deepsub.db`，宿主 `./data/db/` 已存在，bind mount 后容器内可直接使用。

### `.gitignore`

确认包含 `.env`（仓库根的，避免泄露 SECRET_KEY）。

---

## 4. 启动流程与依赖顺序

执行 `docker compose up --build`：

1. 构建 `backend` 镜像（首次约 2-4 分钟）
2. 构建 `frontend` 镜像（多阶段：npm ci + build）
3. 拉取 `redis:7-alpine`
4. 启动顺序：`redis` → `backend` / `worker` → `frontend`

backend 启动时已经在 `main.py` 中执行：

- `Base.metadata.create_all(bind=engine)` 自动建表
- `data_dir / log_dir / tmp_dir / whisper_model_dir` 自动 `mkdir(parents=True, exist_ok=True)`

无需额外 init step。

`depends_on` 仅保证启动先后，不保证就绪——本设计接受短暂的连接重试（FastAPI 与 Celery 客户端在 Redis 暂时不可用时会自然重试）。

不配置 healthcheck（YAGNI）。
不新增 `/health` 端点。

---

## 5. SMB 网络访问

- compose 网络保持默认 bridge，不做特殊配置
- 用户在前端 SMB 设置页填入**宿主真实局域网 IP**（如 `192.168.x.x`）即可访问宿主 SMB
- 不做 `host.docker.internal` 自动映射，不在前端做地址提示

---

## 6. 文件清单

**新增**

- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf`
- `docker-compose.yml`（仓库根目录）
- `.env.example`（仓库根目录，Docker 版本）

**修改**

- `.gitignore`：确保包含根目录 `.env`
- README 或 CLAUDE.md：增加"Docker 部署"小节，说明 `cp .env.example .env` → 编辑 `SECRET_KEY` → `docker compose up --build` → 访问 `http://localhost`

**不修改**

- backend / frontend 业务代码（除非实施时发现路径硬编码或其他阻塞问题）

---

## 7. 验收标准

实施完成后逐条手工验证：

1. `cp .env.example .env` 并填入 `SECRET_KEY` → `docker compose up --build` 全部容器起来，无 restart loop
2. 浏览器访问 `http://localhost` → 前端正常加载
3. 前端 SMB 设置页填入宿主局域网 IP → 保存并测试连接成功
4. 创建翻译任务 → worker 正常处理，ffmpeg / ffprobe 可用
5. Beat 定时扫描任务能按 cron 触发
6. WebSocket 实时进度推送正常（前端进度条更新）
7. `docker compose down && docker compose up` → 数据 / 配置 / SMB 凭据保留
8. 宿主 `./data/db/deepsub.db`、`./data/logs/`、字幕产物均可在宿主直接访问

不编写自动化测试。

---

## 决策摘要

| 维度 | 决策 |
|---|---|
| 部署形态 | 多容器 docker-compose |
| 前端 | 独立 Nginx 容器，多阶段构建 |
| ffmpeg | 装进 backend 镜像（与 worker 共用） |
| 持久化 | Redis named volume；业务数据 bind mount `./data` |
| SMB 访问 | 用户填宿主局域网 IP |
| 镜像分发 | 用户本地构建，不推 registry |
| 模式 | 仅生产模式 |
| Worker / Beat | 合并为单个 worker 服务，由 `start_worker.py` 同时启动 |
| Healthcheck | 不配置 |
