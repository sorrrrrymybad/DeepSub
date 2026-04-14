import { client } from './client'

export interface Task {
  id: number
  smb_server_id: number
  file_path: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
  source_lang: string
  target_lang: string
  stt_engine: string
  translate_engine: string
  overwrite: boolean
  progress: number
  error_message: string | null
  retry_count: number
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface CreateTasksPayload {
  smb_server_id: number
  file_paths: string[]
  source_lang: string
  target_lang: string
  stt_engine: string
  translate_engine: string
  overwrite: boolean
}

export interface TaskListResponse {
  items: Task[]
  total: number
  page: number
  page_size: number
}

export interface TaskSummary {
  total: number
  pending: number
  running: number
  done: number
  failed: number
  cancelled: number
}

export const tasksApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    client.get<TaskListResponse>('/tasks', { params }).then(r => r.data),

  summary: () =>
    client.get<TaskSummary>('/tasks/summary').then(r => r.data),

  get: (id: number) => client.get<Task>(`/tasks/${id}`).then(r => r.data),

  create: (payload: CreateTasksPayload) =>
    client.post<Task[]>('/tasks', payload).then(r => r.data),

  cancel: (id: number) => client.delete(`/tasks/${id}`),

  retry: (id: number) => client.post<Task>(`/tasks/${id}/retry`).then(r => r.data),

  getLogsUrl: (id: number) => `/api/tasks/${id}/logs`,
}
