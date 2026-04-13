import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { smbApi, type SMBEntry } from '../api/smb'
import { useTranslation } from 'react-i18next'

const VIDEO_EXTS = ['.mkv', '.mp4', '.avi', '.ts', '.mov']

interface Props {
  serverId: number
  selected: string[]
  onToggle: (path: string) => void
}

export default function SMBFileBrowser({ serverId, selected, onToggle }: Props) {
  const { t } = useTranslation()
  const [path, setPath] = useState('/')
  const [history, setHistory] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['smb-browse', serverId, path],
    queryFn: () => smbApi.browse(serverId, path),
  })

  const navigate = (entry: SMBEntry) => {
    const newPath = `${path.endsWith('/') ? path : path + '/'}${entry.name}`
    setHistory(h => [...h, path])
    setPath(newPath)
  }

  const goBack = () => {
    const prev = history.at(-1) ?? '/'
    setHistory(h => h.slice(0, -1))
    setPath(prev)
  }

  const isVideo = (name: string) => VIDEO_EXTS.some(ext => name.toLowerCase().endsWith(ext))

  const getFullPath = (name: string) => `${path.endsWith('/') ? path : path + '/'}${name}`

  return (
    <div className="bg-surface-container-lowest flex flex-col h-72">
      <div className="flex items-center gap-4 px-4 py-3 bg-surface-container-low text-[0.6875rem] uppercase tracking-[0.05em] font-medium text-on-surface">
        <button onClick={goBack} disabled={history.length === 0}
                className="text-primary hover:text-primary-dim disabled:opacity-40 disabled:text-on-surface-variant transition-colors">← {t('browser.back')}</button>
        <span className="truncate flex-1 tracking-normal Normal case">{path}</span>
      </div>
      <div className="flex-1 overflow-auto bg-surface-container-lowest">
        {isLoading && <p className="text-sm text-on-surface-variant p-4">{t('browser.loading')}</p>}
        {data?.map(entry => {
          const fullPath = getFullPath(entry.name)
          const isSelected = selected.includes(fullPath)
          return (
            <div key={entry.name}
                 className="flex items-center gap-3 px-4 py-2 hover:bg-surface-container-high transition-colors duration-150 ease-linear text-sm text-on-surface">
              {entry.is_dir ? (
                <button onClick={() => navigate(entry)}
                        className="flex items-center gap-3 flex-1 text-left font-medium">
                  <span className="text-on-surface-variant">/</span>
                  <span>{entry.name}</span>
                </button>
              ) : isVideo(entry.name) ? (
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input type="checkbox" checked={isSelected}
                         onChange={() => onToggle(fullPath)}
                         className="w-4 h-4 text-primary bg-surface border-outline-variant focus:ring-primary focus:ring-1 rounded-none appearance-none checked:bg-primary custom-checkbox" />
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className="text-on-surface-variant text-[0.6875rem] uppercase tracking-[0.05em]">
                    {(entry.size / 1024 / 1024).toFixed(0)} MB
                  </span>
                </label>
              ) : (
                <span className="text-on-surface-variant flex items-center gap-3 flex-1">
                  <span className="opacity-50">-</span>
                  <span className="truncate">{entry.name}</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
