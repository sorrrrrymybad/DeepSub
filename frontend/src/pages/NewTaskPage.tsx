import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { smbApi } from '../api/smb'
import { tasksApi } from '../api/tasks'
import SMBFileBrowser from '../components/SMBFileBrowser'
import EngineSelector from '../components/EngineSelector'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'

export default function NewTaskPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [serverId, setServerId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh')
  const [sttEngine, setSttEngine] = useState('whisper_local')
  const [translateEngine, setTranslateEngine] = useState('deeplx')
  const [overwrite, setOverwrite] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const STT_ENGINES = [
    { value: 'whisper_local', label: t('engines.whisperLocal') },
    { value: 'openai_whisper', label: t('engines.whisperApi') },
  ]

  const TRANSLATE_ENGINES = [
    { value: 'deeplx', label: t('engines.deeplx') },
    { value: 'deepl', label: t('engines.deepl') },
    { value: 'google', label: t('engines.google') },
    { value: 'openai', label: t('engines.llm') },
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

  const handleSubmit = async () => {
    if (!serverId || selectedFiles.length === 0) {
      setError(t('newTask.errNoFiles'))
      return
    }
    setSubmitting(true)
    setError('')
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
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] text-on-surface">{t('newTask.title')}</h1>

      <div className="flex flex-col gap-8 bg-surface-container-lowest p-8 border border-outline-variant shadow-sm">
        <div>
          <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em] mb-2">{t('newTask.smbServer')}</label>
          <select value={serverId ?? ''} onChange={e => { setServerId(Number(e.target.value)); setSelectedFiles([]) }}
                  className="w-full bg-background border border-outline-variant rounded-none px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none">
            <option value="">{t('newTask.selectServer')}</option>
            {servers?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
          </select>
        </div>

        {serverId && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em]">{t('newTask.targetFiles')}</label>
              {selectedFiles.length > 0 && <span className="text-[0.6875rem] text-primary uppercase font-bold">{t('newTask.selectedArgs', { count: selectedFiles.length })}</span>}
            </div>
            <SMBFileBrowser serverId={serverId} selected={selectedFiles} onToggle={toggleFile} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          <EngineSelector label={t('newTask.sourceLang')} value={sourceLang} onChange={setSourceLang} options={LANGUAGES} />
          <EngineSelector label={t('newTask.targetLang')} value={targetLang} onChange={setTargetLang} options={LANGUAGES.filter(l => l.value !== 'auto')} />
          <EngineSelector label={t('newTask.sttEngine')} value={sttEngine} onChange={setSttEngine} options={STT_ENGINES} />
          <EngineSelector label={t('newTask.transEngine')} value={translateEngine} onChange={setTranslateEngine} options={TRANSLATE_ENGINES} />
        </div>

        <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer group w-fit">
          <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} 
                 className="w-4 h-4 text-primary bg-background border-outline-variant focus:ring-primary focus:ring-1 rounded-none appearance-none checked:bg-primary custom-checkbox cursor-pointer" />
          <span className="uppercase tracking-[0.05em] text-[0.6875rem] font-medium group-hover:text-primary transition-colors">{t('newTask.overwrite')}</span>
        </label>

        {selectedFiles.length > 0 && (
          <div className="bg-surface p-4 text-sm mt-4 border border-outline-variant border-opacity-20 text-on-surface">
            <p className="text-[0.6875rem] tracking-[0.05em] text-on-surface-variant mb-4 uppercase">{t('newTask.selectedIndex')}</p>
            <ul className="flex flex-col gap-2">
              {selectedFiles.map(f => (
                <li key={f} className="flex items-center justify-between group">
                  <span className="truncate">{f.split('/').pop()}</span>
                  <button onClick={() => toggleFile(f)} className="text-error uppercase text-[0.6875rem] font-medium opacity-0 group-hover:opacity-100 tracking-[0.05em] transition-opacity">{t('common.remove')}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-[0.6875rem] font-medium tracking-[0.05em] text-error bg-error-container p-3 uppercase">{error}</p>}

        <Button variant="primary" onClick={handleSubmit} disabled={submitting} className="mt-4 py-3">
          {submitting ? t('newTask.executing') : t('newTask.commitOps', { count: selectedFiles.length })}
        </Button>
      </div>
    </div>
  )
}
