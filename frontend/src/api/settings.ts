import { client } from './client'

export interface WhisperStatus {
  exists: boolean
  downloading: boolean
  progress: number | null
  error: string | null
}

export interface TranslationProfile {
  id: number
  provider: 'openai' | 'claude'
  name: string
  model: string
  base_url: string | null
  api_key_masked: string
  has_api_key: boolean
  is_active: boolean
}

export interface TranslationProfilesResponse {
  profiles: TranslationProfile[]
  active_profile_id: number | null
  active_profile: {
    id: number
    provider: 'openai' | 'claude'
    name: string
    api_key: string
    model: string
    base_url: string | null
  } | null
}

export interface TranslationProfilePayload {
  name: string
  api_key: string
  model: string
  base_url?: string | null
}

export const settingsApi = {
  getSystem: () => client.get('/settings/system').then(r => r.data),
  patchSystem: (data: Record<string, string>) => client.patch('/settings/system', data),
  getSTT: () => client.get('/settings/stt').then(r => r.data),
  patchSTT: (data: Record<string, string>) => client.patch('/settings/stt', data),
  getTranslate: () => client.get('/settings/translate').then(r => r.data),
  patchTranslate: (data: Record<string, string>) => client.patch('/settings/translate', data),
  listTranslateProfiles: (provider: 'openai' | 'claude'): Promise<TranslationProfilesResponse> =>
    client.get(`/settings/translate/providers/${provider}/profiles`).then(r => r.data),
  createTranslateProfile: (provider: 'openai' | 'claude', data: TranslationProfilePayload): Promise<{ profile: TranslationProfile }> =>
    client.post(`/settings/translate/providers/${provider}/profiles`, data).then(r => r.data),
  updateTranslateProfile: (provider: 'openai' | 'claude', profileId: number, data: TranslationProfilePayload): Promise<{ profile: TranslationProfile }> =>
    client.patch(`/settings/translate/providers/${provider}/profiles/${profileId}`, data).then(r => r.data),
  deleteTranslateProfile: (provider: 'openai' | 'claude', profileId: number) =>
    client.delete(`/settings/translate/providers/${provider}/profiles/${profileId}`).then(r => r.data),
  setActiveTranslateProfile: (provider: 'openai' | 'claude', profileId: number) =>
    client.post(`/settings/translate/providers/${provider}/active/${profileId}`).then(r => r.data),
  // 均使用 query string，与后端 Query(...) 参数对应
  getWhisperStatus: (modelSize: string): Promise<WhisperStatus> =>
    client.get('/settings/stt/whisper/status', { params: { model_size: modelSize } }).then(r => r.data),
  postWhisperDownload: (modelSize: string): Promise<{ ok: boolean; reason: string } & WhisperStatus> =>
    client.post('/settings/stt/whisper/download', null, { params: { model_size: modelSize } }).then(r => r.data),
}
