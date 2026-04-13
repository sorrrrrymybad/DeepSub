from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])

active_connections: set[WebSocket] = set()


@router.websocket("/ws/tasks")
async def websocket_tasks(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            await asyncio.wait_for(websocket.receive_text(), timeout=30)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        active_connections.discard(websocket)


async def broadcast_task_update(task_id: int, payload: dict):
    message = json.dumps({"task_id": task_id, **payload})
    dead_connections = set()
    for websocket in active_connections:
        try:
            await websocket.send_text(message)
        except Exception:
            dead_connections.add(websocket)
    active_connections.difference_update(dead_connections)
