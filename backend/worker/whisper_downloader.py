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
        WhisperModel(model_size, download_root=str(settings.whisper_model_dir), compute_type="float32")

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
