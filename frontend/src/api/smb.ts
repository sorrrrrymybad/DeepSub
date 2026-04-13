import { client } from './client'

export interface SMBServer {
  id: number
  name: string
  host: string
  port: number
  share: string
  domain: string | null
  username: string
  created_at: string
}

export interface SMBEntry {
  name: string
  is_dir: boolean
  size: number
}

export interface CreateSMBPayload {
  name: string
  host: string
  port?: number
  share: string
  domain?: string
  username: string
  password: string
}

export const smbApi = {
  list: () => client.get<SMBServer[]>('/smb').then(r => r.data),
  create: (data: CreateSMBPayload) => client.post<SMBServer>('/smb', data).then(r => r.data),
  update: (id: number, data: Partial<CreateSMBPayload>) =>
    client.put<SMBServer>(`/smb/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/smb/${id}`),
  test: (id: number) => client.post<{ ok: boolean; error?: string }>(`/smb/${id}/test`).then(r => r.data),
  browse: (id: number, path: string) =>
    client.get<SMBEntry[]>(`/smb/${id}/browse`, { params: { path } }).then(r => r.data),
}
