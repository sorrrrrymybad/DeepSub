import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

type Handler = (data: Record<string, unknown>) => void

interface WSContextType {
  subscribe: (taskId: number, handler: Handler) => () => void
}

const WSContext = createContext<WSContextType>({ subscribe: () => () => {} })

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Map<number, Set<Handler>>>(new Map())

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${location.host}/ws/tasks`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const { task_id, ...rest } = data
        // 更新 react-query 缓存
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        // 通知订阅者
        handlersRef.current.get(task_id)?.forEach(h => h(rest))
      } catch {}
    }

    ws.onclose = () => {
      // 断线重连，3 秒后
      setTimeout(connect, 3000)
    }
  }, [queryClient])

  useEffect(() => {
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  const subscribe = useCallback((taskId: number, handler: Handler) => {
    if (!handlersRef.current.has(taskId)) {
      handlersRef.current.set(taskId, new Set())
    }
    handlersRef.current.get(taskId)!.add(handler)
    return () => { handlersRef.current.get(taskId)?.delete(handler) }
  }, [])

  return <WSContext.Provider value={{ subscribe }}>{children}</WSContext.Provider>
}

export const useWebSocket = () => useContext(WSContext)
