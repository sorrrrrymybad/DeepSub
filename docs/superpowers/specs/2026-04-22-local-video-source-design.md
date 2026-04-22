---
title: DeepSub 本地视频来源设计
date: 2026-04-22
author: Sorrymybad
status: approved
---

# DeepSub 本地视频来源设计

## 概览

在保留现有 SMB 来源的前提下，为 DeepSub 新增“本地目录”视频来源。

这里的“本地目录”指的是：

- 视频文件已经位于 `backend` / `worker` 容器可访问的容器内路径中
- 通常通过 Docker bind mount 将宿主机目录映射进容器
- 创建任务时直接选择这些容器内目录中的视频文件
- 此类任务跳过文件上传环节

目标是让用户在 `新建任务` 页面中并列使用两类来源：

- `SMB`
- `本地目录`

任务创建后仍然复用同一套任务中心、日志、进度、重试和字幕处理流水线。

---

## 1. 设计目标

### 1.1 目标

- 在 `新建任务` 页面增加来源类型切换：`SMB` / `本地目录`
- 支持浏览容器内任意路径下的目录和视频文件
- 本地来源任务无需上传视频文件
- 字幕默认写回原视频所在目录，命名规则保持为 `原文件名.<目标语言>.srt`
- 不破坏现有 SMB 任务处理链路

### 1.2 非目标

- 不支持从浏览器上传本地文件到容器
- 不支持本地来源与 SMB 来源混合提交
- 不新增本地来源的定时扫描任务
- 不新增本地目录白名单配置页
- 不自动修改用户宿主机目录挂载配置

---

## 2. 方案选型

评估过三种方向：

1. 扩展现有任务模型，增加来源类型
2. 抽象统一文件源适配层后整体重构
3. 单独再做一套本地任务流程

本次采用方案 1：

- 在现有 `tasks` 模型上新增 `source_type`
- 将 `smb_server_id` 改为可空
- worker 根据 `source_type` 选择输入文件准备和字幕输出写回方式

采用该方案的原因：

- 改动范围集中
- 可最大化复用现有任务系统
- 风险明显低于引入完整抽象层重构
- 后续如果来源类型继续扩展，仍可在此基础上逐步抽象

---

## 3. 数据模型调整

### 3.1 `tasks` 表

现有任务模型扩展为同时描述 SMB 和本地目录任务。

#### 新增字段

- `source_type: string`
  - 允许值：`smb`、`local`
  - 默认值：`smb`

#### 修改字段

- `smb_server_id`
  - 从必填改为可空
  - 语义：
    - `source_type=smb` 时必须有值
    - `source_type=local` 时必须为空

#### 保持不变

- `file_path`
  - 继续表示“来源侧原始视频路径”
  - 对 SMB 任务是远端共享路径
  - 对本地任务是容器内绝对路径

### 3.2 Pydantic Schema

`TaskCreate` 和 `TaskResponse` 需要补充 `source_type`。

创建任务时增加约束：

- `source_type=smb`
  - 必须提供 `smb_server_id`
- `source_type=local`
  - `smb_server_id` 必须为空
  - `file_paths` 中每一项都必须是绝对路径

---

## 4. 后端 API 设计

## 4.1 任务创建接口

继续复用：

`POST /api/tasks`

请求体新增 `source_type`：

```json
{
  "source_type": "local",
  "file_paths": ["/mnt/videos/demo/movie.mp4"],
  "source_lang": "auto",
  "target_lang": "zh",
  "stt_engine": "whisper_local",
  "translate_engine": "deeplx",
  "overwrite": false
}
```

SMB 请求仍然沿用原结构，但多一个 `source_type: "smb"`。

服务端校验规则：

- `source_type` 非法时返回 `400`
- `source_type=smb` 且未传 `smb_server_id` 时返回 `400`
- `source_type=local` 且传入 `smb_server_id` 时返回 `400`
- `source_type=local` 且 `file_paths` 中存在非绝对路径时返回 `400`

