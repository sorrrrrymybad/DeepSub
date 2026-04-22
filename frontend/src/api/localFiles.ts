import { client } from './client'

export interface LocalFileEntry {
  name: string
  is_dir: boolean
  size: number
}

export const localFilesApi = {
  browse: (path: string) =>
    client
      .get<LocalFileEntry[]>('/local-files/browse', { params: { path } })
      .then(r => r.data),
}
