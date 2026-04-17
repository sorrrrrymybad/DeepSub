# DeepSub Docker 封装实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 DeepSub 封装为多容器 Docker 应用，通过 `docker compose up --build` 一键启动生产环境。

**Architecture:** 4 个服务（frontend / backend / worker / redis）。backend 与 worker 共用同一个 Python 镜像（同一个 Dockerfile，仅 compose 层 `command` 不同）。前端用多阶段 Dockerfile 构建为静态资源，由 Nginx serve 并反代 `/api`、`/ws` 到 backend。业务数据通过 bind mount `./data:/app/data` 持久化，Redis 用 named volume。

**Tech Stack:** Docker / Docker Compose v2 / `python:3.11-slim` / `node:24-alpine` / `nginx:alpine` / `redis:7-alpine`

**Spec:** `docs/superpowers/specs/2026-04-18-docker-packaging-design.md`

---

## 文件清单

**新增**

- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf`
- `docker-compose.yml`
- `.env.example`（仓库根目录）

**修改**

- `.gitignore`（追加 `.env`，如未存在）

**不修改**

- backend / frontend 业务代码

---

## 关键约束

- 不写自动化测试。每个任务由 `docker compose` 实际启动作为验收。
- 实施过程中遇到的代码硬编码路径 / 环境耦合，先记录，不擅自修改业务代码（除非阻塞容器启动）。
- 文件作者：Sorrymybad（不要写 Claude 相关内容）。
- 不自动 git commit / push。每个任务结束后由用户决定是否提交。

---

## Task 1：backend Dockerfile（与 .dockerignore）

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: 创建 `backend/.dockerignore`**

```
__pycache__
*.pyc
*.pyo
tests
.pytest_cache
*.db
celerybeat-schedule.db
.env
.venv
.DS_Store
```

- [ ] **Step 2: 创建 `backend/Dockerfile`**

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: 在 `backend/` 目录下单独构建镜像，验证构建成功**

Run（在仓库根）:
```bash
docker build -t deepsub-backend:test backend
```
Expected: 构建成功，最后输出 `Successfully tagged deepsub-backend:test`。

- [ ] **Step 4: 验证镜像里 ffmpeg / ffprobe 可用**

Run:
```bash
docker run --rm deepsub-backend:test sh -c "ffmpeg -version | head -1 && ffprobe -version | head -1"
```
Expected: 输出 ffmpeg 和 ffprobe 的版本信息（不报 command not found）。

- [ ] **Step 5: 验证 Python 依赖装齐**

Run:
```bash
docker run --rm deepsub-backend:test python -c "import fastapi, celery, faster_whisper, pysrt, smbprotocol, cryptography; print('ok')"
```
Expected: 输出 `ok`。

- [ ] **Step 6: 清理测试镜像**

Run:
```bash
docker image rm deepsub-backend:test
```

---

## Task 2：frontend Dockerfile + nginx.conf（与 .dockerignore）

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: 创建 `frontend/.dockerignore`**

```
node_modules
dist
.DS_Store
*.log
```

- [ ] **Step 2: 创建 `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # 静态资源 + SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反代到 backend 容器
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # WebSocket 反代
    location /ws/ {
        proxy_pass http://backend:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    client_max_body_size 100m;
}
```

注意：前端代码里 axios `baseURL: '/api'`，WebSocket 连接 `ws://${location.host}/ws/tasks`，所以反代路径必须是 `/api/` 和 `/ws/`。后端路由前缀已包含 `/api`、`/ws`，所以 `proxy_pass` 也要保留 `/api/` / `/ws/` 路径段（不要写成 `proxy_pass http://backend:8000/;`）。

- [ ] **Step 3: 创建 `frontend/Dockerfile`（多阶段）**

