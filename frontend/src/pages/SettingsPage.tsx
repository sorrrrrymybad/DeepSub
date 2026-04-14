import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { smbApi, type CreateSMBPayload } from '../api/smb'
import { settingsApi } from '../api/settings'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import SectionCard from '../components/page/SectionCard'
import SettingsDirectory from '../components/SettingsDirectory'
import { useToast } from '../context/ToastContext'

type SettingsSectionId = 'smb' | 'stt' | 'translate'

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
      <label
        htmlFor={id}
        className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
      >
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
            <label
              htmlFor={field.key}
              className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
            >
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
        )
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { show } = useToast()
  const qc = useQueryClient()
  const { data: servers } = useQuery({ queryKey: ['smb-servers'], queryFn: smbApi.list })
  const { data: sttData } = useQuery({ queryKey: ['settings-stt'], queryFn: settingsApi.getSTT })
  const { data: translateData } = useQuery({ queryKey: ['settings-translate'], queryFn: settingsApi.getTranslate })

  const [form, setForm] = useState<CreateSMBPayload>({
    name: '',
    host: '',
    port: 445,
    share: '',
    username: '',
    password: '',
  })
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; error?: string }>>({})
  const [sttForm, setSttForm] = useState<Record<string, string>>({})
  const [translateForm, setTranslateForm] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('smb')

  const sectionRefs = {
    smb: useRef<HTMLElement | null>(null),
    stt: useRef<HTMLElement | null>(null),
    translate: useRef<HTMLElement | null>(null),
  }

  const sections = useMemo(
    () => [
      { id: 'smb', label: t('settings.smbServers'), description: t('settings.smbDesc') },
      { id: 'stt', label: t('settings.sttTitle'), description: t('settings.sttDesc') },
      { id: 'translate', label: t('settings.transTitle'), description: t('settings.translateDesc') },
    ] satisfies Array<{ id: SettingsSectionId; label: string; description: string }>,
    [t],
  )

  useEffect(() => {
    const handleScroll = () => {
      const entries = (Object.entries(sectionRefs) as Array<[SettingsSectionId, typeof sectionRefs.smb]>)
        .map(([id, ref]) => ({ id, top: ref.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY }))
        .filter((item) => Number.isFinite(item.top))

      const current = entries
        .filter((item) => item.top <= 130)
        .sort((a, b) => b.top - a.top)[0]
        ?? entries.sort((a, b) => a.top - b.top)[0]

      if (current) {
        setActiveSection(current.id)
      }
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
      show(t('settings.serverAdded'), 'success')
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
      if (!result.ok && result.error) {
        show(result.error, 'error')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.error')
      setTestResult((current) => ({ ...current, [id]: { ok: false, error: msg } }))
      show(msg, 'error')
    }

    setTesting(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.confirmDel'))) return
    try {
      await smbApi.delete(id)
      qc.invalidateQueries({ queryKey: ['smb-servers'] })
      show(t('settings.serverDeleted'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleSaveSTT = async () => {
    try {
      await settingsApi.patchSTT(sttForm)
      qc.invalidateQueries({ queryKey: ['settings-stt'] })
      show(t('settings.sttSaved'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const handleSaveTranslate = async () => {
    try {
      await settingsApi.patchTranslate(translateForm)
      qc.invalidateQueries({ queryKey: ['settings-translate'] })
      show(t('settings.transSaved'), 'success')
    } catch (e: unknown) {
      show(e instanceof Error ? e.message : t('common.error'), 'error')
    }
  }

  const serverFields = [
    { key: 'name', label: t('settings.name') },
    { key: 'host', label: t('settings.host') },
    { key: 'share', label: t('settings.share') },
    { key: 'username', label: t('settings.username') },
    { key: 'password', label: t('settings.password'), type: 'password' as const },
    { key: 'port', label: t('settings.port'), type: 'number' as const },
  ]

  const sttFields: ConfigField[] = [
    { key: 'whisper_local_model_size', label: t('settings.fields.whisperLocal') },
    { key: 'openai_whisper_api_key', label: t('settings.fields.openaiWhisper'), secret: true },
  ]

  const translateGroups: Array<{ label: string; fields: ConfigField[] }> = [
    {
      label: t('settings.groups.general'),
      fields: [
        { key: 'batch_size', label: t('settings.fields.batchSize') },
      ],
    },
    {
      label: 'DeepLX',
      fields: [
        { key: 'deeplx_endpoint', label: t('settings.fields.deeplxEndpoint'), textarea: true, placeholder: t('settings.fields.deeplxEndpointPlaceholder') },
      ],
    },
    {
      label: 'DeepL',
      fields: [
        { key: 'deepl_api_key', label: t('settings.fields.deeplKey'), secret: true },
      ],
    },
    {
      label: 'Google Translate',
      fields: [
        { key: 'google_api_key', label: t('settings.fields.googleKey'), secret: true },
      ],
    },
    {
      label: 'OpenAI',
      fields: [
        { key: 'openai_api_key', label: t('settings.fields.openaiKey'), secret: true },
        { key: 'openai_model', label: t('settings.fields.openaiModel') },
        { key: 'openai_base_url', label: t('settings.fields.openaiBase') },
      ],
    },
    {
      label: 'Claude',
      fields: [
        { key: 'claude_api_key', label: t('settings.fields.claudeKey'), secret: true },
        { key: 'claude_model', label: t('settings.fields.claudeModel') },
        { key: 'claude_base_url', label: t('settings.fields.claudeBase') },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title={t('settings.title')}
        description={t('settings.heroDesc')}
      />

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <SettingsDirectory
          title={t('settings.directoryTitle')}
          sections={sections}
          activeSection={activeSection}
          onSelect={(sectionId) => scrollToSection(sectionId as SettingsSectionId)}
        />

        <div className="flex flex-col gap-6">
          <section ref={sectionRefs.smb} className="scroll-mt-[122px]">
            <SectionCard
              eyebrow="Storage"
              title={t('settings.smbServers')}
              description={t('settings.smbDesc')}
            >
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
                      <div
                        key={server.id}
                        className="flex flex-col gap-3 rounded-[20px] border border-outline-variant bg-surface-container-low p-4 xl:flex-row xl:items-center xl:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-base font-bold tracking-[-0.03em] text-on-surface">{server.name}</p>
                          <p className="truncate text-sm text-on-surface-variant">
                            {server.username}@{server.host}/{server.share}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => void handleTest(server.id)}
                            disabled={isTesting}
                            className={[
                              'inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50',
                              testBtnClass || 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary hover:text-primary',
                            ].join(' ')}
                          >
                            {isTesting
                              ? t('settings.testing')
                              : result
                                ? result.ok
                                  ? t('common.success')
                                  : t('common.failed')
                                : t('settings.ping')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(server.id)}
                            className="inline-flex items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:border-error hover:text-error"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-[22px] border border-outline-variant bg-surface-container-low p-5">
                  <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    {t('settings.addServer')}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {serverFields.map((field) => (
                      <FormField
                        key={field.key}
                        id={`server-${field.key}`}
                        label={field.label}
                        type={field.type}
                        value={String(form[field.key as keyof CreateSMBPayload] ?? '')}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            [field.key]: field.type === 'number' ? Number(value) : value,
                          }))
                        }
                      />
                    ))}
                  </div>
                  <div className="mt-5">
                    <Button variant="primary" onClick={handleCreate}>
                      {t('settings.attachServer')}
                    </Button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </section>

          <section ref={sectionRefs.stt} className="scroll-mt-[122px]">
            <SectionCard
              eyebrow="Speech"
              title={t('settings.sttTitle')}
              description={t('settings.sttDesc')}
              actions={<Button variant="secondary" onClick={handleSaveSTT}>{t('settings.commitStt')}</Button>}
            >
              <ConfigFieldsSection
                fields={sttFields}
                values={{ ...(sttData ?? {}), ...sttForm } as Record<string, string>}
                onChange={(key, value) => setSttForm((current) => ({ ...current, [key]: value }))}
              />
            </SectionCard>
          </section>

          <section ref={sectionRefs.translate} className="scroll-mt-[122px]">
            <SectionCard
              eyebrow="Translation"
              title={t('settings.transTitle')}
              description={t('settings.translateDesc')}
              actions={<Button variant="secondary" onClick={handleSaveTranslate}>{t('settings.commitTrans')}</Button>}
            >
              <div className="flex flex-col gap-6">
                {(() => {
                  const mergedValues = { ...(translateData ?? {}), ...translateForm } as Record<string, string>
                  if (mergedValues['batch_size'] === undefined) mergedValues['batch_size'] = '1'
                  return translateGroups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-3 text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant underline">
                        {group.label}
                      </p>
                      <ConfigFieldsSection
                        fields={group.fields}
                        values={mergedValues}
                        onChange={(key, value) => setTranslateForm((current) => ({ ...current, [key]: value }))}
                      />
                    </div>
                  ))
                })()}
              </div>
            </SectionCard>
          </section>
        </div>
      </div>

    </div>
  )
}
