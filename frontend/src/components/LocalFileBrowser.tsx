import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { localFilesApi, type LocalFileEntry } from '../api/localFiles'
import { useTranslation } from 'react-i18next'

const VIDEO_EXTS = ['.mkv', '.mp4', '.avi', '.ts', '.mov']

type SortOrder = 'asc' | 'desc'

interface Props {
  selected: string[]
  onToggle: (path: string) => void
  onSelectAll?: (paths: string[]) => void
  onDeselectAll?: (paths: string[]) => void
}

export default function LocalFileBrowser({ selected, onToggle, onSelectAll, onDeselectAll }: Props) {
  const { t } = useTranslation()
  const [path, setPath] = useState('/')
  const [history, setHistory] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['local-browse', path],
    queryFn: () => localFilesApi.browse(path),
  })

  const navigate = (entry: LocalFileEntry) => {
    const newPath = `${path.endsWith('/') ? path : `${path}/`}${entry.name}`
    setHistory(h => [...h, path])
    setPath(newPath)
  }

  const goBack = () => {
    const prev = history.at(-1) ?? '/'
    setHistory(h => h.slice(0, -1))
    setPath(prev)
  }

  const isVideo = (name: string) => VIDEO_EXTS.some(ext => name.toLowerCase().endsWith(ext))
  const getFullPath = (name: string) => `${path.endsWith('/') ? path : `${path}/`}${name}`

  const rawItems = data ?? []
  const videos = rawItems.filter(entry => !entry.is_dir && isVideo(entry.name))
  const visibleItems = [...rawItems].sort((a, b) =>
    sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
  )
  const videoPaths = videos.map(entry => getFullPath(entry.name))
  const allSelected = videoPaths.length > 0 && videoPaths.every(entryPath => selected.includes(entryPath))

  const handleSelectAll = () => {
    if (allSelected) {
      onDeselectAll?.(videoPaths)
      return
    }
    onSelectAll?.(videoPaths)
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-low px-4 py-4">
        <button
          type="button"
          onClick={goBack}
          disabled={history.length === 0}
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-primary disabled:opacity-40 disabled:text-on-surface-variant"
        >
          <span aria-hidden="true">←</span>
          {t('browser.back')}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {t('browser.currentPath')}
          </p>
          <p className="truncate text-sm font-semibold text-on-surface">{path}</p>
        </div>

        <span className="rounded-full border border-outline-variant px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
          {videos.length} Files
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-3">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant flex-1">
          {t('browser.folders')}
        </span>

        <button
          type="button"
          onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
        >
          {sortOrder === 'asc' ? '↑' : '↓'} {t('browser.sortName')}
        </button>

        {videos.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
          >
            <input
              type="checkbox"
              readOnly
              checked={allSelected}
              className="pointer-events-none h-3 w-3 rounded border-outline-variant bg-surface custom-checkbox"
            />
            {allSelected ? t('browser.deselectAll') : t('browser.selectAll')}
          </button>
        )}
      </div>

      <div className="max-h-[420px] overflow-auto">
        {isLoading ? <p className="p-4 text-sm text-on-surface-variant">{t('browser.loading')}</p> : null}
        {isError ? <p className="p-4 text-sm text-on-error-container">{t('browser.failed')}</p> : null}
        {!isLoading && !isError && visibleItems.length === 0 ? (
          <div className="p-5 text-sm leading-6 text-on-surface-variant">
            <p>{t('browser.empty')}</p>
          </div>
        ) : null}

        {!isLoading && !isError
          ? visibleItems.map(entry => {
              const fullPath = getFullPath(entry.name)
              const isSelected = selected.includes(fullPath)
              const supported = entry.is_dir || isVideo(entry.name)

              return (
                <div
                  key={entry.name}
                  className="border-b border-outline-variant px-4 py-3 last:border-b-0"
                >
                  {entry.is_dir ? (
                    <button
                      type="button"
                      onClick={() => navigate(entry)}
                      className="flex w-full items-center gap-3 rounded-2xl px-1 py-1 text-left text-sm font-semibold text-on-surface transition-colors hover:text-primary"
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant">
                        /
                      </span>
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    </button>
                  ) : supported ? (
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-1 py-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(fullPath)}
                        className="h-4 w-4 rounded border-outline-variant bg-surface custom-checkbox"
                      />
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-container text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-on-primary-container">
                        VID
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
                        {entry.name}
                      </span>
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        {(entry.size / 1024 / 1024).toFixed(0)} MB
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl px-1 py-1 text-on-surface-variant">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-surface-container-low text-[0.68rem] font-semibold uppercase tracking-[0.14em]">
                        REF
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                    </div>
                  )}
                </div>
              )
            })
          : null}
      </div>

      <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        {t('browser.unsupported')}
      </div>
    </div>
  )
}
