import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { smbApi, type CreateSMBPayload } from '../api/smb'
import { settingsApi, type TranslationProfile } from '../api/settings'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import SectionCard from '../components/page/SectionCard'
import SettingsDirectory from '../components/SettingsDirectory'
import { useToast } from '../context/ToastContext'

type SettingsSectionId = 'system' | 'smb' | 'stt' | 'translate'

interface ConfigField {
  key: string
  label: string
  secret?: boolean
  textarea?: boolean
  placeholder?: string
}

function FormField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  id: string
  label: string
  value?: string | number
  onChange: (value: string) => void
  type?: 'text' | 'password' | 'number'
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="w-full rounded-2xl px-4 py-3 text-sm"
      />
    </div>
  )
}

function ConfigFieldsSection({
  fields,
  values,
  onChange,
}: {
  fields: ConfigField[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) =>
        field.textarea ? (
          <div key={field.key} className="md:col-span-2">
            <label htmlFor={field.key} className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {field.label}
            </label>
            <textarea
              id={field.key}
              rows={4}
              value={values[field.key] ?? ''}
              placeholder={field.placeholder ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              autoComplete="off"
              className="w-full rounded-2xl px-4 py-3 text-sm resize-none"
            />
          </div>
        ) : (
          <FormField
            key={field.key}
            id={field.key}
            label={field.label}
            type={field.secret ? 'password' : 'text'}
            value={values[field.key] ?? ''}
            placeholder={values[field.key] ?? ''}
            onChange={(value) => onChange(field.key, value)}
          />
        ),
      )}
    </div>
  )
}