```dockerfile
# Stage 1: build
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: 单独构建前端镜像，验证构建成功**

Run:
```bash
docker build -t deepsub-frontend:test frontend
```
Expected: 构建成功（npm ci + tsc + vite build 全过）；最后输出 `Successfully tagged deepsub-frontend:test`。

- [ ] **Step 5: 验证镜像内静态资源存在**

Run:
```bash
docker run --rm deepsub-frontend:test ls /usr/share/nginx/html
```
Expected: 看到 `index.html` 和 `assets/` 目录。

- [ ] **Step 6: 验证 nginx.conf 语法正确**

Run:
```bash
docker run --rm deepsub-frontend:test nginx -t
```
Expected: `syntax is ok` 且 `test is successful`。

- [ ] **Step 7: 清理测试镜像**

Run:
```bash
docker image rm deepsub-frontend:test
```

---

## Task 3：根目录 .env.example 与 .gitignore

**Files:**
- Create: `.env.example`（仓库根目录）
- Modify: `.gitignore`

- [ ] **Step 1: 创建仓库根 `.env.example`**

```
# DeepSub Docker 部署配置

# SQLite 数据库路径（容器内路径，对应宿主 ./data/db/deepsub.db）
DATABASE_URL=sqlite:////app/data/db/deepsub.db

# Redis 连接（compose 服务名）
REDIS_URL=redis://redis:6379/0

# Fernet 对称加密密钥，用于加密存入数据库的 SMB 密码 / API key 等
# 必须修改为 32 字节随机字符串。一旦丢失，已加密的数据无法解密
SECRET_KEY=change-me-to-a-32-byte-random-string

# 各类数据目录（容器内路径，对应宿主 ./data 下的子目录）
DATA_DIR=/app/data
LOG_DIR=/app/data/logs
TMP_DIR=/app/data/tmp
WHISPER_MODEL_DIR=/app/data/whisper-models

# 前端宿主端口（默认 80，如冲突可改为 8080 等）
FRONTEND_PORT=80
```

- [ ] **Step 2: 检查 `.gitignore` 是否包含根目录 `.env`**

Run:
```bash
grep -n "^\.env$\|^/\.env$\|^\.env\b" .gitignore
```
Expected: 有 `.env` 行。如果没有，把 `.env` 追加到 `.gitignore` 末尾（注意：`.gitignore` 现有 `.env` 一行匹配的是 backend/.env 等任意位置，已经覆盖根目录，无需追加；先确认）。

- [ ] **Step 3: 验证 .env.example 不会被忽略**

Run:
```bash
git check-ignore -v .env.example
```
Expected: 无输出（即不被忽略）。

---

## Task 4：docker-compose.yml

**Files:**
- Create: `docker-compose.yml`（仓库根目录）

- [ ] **Step 1: 创建 `docker-compose.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    image: deepsub-backend:latest
    restart: unless-stopped
    command: uvicorn main:app --host 0.0.0.0 --port 8000
    env_file: .env
    volumes:
      - ./data:/app/data
    depends_on:
      - redis

  worker:
    build: ./backend
    image: deepsub-backend:latest
    restart: unless-stopped
    command: python start_worker.py
    env_file: .env
    volumes:
      - ./data:/app/data
    depends_on:
      - redis

  frontend:
    build: ./frontend
    image: deepsub-frontend:latest
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-80}:80"
    depends_on:
      - backend

volumes:
  redis_data:
