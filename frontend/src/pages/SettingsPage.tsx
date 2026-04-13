import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { smbApi, type CreateSMBPayload } from '../api/smb'
import { settingsApi } from '../api/settings'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'

function SMBServerSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: servers } = useQuery({ queryKey: ['smb-servers'], queryFn: smbApi.list })
  const [form, setForm] = useState<CreateSMBPayload>({
    name: '', host: '', port: 445, share: '', username: '', password: '',
  })
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<Record<number, string>>({})

  const handleCreate = async () => {
    await smbApi.create(form)
    qc.invalidateQueries({ queryKey: ['smb-servers'] })
    setForm({ name: '', host: '', port: 445, share: '', username: '', password: '' })
  }

  const handleTest = async (id: number) => {
    setTesting(id)
    try {
      const result = await smbApi.test(id)
      setTestResult(r => ({ ...r, [id]: result.ok ? t('common.success') : result.error ?? t('common.failed') }))
    } catch {
      setTestResult(r => ({ ...r, [id]: t('common.error') }))
    }
    setTesting(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.confirmDel'))) return
    await smbApi.delete(id)
    qc.invalidateQueries({ queryKey: ['smb-servers'] })
  }

  const formFields = [
    { key: 'name', label: t('settings.name') },
    { key: 'host', label: t('settings.host') },
    { key: 'share', label: t('settings.share') },
    { key: 'username', label: t('settings.username') },
    { key: 'password', label: t('settings.password') }
  ] as const

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-[1.125rem] font-medium tracking-[-0.02em] text-on-surface uppercase border-b border-outline-variant pb-2">{t('settings.smbServers')}</h2>
      
      <div className="flex flex-col gap-4">
        {servers?.map(s => (
          <div key={s.id} className="flex items-start justify-between p-6 bg-surface-container-lowest border border-outline-variant shadow-sm transition-colors hover:bg-surface border-opacity-30">
            <div className="flex flex-col gap-1">
              <p className="font-bold text-sm tracking-wide text-on-surface uppercase">{s.name}</p>
              <p className="text-[0.6875rem] text-on-surface-variant font-mono">{s.username}@{s.host}/{s.share}</p>
              {testResult[s.id] && (
                <p className={`text-[0.6875rem] mt-2 font-medium tracking-[0.05em] uppercase ${testResult[s.id] === t('common.success') ? 'text-primary' : 'text-error'}`}>
                  {testResult[s.id]}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              <button onClick={() => handleTest(s.id)} disabled={testing === s.id}
                      className="text-[0.6875rem] font-medium tracking-[0.05em] uppercase text-primary hover:text-primary-dim transition-colors disabled:opacity-50">
                {testing === s.id ? t('settings.testing') : t('settings.ping')}
              </button>
              <button onClick={() => handleDelete(s.id)} 
                      className="text-[0.6875rem] font-medium tracking-[0.05em] uppercase text-on-surface-variant hover:text-error transition-colors">
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 bg-surface-container-low p-8 mt-4">
        <p className="col-span-2 text-[0.6875rem] font-medium tracking-[0.05em] text-on-surface uppercase">{t('settings.addServer')}</p>
        
        {formFields.map(field => (
          <div key={field.key}>
            <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em] mb-2">{field.label}</label>
            <input type={field.key === 'password' ? 'password' : 'text'}
                   value={String(form[field.key])} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                   className="w-full bg-surface-container-lowest border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
          </div>
        ))}
        <div>
          <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em] mb-2">{t('settings.port')}</label>
          <input type="number" value={form.port}
                 onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))}
                 className="w-full bg-surface-container-lowest border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
        </div>
        <div className="col-span-2 mt-4">
          <Button variant="primary" onClick={handleCreate}>{t('settings.attachServer')}</Button>
        </div>
      </div>
    </section>
  )
}

function EngineConfigSection() {
  const { t } = useTranslation()
  const { data: sttData } = useQuery({ queryKey: ['settings-stt'], queryFn: settingsApi.getSTT })
  const { data: translateData } = useQuery({ queryKey: ['settings-translate'], queryFn: settingsApi.getTranslate })
  const qc = useQueryClient()
  const [sttForm, setSttForm] = useState<Record<string, string>>({})
  const [translateForm, setTranslateForm] = useState<Record<string, string>>({})

  const handleSaveSTT = async () => {
    await settingsApi.patchSTT(sttForm)
    qc.invalidateQueries({ queryKey: ['settings-stt'] })
    alert(t('settings.sttSaved'))
  }

  const handleSaveTranslate = async () => {
    await settingsApi.patchTranslate(translateForm)
    qc.invalidateQueries({ queryKey: ['settings-translate'] })
    alert(t('settings.transSaved'))
  }

  const STT_FIELDS = [
    { key: 'whisper_local_model_size', label: t('settings.fields.whisperLocal'), secret: false },
    { key: 'openai_whisper_api_key', label: t('settings.fields.openaiWhisper'), secret: true },
  ]

  const TRANSLATE_FIELDS = [
    { key: 'deeplx_endpoint', label: t('settings.fields.deeplxEndpoint'), secret: false },
    { key: 'deepl_api_key', label: t('settings.fields.deeplKey'), secret: true },
    { key: 'google_api_key', label: t('settings.fields.googleKey'), secret: true },
    { key: 'openai_api_key', label: t('settings.fields.openaiKey'), secret: true },
    { key: 'openai_model', label: t('settings.fields.openaiModel'), secret: false },
    { key: 'openai_base_url', label: t('settings.fields.openaiBase'), secret: false },
    { key: 'claude_api_key', label: t('settings.fields.claudeKey'), secret: true },
    { key: 'claude_model', label: t('settings.fields.claudeModel'), secret: false },
    { key: 'claude_base_url', label: t('settings.fields.claudeBase'), secret: false },
  ]

  return (
    <section className="flex flex-col gap-10 mt-12">
      <div className="flex flex-col gap-6">
        <h2 className="text-[1.125rem] font-medium tracking-[-0.02em] text-on-surface uppercase border-b border-outline-variant pb-2">{t('settings.sttTitle')}</h2>
        <div className="bg-surface-container-lowest p-8 border border-outline-variant shadow-sm flex flex-col gap-6">
          {STT_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em] mb-2">{f.label}</label>
              <input type={f.secret ? 'password' : 'text'}
                     placeholder={sttData?.[f.key] ?? ''}
                     onChange={e => setSttForm(s => ({ ...s, [f.key]: e.target.value }))}
                     className="w-full bg-background border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono" />
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={handleSaveSTT}>{t('settings.commitStt')}</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-[1.125rem] font-medium tracking-[-0.02em] text-on-surface uppercase border-b border-outline-variant pb-2">{t('settings.transTitle')}</h2>
        <div className="bg-surface-container-lowest p-8 border border-outline-variant shadow-sm flex flex-col gap-6">
          {TRANSLATE_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em] mb-2">{f.label}</label>
              <input type={f.secret ? 'password' : 'text'}
                     placeholder={translateData?.[f.key] ?? ''}
                     onChange={e => setTranslateForm(s => ({ ...s, [f.key]: e.target.value }))}
                     className="w-full bg-background border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono" />
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={handleSaveTranslate}>{t('settings.commitTrans')}</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] text-on-surface">{t('settings.title')}</h1>
      <SMBServerSection />
      <EngineConfigSection />
    </div>
  )
}