function TranslationProfileEditor({
  provider,
  title,
  profiles,
  activeProfileId,
  values,
  onProfileChange,
  onFieldChange,
  onCreate,
  onSave,
  onDelete,
  onActivate,
}: {
  provider: 'openai' | 'claude'
  title: string
  profiles: TranslationProfile[]
  activeProfileId: number | null
  values: Record<string, string>
  onProfileChange: (profileId: number | 'new') => void
  onFieldChange: (key: string, value: string) => void
  onCreate: () => void
  onSave: () => void
  onDelete: () => void
  onActivate: () => void
}) {
  const { t } = useTranslation()
  const currentProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null

  return (
    <div className="rounded-[22px] border border-outline-variant bg-surface-container-low p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant underline">{title}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{t('settingsPage.translationProfileGroupTitle')}</p>
        </div>
        {currentProfile?.is_active ? (
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{t('settingsPage.translationProfileActiveBadge')}</span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{t('settingsPage.translationProfileSelectLabel')}</label>
          <select
            value={activeProfileId ?? 'new'}
            onChange={(e) => onProfileChange(e.target.value === 'new' ? 'new' : Number(e.target.value))}
            className="w-full rounded-2xl px-4 py-3 text-sm"
          >
            <option value="new">{t('settingsPage.translationProfileEmpty')}</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}{profile.is_active ? ` (${t('settingsPage.translationProfileActiveBadge')})` : ''}
              </option>
            ))}
          </select>
        </div>
        <FormField
          id={`${provider}-profile-name`}
          label={t('settingsPage.translationProfileNameLabel')}
          value={values.name ?? ''}
          onChange={(value) => onFieldChange('name', value)}
        />
        <FormField
          id={`${provider}-profile-api-key`}
          label={t('settingsPage.translationProfileApiKeyLabel')}
          type="password"
          value={values.api_key ?? ''}
          onChange={(value) => onFieldChange('api_key', value)}
        />
        <FormField
          id={`${provider}-profile-model`}
          label={t('settingsPage.translationProfileModelLabel')}
          value={values.model ?? ''}
          onChange={(value) => onFieldChange('model', value)}
        />
        <FormField
          id={`${provider}-profile-base-url`}
          label={t('settingsPage.translationProfileBaseUrlLabel')}
          value={values.base_url ?? ''}
          onChange={(value) => onFieldChange('base_url', value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCreate}>{t('settingsPage.translationProfileCreateButton')}</Button>
        <Button variant="secondary" onClick={onSave}>{t('settingsPage.translationProfileSaveButton')}</Button>
        <Button variant="secondary" onClick={onActivate} disabled={!activeProfileId}>{t('settingsPage.translationProfileActivateButton')}</Button>
        <Button variant="secondary" onClick={onDelete} disabled={!activeProfileId}>{t('settingsPage.translationProfileDeleteButton')}</Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { show } = useToast()
  const qc = useQueryClient()
  const { data: servers } = useQuery({ queryKey: ['smb-servers'], queryFn: smbApi.list })
  const { data: systemData } = useQuery({ queryKey: ['settings-system'], queryFn: settingsApi.getSystem })
  const { data: sttData } = useQuery({ queryKey: ['settings-stt'], queryFn: settingsApi.getSTT })
  const { data: translateData } = useQuery({ queryKey: ['settings-translate'], queryFn: settingsApi.getTranslate })
  const { data: openaiProfilesData } = useQuery({ queryKey: ['settings-translate-profiles', 'openai'], queryFn: () => settingsApi.listTranslateProfiles('openai') })
  const { data: claudeProfilesData } = useQuery({ queryKey: ['settings-translate-profiles', 'claude'], queryFn: () => settingsApi.listTranslateProfiles('claude') })

  const [form, setForm] = useState<CreateSMBPayload>({ name: '', host: '', port: 445, share: '', username: '', password: '' })
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; error?: string }>>({})
  const [systemForm, setSystemForm] = useState<Record<string, string>>({})
  const [sttForm, setSttForm] = useState<Record<string, string>>({})
  const [translateForm, setTranslateForm] = useState<Record<string, string>>({})
  const [openaiActiveProfileId, setOpenaiActiveProfileId] = useState<number | null>(null)
  const [claudeActiveProfileId, setClaudeActiveProfileId] = useState<number | null>(null)
  const [openaiDraft, setOpenaiDraft] = useState<Record<string, string>>({})
  const [claudeDraft, setClaudeDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (translateData) {
      setTranslateForm((current) => ({
        batch_size: current.batch_size ?? translateData.batch_size ?? '1',
        deeplx_endpoint: current.deeplx_endpoint ?? translateData.deeplx_endpoint ?? '',
        deepl_api_key: current.deepl_api_key ?? translateData.deepl_api_key ?? '',
        google_api_key: current.google_api_key ?? translateData.google_api_key ?? '',
        translate_prompt: current.translate_prompt ?? translateData.translate_prompt ?? '',
      }))
    }
  }, [translateData])

  useEffect(() => {
    if (openaiProfilesData) {
      const active = openaiProfilesData.active_profile_id ?? openaiProfilesData.profiles[0]?.id ?? null
      setOpenaiActiveProfileId(active)
      const profile = openaiProfilesData.profiles.find((item) => item.id === active) ?? openaiProfilesData.active_profile ?? null
      setOpenaiDraft({
        name: profile?.name ?? '',
        api_key: '',
        model: profile?.model ?? '',
        base_url: profile?.base_url ?? '',
      })
    }
  }, [openaiProfilesData])

  useEffect(() => {
    if (claudeProfilesData) {
      const active = claudeProfilesData.active_profile_id ?? claudeProfilesData.profiles[0]?.id ?? null
      setClaudeActiveProfileId(active)
      const profile = claudeProfilesData.profiles.find((item) => item.id === active) ?? claudeProfilesData.active_profile ?? null
      setClaudeDraft({
        name: profile?.name ?? '',
        api_key: '',
        model: profile?.model ?? '',
        base_url: profile?.base_url ?? '',
      })
    }
  }, [claudeProfilesData])

  const currentModelSize = sttForm['whisper_local_model_size'] ?? sttData?.['whisper_local_model_size'] ?? 'base'

  const { data: whisperStatus, refetch: refetchWhisperStatus } = useQuery({
    queryKey: ['whisper-status', currentModelSize],
    queryFn: () => settingsApi.getWhisperStatus(currentModelSize),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.downloading) return 1000
      return false
    },
    enabled: !!currentModelSize,
  })

  const [isSubmittingDownload, setIsSubmittingDownload] = useState(false)

  const handleWhisperDownload = async () => {
    if (isSubmittingDownload || whisperStatus?.downloading) return
    setIsSubmittingDownload(true)
    try {
      const result = await settingsApi.postWhisperDownload(currentModelSize)
      if (result.reason === 'already_exists') {
        show(t('settingsPage.whisperAlreadyExistsToast'), 'success')
      } else if (result.ok) {
        show(t('settingsPage.whisperDownloadStartedToast'), 'success')
      } else if (result.error) {
        show(t('settingsPage.whisperDownloadErrorToast', { msg: result.error }), 'error')
      }
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    } finally {
      setIsSubmittingDownload(false)
      void refetchWhisperStatus()
    }
  }

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('smb')
  const sectionRefs = {
    system: useRef<HTMLElement | null>(null),
    smb: useRef<HTMLElement | null>(null),
    stt: useRef<HTMLElement | null>(null),
    translate: useRef<HTMLElement | null>(null),
  }

  const sections = useMemo(() => [
    { id: 'system', label: t('settingsPage.systemSectionTitle'), description: t('settingsPage.systemSectionDescription') },
    { id: 'smb', label: t('settingsPage.smbSectionTitle'), description: t('settingsPage.smbSectionDescription') },
    { id: 'stt', label: t('settingsPage.sttSectionTitle'), description: t('settingsPage.sttSectionDescription') },
    { id: 'translate', label: t('settingsPage.translateSectionTitle'), description: t('settingsPage.translateSectionDescription') },
  ] satisfies Array<{ id: SettingsSectionId; label: string; description: string }>, [t])

  useEffect(() => {
    const handleScroll = () => {
      const entries = (Object.entries(sectionRefs) as Array<[SettingsSectionId, typeof sectionRefs.smb]>)
        .map(([id, ref]) => ({ id, top: ref.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY }))
        .filter((item) => Number.isFinite(item.top))

      const current = entries.filter((item) => item.top <= 130).sort((a, b) => b.top - a.top)[0] ?? entries.sort((a, b) => a.top - b.top)[0]
      if (current) setActiveSection(current.id)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (sectionId: SettingsSectionId) => {
    setActiveSection(sectionId)
    sectionRefs[sectionId].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCreate = async () => {
    try {
      await smbApi.create(form)
      qc.invalidateQueries({ queryKey: ['smb-servers'] })
      setForm({ name: '', host: '', port: 445, share: '', username: '', password: '' })
      show(t('settingsPage.serverAddedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleTest = async (id: number) => {
    setTesting(id)
    setTestResult((current) => { const next = { ...current }; delete next[id]; return next })
    try {
      const result = await smbApi.test(id)
      setTestResult((current) => ({ ...current, [id]: { ok: result.ok, error: result.error } }))
      if (!result.ok && result.error) show(result.error, 'error')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.error')
      setTestResult((current) => ({ ...current, [id]: { ok: false, error: msg } }))
      show(msg, 'error')
    }
    setTesting(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('settingsPage.confirmDeleteServer'))) return
    try {
      await smbApi.delete(id)
      qc.invalidateQueries({ queryKey: ['smb-servers'] })
      show(t('settingsPage.serverDeletedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleSaveSystem = async () => {
    try {
      await settingsApi.patchSystem(systemForm)
      qc.invalidateQueries({ queryKey: ['settings-system'] })
      show(t('settingsPage.systemSavedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleSaveSTT = async () => {
    try {
      await settingsApi.patchSTT(sttForm)
      qc.invalidateQueries({ queryKey: ['settings-stt'] })
      show(t('settingsPage.sttSavedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleSaveTranslate = async () => {
    try {
      await settingsApi.patchTranslate(translateForm)
      qc.invalidateQueries({ queryKey: ['settings-translate'] })
      show(t('settingsPage.translateSavedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleProfileSave = async (provider: 'openai' | 'claude') => {
    const draft = provider === 'openai' ? openaiDraft : claudeDraft
    const activeProfileId = provider === 'openai' ? openaiActiveProfileId : claudeActiveProfileId
    try {
      if (activeProfileId) {
        await settingsApi.updateTranslateProfile(provider, activeProfileId, {
          name: draft.name ?? '',
          api_key: draft.api_key ?? '',
          model: draft.model ?? '',
          base_url: draft.base_url || null,
        })
      } else {
        const created = await settingsApi.createTranslateProfile(provider, {
          name: draft.name ?? 'Default',
          api_key: draft.api_key ?? '',
          model: draft.model ?? '',
          base_url: draft.base_url || null,
        })
        if (created.profile?.id) {
          if (provider === 'openai') {
            setOpenaiActiveProfileId(created.profile.id)
          } else {
            setClaudeActiveProfileId(created.profile.id)
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ['settings-translate-profiles', provider] })
      show(t('settingsPage.translateSavedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleProfileActivate = async (provider: 'openai' | 'claude') => {
    const activeProfileId = provider === 'openai' ? openaiActiveProfileId : claudeActiveProfileId
    if (!activeProfileId) return
    try {
      await settingsApi.setActiveTranslateProfile(provider, activeProfileId)
      await qc.invalidateQueries({ queryKey: ['settings-translate'] })
      await qc.invalidateQueries({ queryKey: ['settings-translate-profiles', provider] })
      show(t('settingsPage.translateSavedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleProfileDelete = async (provider: 'openai' | 'claude') => {
    const activeProfileId = provider === 'openai' ? openaiActiveProfileId : claudeActiveProfileId
    if (!activeProfileId) return
    try {
      await settingsApi.deleteTranslateProfile(provider, activeProfileId)
      await qc.invalidateQueries({ queryKey: ['settings-translate-profiles', provider] })
      show(t('settingsPage.translateSavedToast'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleProfileCreate = (provider: 'openai' | 'claude') => {
    if (provider === 'openai') {
      setOpenaiActiveProfileId(null)
      setOpenaiDraft({ name: '', api_key: '', model: '', base_url: '' })
    } else {
      setClaudeActiveProfileId(null)
      setClaudeDraft({ name: '', api_key: '', model: '', base_url: '' })
    }
  }

  const handleProfileSelect = (provider: 'openai' | 'claude', profileId: number | 'new') => {
    const data = provider === 'openai' ? openaiProfilesData : claudeProfilesData
    if (profileId === 'new') {
      handleProfileCreate(provider)
      return
    }
    const profile = data?.profiles.find((item) => item.id === profileId) ?? null
    if (provider === 'openai') {
      setOpenaiActiveProfileId(profileId)
      setOpenaiDraft({
        name: profile?.name ?? '',
        api_key: '',
        model: profile?.model ?? '',
        base_url: profile?.base_url ?? '',
      })
    } else {
      setClaudeActiveProfileId(profileId)
      setClaudeDraft({
        name: profile?.name ?? '',
        api_key: '',
        model: profile?.model ?? '',
        base_url: profile?.base_url ?? '',
      })
    }
  }

  const serverFields = [
    { key: 'name', label: t('settingsPage.nameLabel') },
    { key: 'host', label: t('settingsPage.hostLabel') },
    { key: 'share', label: t('settingsPage.shareLabel') },
    { key: 'username', label: t('settingsPage.usernameLabel') },
    { key: 'password', label: t('settingsPage.passwordLabel'), type: 'password' as const },
    { key: 'port', label: t('settingsPage.portLabel'), type: 'number' as const },
  ]

  const translateGeneralFields: ConfigField[] = [
    { key: 'batch_size', label: t('settingsPage.batchSizeLabel') },
    { key: 'translate_prompt', label: t('settingsPage.translatePromptLabel'), textarea: true, placeholder: t('settingsPage.translatePromptPlaceholder') },
  ]

  const translateProviderFields: ConfigField[] = [
    { key: 'deeplx_endpoint', label: t('settingsPage.deeplxEndpointLabel'), textarea: true, placeholder: t('settingsPage.deeplxEndpointPlaceholder') },
    { key: 'deepl_api_key', label: t('settingsPage.deeplApiKeyLabel'), secret: true },
    { key: 'google_api_key', label: t('settingsPage.googleApiKeyLabel'), secret: true },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHero title={t('settingsPage.title')} description={t('settingsPage.heroDescription')} />
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <SettingsDirectory title={t('settingsPage.directoryTitle')} sections={sections} activeSection={activeSection} onSelect={(sectionId) => scrollToSection(sectionId as SettingsSectionId)} />
        <div className="flex flex-col gap-6">
          <section ref={sectionRefs.system} className="scroll-mt-[122px]">
            <SectionCard eyebrow={t('settingsPage.systemEyebrow')} title={t('settingsPage.systemSectionTitle')} description={t('settingsPage.systemSectionDescription')} actions={<Button variant="secondary" onClick={handleSaveSystem}>{t('settingsPage.saveSystemButton')}</Button>}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField id="worker_concurrency" label={t('settingsPage.workerConcurrencyLabel')} type="number" value={systemForm['worker_concurrency'] ?? systemData?.['worker_concurrency'] ?? '2'} onChange={(value) => setSystemForm((current) => ({ ...current, worker_concurrency: value }))} />
              </div>
            </SectionCard>
          </section>

          <section ref={sectionRefs.smb} className="scroll-mt-[122px]">
            <SectionCard eyebrow={t('settingsPage.storageEyebrow')} title={t('settingsPage.smbSectionTitle')} description={t('settingsPage.smbSectionDescription')}>
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {servers?.map((server) => {
                    const result = testResult[server.id]
                    const isTesting = testing === server.id
                    const testBtnClass = result
                      ? result.ok
                        ? 'border-[var(--color-success,#22c55e)] bg-[var(--color-success,#22c55e)]/10 text-[var(--color-success,#22c55e)] hover:bg-[var(--color-success,#22c55e)]/20'
                        : 'border-error bg-error-container text-on-error-container hover:bg-error/20'
                      : ''
                    return (
                      <div key={server.id} className="flex flex-col gap-3 rounded-[20px] border border-outline-variant bg-surface-container-low p-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-base font-bold tracking-[-0.03em] text-on-surface">{server.name}</p>
                          <p className="truncate text-sm text-on-surface-variant">{server.username}@{server.host}/{server.share}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => void handleTest(server.id)} disabled={isTesting} className={[ 'inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50', testBtnClass || 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary hover:text-primary', ].join(' ')}>
                            {isTesting ? t('settingsPage.testingButton') : result ? result.ok ? t('common.success') : t('common.failed') : t('settingsPage.testConnectionButton')}
                          </button>
                          <button type="button" onClick={() => handleDelete(server.id)} className="inline-flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-error hover:text-error">{t('common.delete')}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="rounded-[22px] border border-outline-variant bg-surface-container-low p-5">
                  <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{t('settingsPage.addServerTitle')}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {serverFields.map((field) => (
                      <FormField key={field.key} id={`server-${field.key}`} label={field.label} type={field.type} value={String(form[field.key as keyof CreateSMBPayload] ?? '')} onChange={(value) => setForm((current) => ({ ...current, [field.key]: field.type === 'number' ? Number(value) : value }))} />
                    ))}
                  </div>
                  <div className="mt-5"><Button variant="primary" onClick={handleCreate}>{t('settingsPage.attachServerButton')}</Button></div>
                </div>
              </div>
            </SectionCard>
          </section>

          <section ref={sectionRefs.stt} className="scroll-mt-[122px]">
            <SectionCard eyebrow={t('settingsPage.speechEyebrow')} title={t('settingsPage.sttSectionTitle')} description={t('settingsPage.sttSectionDescription')} actions={<Button variant="secondary" onClick={handleSaveSTT}>{t('settingsPage.saveSttButton')}</Button>}>
              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-3 text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant underline">{t('settingsPage.localWhisperGroupTitle')}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="whisper_local_model_size" className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{t('settingsPage.whisperModelLabel')}</label>
                      <select id="whisper_local_model_size" value={sttForm['whisper_local_model_size'] ?? sttData?.['whisper_local_model_size'] ?? 'base'} onChange={(e) => setSttForm((current) => ({ ...current, whisper_local_model_size: e.target.value }))} className="w-full rounded-2xl px-4 py-3 text-sm"><option value="tiny">tiny</option><option value="base">base</option><option value="small">small</option><option value="medium">medium</option><option value="large-v3">large-v1</option><option value="large-v3">large-v2</option><option value="large-v3">large-v3</option></select>
                    </div>
                    <div>
                      <label htmlFor="whisper_local_compute_type" className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{t('settingsPage.whisperComputeTypeLabel')}</label>
                      <select id="whisper_local_compute_type" value={sttForm['whisper_local_compute_type'] ?? sttData?.['whisper_local_compute_type'] ?? 'float32'} onChange={(e) => setSttForm((current) => ({ ...current, whisper_local_compute_type: e.target.value }))} className="w-full rounded-2xl px-4 py-3 text-sm"><option value="int8">int8 (fastest, CPU recommended)</option><option value="float32">float32 (default)</option><option value="float16">float16 (GPU only)</option><option value="int8_float32">int8_float32 (CPU or GPU)</option><option value="int8_float16">int8_float16 (GPU only)</option></select>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      {(() => {
                        if (!whisperStatus) return (<span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-surface-container text-on-surface-variant">{t('settingsPage.whisperStatusChecking')}</span>)
                        if (whisperStatus.downloading) return (<span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-primary/10 text-primary">{t('settingsPage.whisperStatusDownloading', { progress: whisperStatus.progress ?? 0 })}</span>)
                        if (whisperStatus.exists) return (<span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-[var(--color-success,#22c55e)]/10 text-[var(--color-success,#22c55e)]">{t('settingsPage.whisperStatusExists')}</span>)
                        if (whisperStatus.error) return (<span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-error-container text-on-error-container">{t('settingsPage.whisperStatusError')}</span>)
                        return (<span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold bg-surface-container text-on-surface-variant">{t('settingsPage.whisperStatusMissing')}</span>)
                      })()}
                      <button type="button" onClick={() => void handleWhisperDownload()} disabled={isSubmittingDownload || whisperStatus?.downloading || whisperStatus?.exists} className="shrink-0 inline-flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed">{(isSubmittingDownload || whisperStatus?.downloading) ? t('settingsPage.whisperDownloadingButton') : t('settingsPage.whisperDownloadButton')}</button>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant underline">{t('settingsPage.openaiWhisperGroupTitle')}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField id="openai_whisper_api_key" label={t('settingsPage.openaiWhisperApiKeyLabel')} type="password" value={sttForm['openai_whisper_api_key'] ?? sttData?.['openai_whisper_api_key'] ?? ''} onChange={(value) => setSttForm((current) => ({ ...current, openai_whisper_api_key: value }))} />
                  </div>
                </div>
              </div>
            </SectionCard>
          </section>

          <section ref={sectionRefs.translate} className="scroll-mt-[122px]">
            <SectionCard eyebrow={t('settingsPage.translationEyebrow')} title={t('settingsPage.translateSectionTitle')} description={t('settingsPage.translateSectionDescription')} actions={<Button variant="secondary" onClick={handleSaveTranslate}>{t('settingsPage.saveTranslateButton')}</Button>}>
              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-3 text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant underline">{t('settingsPage.generalGroupTitle')}</p>
                  <ConfigFieldsSection fields={translateGeneralFields} values={translateForm} onChange={(key, value) => setTranslateForm((current) => ({ ...current, [key]: value }))} />
                </div>
                <div>
                  <p className="mb-3 text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant underline">DeepLX / DeepL / Google</p>
                  <ConfigFieldsSection fields={translateProviderFields} values={translateForm} onChange={(key, value) => setTranslateForm((current) => ({ ...current, [key]: value }))} />
                </div>
                <TranslationProfileEditor
                  provider="openai"
                  title="OpenAI"
                  profiles={openaiProfilesData?.profiles ?? []}
                  activeProfileId={openaiActiveProfileId}
                  values={openaiDraft}
                  onProfileChange={(profileId) => handleProfileSelect('openai', profileId)}
                  onFieldChange={(key, value) => setOpenaiDraft((current) => ({ ...current, [key]: value }))}
                  onCreate={() => handleProfileCreate('openai')}
                  onSave={() => void handleProfileSave('openai')}
                  onDelete={() => void handleProfileDelete('openai')}
                  onActivate={() => void handleProfileActivate('openai')}
                />
                <TranslationProfileEditor
                  provider="claude"
                  title="Claude"
                  profiles={claudeProfilesData?.profiles ?? []}
                  activeProfileId={claudeActiveProfileId}
                  values={claudeDraft}
                  onProfileChange={(profileId) => handleProfileSelect('claude', profileId)}
                  onFieldChange={(key, value) => setClaudeDraft((current) => ({ ...current, [key]: value }))}
                  onCreate={() => handleProfileCreate('claude')}
                  onSave={() => void handleProfileSave('claude')}
                  onDelete={() => void handleProfileDelete('claude')}
                  onActivate={() => void handleProfileActivate('claude')}
                />
              </div>
            </SectionCard>
          </section>
        </div>
      </div>
    </div>
  )
}
