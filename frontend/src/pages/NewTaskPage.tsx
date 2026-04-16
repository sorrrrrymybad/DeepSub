import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { smbApi } from '../api/smb'
import { tasksApi } from '../api/tasks'
import SMBFileBrowser from '../components/SMBFileBrowser'
import EngineSelector from '../components/EngineSelector'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import SectionCard from '../components/page/SectionCard'
import StatCard from '../components/page/StatCard'
import { useToast } from '../context/ToastContext'

export default function NewTaskPage() {
  const { t } = useTranslation()
  const { show } = useToast()
  const navigate = useNavigate()
  const [serverId, setServerId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh')
  const [sttEngine, setSttEngine] = useState('whisper_local')
  const [translateEngine, setTranslateEngine] = useState('deeplx')
  const [overwrite, setOverwrite] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const STT_ENGINES = [
    { value: 'whisper_local', label: t('engines.whisperLocal') },
    { value: 'openai_whisper', label: t('engines.whisperApi') },
  ]

  const TRANSLATE_ENGINES = [
    { value: 'deeplx', label: t('engines.deeplx') },
    { value: 'deepl', label: t('engines.deepl') },
    { value: 'google', label: t('engines.google') },
    { value: 'openai', label: t('engines.openai') },
    { value: 'claude', label: t('engines.claude') },
  ]

  const LANGUAGES = [
    { value: 'auto', label: t('lang.auto') },
    { value: 'zh', label: t('lang.zh') },
    { value: 'en', label: t('lang.en') },
    { value: 'ja', label: t('lang.ja') },
    { value: 'ko', label: t('lang.ko') },
    { value: 'fr', label: t('lang.fr') },
    { value: 'de', label: t('lang.de') },
  ]

  const { data: servers } = useQuery({ queryKey: ['smb-servers'], queryFn: smbApi.list })

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
    if (!serverId || selectedFiles.length === 0) {
      show(t('newTask.errNoFiles'), 'warning')
      return
    }

    setSubmitting(true)

    try {
      await tasksApi.create({
        smb_server_id: serverId,
        file_paths: selectedFiles,
        source_lang: sourceLang,
        target_lang: targetLang,
        stt_engine: sttEngine,
        translate_engine: translateEngine,
        overwrite,
      })
      navigate('/tasks')
    } catch (e: any) {
      show(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        // eyebrow="Task Intake"
        title={t('newTask.title')}
        description={t('newTask.heroDesc')}
        // aside={
        //   <div className="space-y-3 rounded-[22px] border border-outline-variant bg-surface-container-low px-4 py-4 shadow-[var(--shadow-soft)]">
        //     <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        //       Dispatch Readiness
        //     </p>
        //     <p className="text-3xl font-black tracking-[-0.05em] text-on-surface">{selectedFiles.length}</p>
        //     <p className="text-sm text-on-surface-variant">
        //       {t('newTask.selectedArgs', { count: selectedFiles.length })}
        //     </p>
        //   </div>
        // }
      />

      {/*<div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={t('newTask.smbServer')}
          value={serverId ? 1 : 0}
          hint={serverId ? servers?.find((server) => server.id === serverId)?.name : t('newTask.selectServer')}
        />
        <StatCard
          title={t('newTask.selectionTitle')}
          value={selectedFiles.length}
          hint={t('newTask.selectionDesc')}
          tone="accent"
        />
        <StatCard
          title={t('newTask.transEngine')}
          value={translateEngine}
          hint={t('newTask.submitHint')}
        />
      </div>*/}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard
          eyebrow="SERVER"
          title={t('newTask.pipelineTitle')}
          description={t('newTask.pipelineDesc')}
        >
          <div className="flex flex-col gap-5">
            <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-4">
              <label
                htmlFor="new-task-server"
                className="mb-3 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
              >
                {t('newTask.smbServer')}
              </label>
              <select
                id="new-task-server"
                aria-label={t('newTask.smbServer')}
                value={serverId ?? ''}
                onChange={e => {
                  const nextValue = e.target.value
                  setServerId(nextValue ? Number(nextValue) : null)
                  setSelectedFiles([])
                }}
                className="w-full rounded-2xl px-4 py-3 text-sm"
              >
                <option value="">{t('newTask.selectServer')}</option>
                {servers?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
              </select>
            </div>

            {serverId ? (
              <SMBFileBrowser serverId={serverId} selected={selectedFiles} onToggle={toggleFile} onSelectAll={selectAll} onDeselectAll={deselectAll} />
            ) : ""}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-6">
          <SectionCard
            eyebrow="Profile"
            title={t('newTask.profileTitle')}
            description={t('newTask.profileDesc')}
          >
            <div className="grid gap-4">
              <EngineSelector
                id="new-task-source-lang"
                label={t('newTask.sourceLang')}
                value={sourceLang}
                onChange={setSourceLang}
                options={LANGUAGES}
              />
              <EngineSelector
                id="new-task-target-lang"
                label={t('newTask.targetLang')}
                value={targetLang}
                onChange={setTargetLang}
                options={LANGUAGES.filter(l => l.value !== 'auto')}
              />
              <EngineSelector
                id="new-task-stt-engine"
                label={t('newTask.sttEngine')}
                value={sttEngine}
                onChange={setSttEngine}
                options={STT_ENGINES}
              />
              <EngineSelector
                id="new-task-translate-engine"
                label={t('newTask.transEngine')}
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
                  {t('newTask.overwrite')}
                </span>
              </label>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Review"
            title={t('newTask.selectionTitle')}
            description={t('newTask.selectionDesc')}
          >
            <div className="space-y-4">
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
                  {t('newTask.selectionEmpty')}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <p className="text-sm text-on-surface-variant">{t('newTask.submitHint')}</p>
                <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? t('newTask.executing') : t('newTask.commitOps', { count: selectedFiles.length })}
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