## 4.2 本地目录浏览接口

新增只读浏览接口：

`GET /api/local-files/browse?path=/`

返回结构复用现有文件浏览器所需字段：

```json
[
  {
    "name": "movies",
    "is_dir": true,
    "size": 0
  },
  {
    "name": "demo.mp4",
    "is_dir": false,
    "size": 104857600
  }
]
```

行为约束：

- 只列出当前目录一层内容
- 不递归
- 不提供上传、删除、移动等写操作
- 路径不存在、不可访问、不是目录时返回 `400`

本期允许浏览容器内任意路径，不限制根目录。

---

## 5. Worker 流程设计

核心原则：

- 字幕提取、STT、翻译、SRT 生成等核心处理链路不变
- 仅根据来源类型切换“输入视频准备”和“输出字幕写回”阶段

## 5.1 输入视频准备

### SMB 来源

保持现有行为：

- 通过 `SMBClient.download_file()` 下载视频到任务临时目录
- 进度区间保持 `5 -> 20`

### 本地来源

新增行为：

- 校验 `task.file_path` 是否存在
- 校验其是否为文件
- 校验扩展名是否为支持的视频格式
- 将源文件复制到任务临时目录作为工作副本

本地来源仍复制到 `tmp/task_id/video.xxx` 的原因：

- 与现有 `ffmpeg`、字幕探测和 STT 流程保持一致输入形式
- 避免处理过程中直接操作原文件
- 保持任务清理逻辑统一

进度区间仍复用 `5 -> 20`，日志文案改为“准备本地视频”。

## 5.2 中间处理阶段

以下行为对两种来源完全一致：

- 探测内嵌字幕轨
- 选择最佳字幕轨
- 提取字幕轨或提取音频
- STT 转写
- 批量翻译
- 生成字幕段数据

## 5.3 输出字幕写回

输出文件命名保持现有规则：

- 输入：`/mnt/videos/demo/movie.mp4`
- 输出：`/mnt/videos/demo/movie.zh.srt`

### SMB 来源

保持现有行为：

- 生成本地 SRT
- 上传回 SMB 原目录

### 本地来源

新增行为：

- 直接将生成的 SRT 写回视频所在目录
- 不进行上传

## 5.4 overwrite 语义

两种来源保持统一语义：

- `overwrite=false` 且目标字幕已存在
  - 跳过写入
  - 任务仍标记为成功
- `overwrite=true`
  - 覆盖已有字幕文件

## 5.5 建议的内部 helper

为了避免来源分支散落在主任务流程中，建议新增两个轻量 helper：

- `prepare_source_video(...)`
  - 负责 SMB 下载或本地复制
- `write_output_subtitle(...)`
  - 负责 SMB 上传或本地落盘

这样可以把 `process_subtitle_task()` 主流程继续保持为：

1. 准备视频
2. 提取字幕或 STT
3. 翻译
4. 写回字幕
5. 更新任务状态

---

## 6. 前端交互设计

## 6.1 新建任务页

`NewTaskPage` 新增来源类型切换：

- `SMB`
- `本地目录`

### 选择 SMB 时

- 保留现有 SMB 服务器下拉框
- 保留现有 `SMBFileBrowser`
- 已选文件逻辑不变

### 选择本地目录时

- 隐藏 SMB 服务器下拉框
- 展示新的本地文件浏览器组件
- 默认从 `/` 开始浏览
- 允许逐级进入任意目录
- 仅视频文件可勾选

交互要求：

- 本地浏览器尽量复用当前 SMB 浏览器的视觉和交互模式
- 同样支持排序、全选、取消全选、返回上级
- 已选文件区保持统一展示，不按来源拆开

## 6.2 提交行为

### SMB 来源提交

- 继续传递 `smb_server_id`
- 增加 `source_type: "smb"`

### 本地来源提交

