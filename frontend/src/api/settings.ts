import { client } from './client'

export interface WhisperStatus {
  exists: boolean
  downloading: boolean
  progress: number | null
  error: string | null
}

export const settingsApi = {
  getSystem: () => client.get('/settings/system').then(r => r.data),
  patchSystem: (data: Record<string, string>) => client.patch('/settings/system', data),
  getSTT: () => client.get('/settings/stt').then(r => r.data),
  patchSTT: (data: Record<string, string>) => client.patch('/settings/stt', data),
  getTranslate: () => client.get('/settings/translate').then(r => r.data),
  patchTranslate: (data: Record<string, string>) => client.patch('/settings/translate', data),
  // 均使用 query string，与后端 Query(...) 参数对应
  getWhisperStatus: (modelSize: string): Promise<WhisperStatus> =>
    client.get('/settings/stt/whisper/status', { params: { model_size: modelSize } }).then(r => r.data),
  postWhisperDownload: (modelSize: string): Promise<{ ok: boolean; reason: string } & WhisperStatus> =>
    client.post('/settings/stt/whisper/download', null, { params: { model_size: modelSize } }).then(r => r.data),
}
