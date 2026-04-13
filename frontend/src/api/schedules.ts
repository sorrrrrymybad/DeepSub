import { client } from './client'

export interface Schedule {
  id: number
  smb_server_id: number
  directory: string
  cron_expr: string
  source_lang: string
  target_lang: string
  stt_engine: string
  translate_engine: string
  overwrite: boolean
  enabled: boolean
  last_run_at: string | null
  last_run_status: string | null
  created_at: string
}

export const schedulesApi = {
  list: () => client.get<Schedule[]>('/schedules').then(r => r.data),
  create: (data: Omit<Schedule, 'id' | 'last_run_at' | 'last_run_status' | 'created_at'>) =>
    client.post<Schedule>('/schedules', data).then(r => r.data),
  update: (id: number, data: Partial<Schedule>) =>
    client.put<Schedule>(`/schedules/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/schedules/${id}`),
}