```

说明：
- backend 与 worker 共用 `image: deepsub-backend:latest` + `build: ./backend`，第一次 `docker compose build` 后两个服务复用同一个镜像
- worker 不暴露端口
- backend 不暴露端口（流量从 frontend 的 nginx 反代过来）
- `restart: unless-stopped` 让容器在崩溃后自动重启（但用户主动 `docker compose down` 不会重启）

- [ ] **Step 2: 验证 compose 文件语法**

Run:
```bash
docker compose config
```
Expected: 输出解析后的完整配置，无报错。

- [ ] **Step 3: 准备 .env**

Run:
```bash
[ -f .env ] || cp .env.example .env
```
Expected: 仓库根存在 `.env`（如已有则保留）。**注意：用户应自行修改 SECRET_KEY，本任务不强制。**

- [ ] **Step 4: 构建全部镜像**

Run:
```bash
docker compose build
```
Expected: backend 和 frontend 镜像都构建成功。耗时首次约 2-5 分钟。

- [ ] **Step 5: 启动全部服务**

Run:
```bash
docker compose up -d
```
Expected: 4 个容器全部 `Started`。

- [ ] **Step 6: 验证容器状态**

Run:
```bash
docker compose ps
```
Expected: 4 个服务都是 `running` / `Up` 状态，没有 restart loop。等待 ~10 秒后再次检查；如有重启，跳到 Step 8 排查日志。

- [ ] **Step 7: 验证前端可访问**

Run:
```bash
curl -sI http://localhost/ | head -3
```
Expected: `HTTP/1.1 200 OK`，`Server: nginx/...`。

- [ ] **Step 8: 验证 API 反代可达**

Run:
```bash
curl -s http://localhost/api/settings/ | head -c 200
```
Expected: 返回 JSON（即使是空对象 / 空数组，也证明反代链路通），不是 502 / 404。

如果返回 502：检查 `docker compose logs backend` 看 backend 是否启动失败。
如果返回 404：检查 backend 实际路由是否为 `/api/settings/`，必要时调整路径或 nginx 配置。

- [ ] **Step 9: 验证宿主 ./data 已被写入**

Run:
```bash
ls -la data/db data/logs data/tmp data/whisper-models 2>/dev/null
```
Expected: 至少 `data/logs`、`data/tmp`、`data/whisper-models` 目录存在（backend lifespan 自动创建）；`data/db/deepsub.db` 存在（首启 create_all 后）。

- [ ] **Step 10: 停止服务**

Run:
```bash
docker compose down
```
Expected: 容器全部 `Removed`，named volume `redis_data` 保留，bind mount `./data` 数据保留。

- [ ] **Step 11: 重启服务，验证持久化**

Run:
```bash
docker compose up -d && sleep 5 && docker compose ps
```
Expected: 全部容器再次 running。SQLite 与 SMB 配置等数据保留。

- [ ] **Step 12: 关闭服务，留给用户最终验收**

Run:
```bash
docker compose down
```

---

## Task 5：手工验收（用户参与）

> 这一步需要用户实际打开浏览器、配置 SMB、跑翻译任务。Agent 启动服务并提示用户验证，不自动完成。

- [ ] **Step 1: 提示用户填好 `.env` 中的 `SECRET_KEY`**

输出提示：
> 请打开 `.env`，把 `SECRET_KEY` 改为一个 32 字节随机字符串（例如 `python -c "import secrets;print(secrets.token_urlsafe(32))"`）。改完后回复继续。

- [ ] **Step 2: 启动服务**

Run:
```bash
docker compose up -d
```

- [ ] **Step 3: 提示用户逐项验收（spec §7）**

输出提示：
> 请按以下清单验收，每项确认后告诉我：
> 1. 浏览器访问 `http://localhost`，前端正常加载
> 2. SMB 设置页填入宿主局域网 IP，能保存并测试连接成功
> 3. 创建翻译任务，worker 能拉到任务并正常处理（ffmpeg / ffprobe 可用）
> 4. Beat 定时扫描任务能按 cron 触发
> 5. WebSocket 实时进度推送正常（前端进度条更新）
> 6. `docker compose down && docker compose up -d` 之后，数据 / SMB 凭据保留
> 7. 宿主 `./data/` 下能看到 SQLite、日志、字幕产物

- [ ] **Step 4: 收尾**

如所有项通过：任务结束。
如有失败项：根据反馈修订对应文件（Dockerfile / nginx.conf / compose），不擅自改业务代码；如确认是业务代码 bug，单独提出由用户确认是否修。

---

## 完成标准

- 所有任务的 checkbox 全部打勾
- `docker compose up -d` 能从零起 4 个容器全部 running
- 浏览器可访问 `http://localhost` 并完整跑通一个翻译任务
- 宿主 `./data/` 持久化数据正确，重启后保留
