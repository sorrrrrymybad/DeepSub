# DeepSub

Created by Sorrymybad

DeepSub 是一个基于 Web 的字幕处理工具，项目当前提供完整的 Docker Compose 启动方式，可直接在宿主机上完成初始化、构建和运行。

## Docker 从 0 开始配置并启动

### 1. 准备环境

- 安装 Docker
- 安装 Docker Compose Plugin，并确保可使用 `docker compose`
- 确认宿主机可联网拉取镜像与安装依赖

可先执行下面两条命令确认环境正常：

```bash
docker --version
docker compose version
```

### 2. 克隆项目

```bash
git clone <repo-url> DeepSub
cd DeepSub
```

### 3. 准备配置文件

项目根目录已经提供 `.env.example`，首次启动前先复制一份：

```bash
cp .env.example .env
```

然后修改 `.env`，至少确认以下配置：

```env
DATABASE_URL=sqlite:////app/data/db/deepsub.db
REDIS_URL=redis://redis:6379/0
SECRET_KEY=change-me-to-a-32-byte-random-string
DATA_DIR=/app/data
LOG_DIR=/app/data/logs
TMP_DIR=/app/data/tmp
WHISPER_MODEL_DIR=/app/data/whisper-models
FRONTEND_PORT=80
```

关键说明：

- `SECRET_KEY` 必须修改。
- 可用下面的命令生成随机值：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

- 如果宿主机 `80` 端口被占用，把 `FRONTEND_PORT` 改成其他端口，例如 `8080` 或 `8001`。
- 默认数据会写入宿主机项目目录下的 `./data`。

### 4. 构建并启动容器

首次启动执行：

```bash
docker compose up -d --build
```

这个命令会完成以下工作：

- 启动 `redis`
- 构建并启动 `backend`
- 构建并启动 `worker`
- 构建并启动 `frontend`

### 5. 确认服务状态

```bash
docker compose ps
```

正常情况下应看到以下 4 个服务处于运行状态：

- `redis`
- `backend`
- `worker`
- `frontend`

如果需要查看日志：

```bash
docker compose logs -f
```

查看单个服务日志：

```bash
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend
docker compose logs -f redis
```

### 6. 打开项目

浏览器访问：

```text
http://<宿主机IP>:<FRONTEND_PORT>
```

如果在本机启动，通常就是：

```text
http://127.0.0.1:80
```

如果你把 `.env` 中的 `FRONTEND_PORT` 改成了 `8001`，则访问：

```text
http://127.0.0.1:8001
```

## 常用运维命令

停止容器但保留数据：

```bash
docker compose down
```

重新启动：

```bash
docker compose up -d
```

源码或 Dockerfile 有变化后重建启动：

```bash
docker compose up -d --build
```

重启单个服务：

```bash
docker compose restart backend
docker compose restart worker
docker compose restart frontend
docker compose restart redis
```

## 数据位置

- 业务数据、SQLite 数据库、日志、临时文件、Whisper 模型文件保存在宿主机 `./data`
- Redis 数据保存在 Docker volume `deepsub_redis_data`

## 当前 Docker 结构

项目当前的 `docker-compose.yml` 包含以下服务：

- `frontend`：基于 Nginx 提供前端静态页面，并反向代理 `/api/` 和 `/ws/`
- `backend`：FastAPI 服务，容器内监听 `8000`
- `worker`：字幕处理后台任务进程
- `redis`：任务队列与实时消息依赖

前端对外暴露的宿主机端口由 `.env` 中的 `FRONTEND_PORT` 控制，容器内固定监听 `80`。

## 本地目录视频来源

除 SMB 来源外，DeepSub 现在也支持直接浏览容器内本地目录中的视频文件并创建翻译任务。

这个功能依赖 Docker 挂载。你需要把宿主机视频目录同时挂载到 `backend` 和 `worker`，并且两边使用相同的容器路径。

例如把宿主机 `/data/videos` 挂载到容器 `/mnt/videos`：

```yaml
services:
  backend:
    volumes:
      - ./data:/app/data
      - /data/videos:/mnt/videos

  worker:
    volumes:
      - ./data:/app/data
      - /data/videos:/mnt/videos
```

说明：

- `backend` 需要这份挂载来浏览目录并创建任务
- `worker` 需要这份挂载来实际读取视频和写回字幕
- 两个服务里的容器路径必须一致，例如都使用 `/mnt/videos`
- 如果只挂载到 `backend`，页面能看到文件，但任务执行会失败
- 如果目标目录没有写权限，本地来源任务无法写回 `*.srt`

任务完成后，字幕会直接写回原视频所在目录，文件名格式为：

```text
原文件名.<目标语言>.srt
```

例如：

```text
/mnt/videos/demo/movie.mp4
-> /mnt/videos/demo/movie.zh.srt
```
