import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { smbApi } from '../api/smb'
import { tasksApi } from '../api/tasks'
import SMBFileBrowser from '../components/SMBFileBrowser'
import LocalFileBrowser from '../components/LocalFileBrowser'
import EngineSelector from '../components/EngineSelector'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import SectionCard from '../components/page/SectionCard'
import { useToast } from '../context/ToastContext'

type SourceType = 'smb' | 'local'

interface FavoritePath {
  id: string
  type: SourceType
  path: string
  serverId?: number
  serverName?: string
}

const FAVORITE_PATHS_STORAGE_KEY = 'deepsub.favoritePaths'

function loadFavoritePaths(): FavoritePath[] {
  try {
    const raw = localStorage.getItem(FAVORITE_PATHS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is FavoritePath =>
      typeof item?.id === 'string'
      && (item.type === 'smb' || item.type === 'local')
      && typeof item.path === 'string'
    )
  } catch {
    return []
  }
}

function createFavoritePathId(type: SourceType, path: string, serverId?: number): string {
  return `${type}:${serverId ?? 'local'}:${path}`
}

export default function NewTaskPage() {
  const { t } = useTranslation()
  const { show } = useToast()
  const navigate = useNavigate()
  const [sourceType, setSourceType] = useState<SourceType>('smb')
  const [serverId, setServerId] = useState<number | null>(null)
  const [smbPath, setSmbPath] = useState('/')
  const [localPath, setLocalPath] = useState('/')
  const [favoritePaths, setFavoritePaths] = useState<FavoritePath[]>(loadFavoritePaths)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh')
  const [sttEngine, setSttEngine] = useState('whisper_local')
  const [translateEngine, setTranslateEngine] = useState('openai')
  const [overwrite, setOverwrite] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const STT_ENGINES = [
    { value: 'whisper_local', label: t('newTaskPage.engineWhisperLocal') },
    { value: 'openai_whisper', label: t('newTaskPage.engineWhisperApi') },
  ]

  const TRANSLATE_ENGINES = [
    { value: 'openai', label: t('newTaskPage.engineOpenai') },
    { value: 'claude', label: t('newTaskPage.engineClaude') },
    { value: 'deeplx', label: t('newTaskPage.engineDeeplx') },
    { value: 'deepl', label: t('newTaskPage.engineDeepl') },
    { value: 'google', label: t('newTaskPage.engineGoogle') },
  ]

  const LANGUAGES = [
    { value: 'auto', label: t('newTaskPage.languageAuto') },
    { value: 'zh', label: t('newTaskPage.languageZh') },
    { value: 'en', label: t('newTaskPage.languageEn') },
    { value: 'ja', label: t('newTaskPage.languageJa') },
    { value: 'ko', label: t('newTaskPage.languageKo') },
    { value: 'fr', label: t('newTaskPage.languageFr') },
    { value: 'de', label: t('newTaskPage.languageDe') },
  ]

  const { data: servers } = useQuery({ queryKey: ['smb-servers'], queryFn: smbApi.list })
  const selectedServer = servers?.find(server => server.id === serverId)
  const currentPath = sourceType === 'smb' ? smbPath : localPath
  const currentFavoriteId = createFavoritePathId(sourceType, currentPath, serverId ?? undefined)
  const canAddFavoritePath = sourceType === 'local' || serverId !== null
  const currentPathFavorited = favoritePaths.some(item => item.id === currentFavoriteId)

  const persistFavoritePaths = (nextFavoritePaths: FavoritePath[]) => {
    setFavoritePaths(nextFavoritePaths)
    localStorage.setItem(FAVORITE_PATHS_STORAGE_KEY, JSON.stringify(nextFavoritePaths))
  }

  const handleAddFavoritePath = () => {
    if (!canAddFavoritePath || currentPathFavorited) return
    const nextFavoritePath: FavoritePath = {
      id: currentFavoriteId,
      type: sourceType,
      path: currentPath,
      ...(sourceType === 'smb' && serverId !== null ? { serverId, serverName: selectedServer?.name } : {}),
    }
    persistFavoritePaths([...favoritePaths, nextFavoritePath])
  }

  const handleRemoveFavoritePath = (favoritePathId: string) => {
    persistFavoritePaths(favoritePaths.filter(item => item.id !== favoritePathId))
  }

  const handleOpenFavoritePath = (favoritePath: FavoritePath) => {
    setSourceType(favoritePath.type)
    setSelectedFiles([])
    if (favoritePath.type === 'smb') {
      setServerId(favoritePath.serverId ?? null)
      setSmbPath(favoritePath.path)
      return
    }
    setServerId(null)
    setLocalPath(favoritePath.path)
  }

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
  }

  const selectAll = (paths: string[]) => {
    setSelectedFiles(prev => [...prev, ...paths.filter(p => !prev.includes(p))])
  }

  const deselectAll = (paths: string[]) => {
    setSelectedFiles(prev => prev.filter(p => !paths.includes(p)))
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || (sourceType === 'smb' && !serverId)) {
      show(
        sourceType === 'smb'
          ? t('newTaskPage.missingSmbSelectionError')
          : t('newTaskPage.missingLocalSelectionError'),
        'warning',
      )
      return
    }

    setSubmitting(true)

    try {
      await tasksApi.create({
        source_type: sourceType,
        ...(sourceType === 'smb' && serverId ? { smb_server_id: serverId } : {}),
        file_paths: selectedFiles,
        source_lang: sourceLang,
        target_lang: targetLang,
        stt_engine: sttEngine,
        translate_engine: translateEngine,
        overwrite,
      })
      navigate('/tasks')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHero
        title={t('newTaskPage.title')}
        description={t('newTaskPage.heroDescription')}
      />

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard
          eyebrow={t('newTaskPage.pipelineEyebrow')}
          title={t('newTaskPage.pipelineTitle')}
          description={t('newTaskPage.pipelineDescription')}
        >
          <div className="flex min-w-0 flex-col gap-5">
            <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-4">
              <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                {t('newTaskPage.sourceTypeLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                {(['smb', 'local'] as const).map((type) => {
                  const active = sourceType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSourceType(type)
                        setSelectedFiles([])
                        if (type === 'local') {
                          setServerId(null)
                        }
                      }}
                      className={[
                        'rounded-full border px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors',
                        active
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary',
                      ].join(' ')}
                    >
                      {type === 'smb' ? t('newTaskPage.sourceSmbLabel') : t('newTaskPage.sourceLocalLabel')}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 border-t border-outline-variant pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      {t('newTaskPage.favoritePathsTitle')}
                    </p>
                    <p className="max-w-full [overflow-wrap:anywhere] text-xs text-on-surface-variant">
                      {currentPath}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFavoritePath}
                    disabled={!canAddFavoritePath || currentPathFavorited}
                    className="rounded-full border border-outline-variant px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-primary disabled:opacity-40 disabled:text-on-surface-variant"
                  >
                    {currentPathFavorited ? t('newTaskPage.favoritePathSaved') : t('newTaskPage.favoritePathAdd')}
                  </button>
                </div>

                {favoritePaths.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {favoritePaths.map((favoritePath) => (
                      <div
                        key={favoritePath.id}
                        className="flex min-w-0 items-center gap-2 rounded-2xl border border-outline-variant px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenFavoritePath(favoritePath)}
                          className="min-w-0 flex-1 overflow-hidden text-left"
                        >
                          <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary">
                            {favoritePath.type === 'smb'
                              ? t('newTaskPage.favoritePathSmb', { server: favoritePath.serverName ?? favoritePath.serverId })
                              : t('newTaskPage.favoritePathLocal')}
                          </span>
                          <span className="block max-w-full [overflow-wrap:anywhere] text-xs font-medium text-on-surface">
                            {favoritePath.path}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFavoritePath(favoritePath.id)}
                          className="shrink-0 rounded-full border border-outline-variant px-2.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-error hover:text-error"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-on-surface-variant">
                    {t('newTaskPage.favoritePathEmpty')}
                  </p>
                )}
              </div>
            </div>

            {sourceType === 'smb' ? (
              <>
                <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-4">
                  <label
                    htmlFor="new-task-server"
                    className="mb-3 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
                  >
                    {t('newTaskPage.smbServerLabel')}
                  </label>
                  <select
                    id="new-task-server"
                    aria-label={t('newTaskPage.smbServerLabel')}
                    value={serverId ?? ''}
                    onChange={e => {
                      const nextValue = e.target.value
                      setServerId(nextValue ? Number(nextValue) : null)
                      setSmbPath('/')
                      setSelectedFiles([])
                    }}
                    className="w-full rounded-2xl px-4 py-3 text-sm"
                  >
                    <option value="">{t('newTaskPage.selectServerPlaceholder')}</option>
                    {servers?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
                  </select>
                </div>

                {serverId ? (
                  <SMBFileBrowser serverId={serverId} path={smbPath} selected={selectedFiles} onPathChange={setSmbPath} onToggle={toggleFile} onSelectAll={selectAll} onDeselectAll={deselectAll} />
                ) : ""}
              </>
            ) : (
              <LocalFileBrowser path={localPath} selected={selectedFiles} onPathChange={setLocalPath} onToggle={toggleFile} onSelectAll={selectAll} onDeselectAll={deselectAll} />
            )}
          </div>
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard
            eyebrow={t('newTaskPage.profileEyebrow')}
            title={t('newTaskPage.profileTitle')}
            description={t('newTaskPage.profileDescription')}
          >
            <div className="grid min-w-0 gap-4">
              <EngineSelector
                id="new-task-source-lang"
                label={t('newTaskPage.sourceLanguageLabel')}
                value={sourceLang}
                onChange={setSourceLang}
                options={LANGUAGES}
              />
              <EngineSelector
                id="new-task-target-lang"
                label={t('newTaskPage.targetLanguageLabel')}
                value={targetLang}
                onChange={setTargetLang}
                options={LANGUAGES.filter(l => l.value !== 'auto')}
              />
              <EngineSelector
                id="new-task-stt-engine"
                label={t('newTaskPage.sttEngineLabel')}
                value={sttEngine}
                onChange={setSttEngine}
                options={STT_ENGINES}
              />
              <EngineSelector
                id="new-task-translate-engine"
                label={t('newTaskPage.translationEngineLabel')}
                value={translateEngine}
                onChange={setTranslateEngine}
                options={TRANSLATE_ENGINES}
              />

              <label className="flex items-center gap-3 rounded-[20px] border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant bg-surface custom-checkbox"
                />
                <span className="font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  {t('newTaskPage.overwriteLabel')}
                </span>
              </label>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow={t('newTaskPage.reviewEyebrow')}
            title={t('newTaskPage.reviewTitle')}
            description={t('newTaskPage.reviewDescription')}
          >
            <div className="min-w-0 space-y-4">
              {selectedFiles.length > 0 ? (
                <ul className="space-y-3">
                  {selectedFiles.map((filePath) => (
                    <li
                      key={filePath}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-outline-variant bg-surface-container-low p-3"
                    >
                      <span className="truncate text-sm font-medium text-on-surface">
                        {filePath.split('/').pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleFile(filePath)}
                        className="rounded-full border border-outline-variant px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-error transition-colors hover:border-error"
                      >
                        {t('common.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-[18px] border border-dashed border-outline-variant bg-surface-container-low p-5 text-sm text-on-surface-variant">
                  {t('newTaskPage.selectionEmpty')}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <p className="text-sm text-on-surface-variant">{t('newTaskPage.submitHint')}</p>
                <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting
                    ? t('newTaskPage.submitting')
                    : t('newTaskPage.submitCount', { count: selectedFiles.length })}
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