- 不传 `smb_server_id`
- 增加 `source_type: "local"`

### 提示文案

错误提示需按来源区分：

- SMB：请选择 SMB 服务器及至少一个视频文件
- Local：请选择至少一个本地视频文件

## 6.3 任务中心展示

建议在任务卡片中增加来源标识：

- `SMB`
- `LOCAL`

其余内容保持不变：

- 进度
- 状态
- 日志
- 重试
- 删除

---

## 7. Docker 使用约束

本地目录来源依赖容器可见路径，因此必须由用户自行挂载宿主机目录到 `backend` 和 `worker`。

例如将宿主机 `/data/videos` 挂到容器 `/mnt/videos`：

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

关键约束：

- `backend` 和 `worker` 必须挂载同一份视频目录
- 挂载后的容器路径必须一致
- 如果只挂载到 `backend`，浏览能成功但 worker 无法处理
- 如果 worker 对目标目录无写权限，字幕写回会失败

本期不在前端提供挂载状态探测，也不尝试自动推断宿主机目录。

---

## 8. 错误处理

### 本地目录浏览阶段

- 路径不存在：返回 `400`
- 不是目录：返回 `400`
- 权限不足：返回 `400`

### 任务执行阶段

- 本地视频不存在：任务 `failed`
- 本地视频不可读：任务 `failed`
- 目标目录不可写：任务 `failed`
- 目标字幕写入失败：任务 `failed`
- 视频扩展名不受支持：任务 `failed`

日志中需要明确写出：

- 当前来源类型
- 输入路径
- 输出路径
- 失败异常摘要

---

## 9. 测试与验收

## 9.1 后端测试

- 创建任务接口
  - `source_type=smb` 成功
  - `source_type=local` 成功
  - 字段组合非法时报错
- 本地目录浏览接口
  - 正常列目录
  - 不存在路径报错
  - 非目录路径报错
- worker 本地分支
  - 本地文件存在时可进入处理流程
  - `overwrite=false` 且字幕已存在时跳过写入并成功结束

## 9.2 前端测试

- 新建任务页来源切换
- 本地浏览器渲染与选择
- 本地来源提交 payload 正确

## 9.3 手工验收

1. 按文档将宿主机视频目录挂载到 `backend` 和 `worker`
2. 启动服务后进入 `新建任务`
3. 切换到 `本地目录`
4. 浏览 `/mnt/videos` 并选择视频
5. 提交任务后在任务中心看到 `LOCAL` 来源标识
6. 任务完成后，在原视频目录看到 `*.{target_lang}.srt`
7. `overwrite=false` 时已有字幕不被覆盖
8. SMB 来源任务仍能正常创建与执行

---

## 10. 文件影响面

**后端**

- `backend/models/task.py`
- `backend/schemas/task.py`
- `backend/api/tasks.py`
- `backend/main.py`
- `backend/worker/subtitle_task.py`
- 新增本地目录浏览 API 文件或扩展现有 API 模块

**前端**

- `frontend/src/pages/NewTaskPage.tsx`
- `frontend/src/api/tasks.ts`
- 新增本地文件浏览 API 封装
- 新增本地文件浏览组件
- `frontend/src/components/TaskCard.tsx`
- `frontend/src/i18n.ts`

**文档**

- `README.md`

---

## 决策摘要

| 维度 | 决策 |
|---|---|
| 来源模式 | 并列支持 `SMB` 与 `本地目录` |
| 任务建模 | 在现有 `tasks` 上新增 `source_type` |
| 本地路径范围 | 允许浏览容器内任意路径 |
| 本地任务输入 | 复制到任务临时目录后处理 |
| 本地任务输出 | 直接写回视频同目录 |
| 上传环节 | 本地来源跳过上传 |
| 定时扫描 | 本期不支持 |
| 目录白名单 | 本期不支持 |
| Docker 改动 | 仅文档说明用户自行挂载，不自动修改 compose |
