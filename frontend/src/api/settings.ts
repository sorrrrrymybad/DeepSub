import { client } from './client'

export const settingsApi = {
  getSystem: () => client.get('/settings/system').then(r => r.data),
  patchSystem: (data: Record<string, string>) => client.patch('/settings/system', data),
  getSTT: () => client.get('/settings/stt').then(r => r.data),
  patchSTT: (data: Record<string, string>) => client.patch('/settings/stt', data),
  getTranslate: () => client.get('/settings/translate').then(r => r.data),
  patchTranslate: (data: Record<string, string>) => client.patch('/settings/translate', data),
}
