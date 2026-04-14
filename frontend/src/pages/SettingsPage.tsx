import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { smbApi, type CreateSMBPayload } from '../api/smb'
import { settingsApi } from '../api/settings'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import SectionCard from '../components/page/SectionCard'
import StatCard from '../components/page/StatCard'
import SettingsDirectory from '../components/SettingsDirectory'

type SettingsSectionId = 'overview' | 'smb' | 'stt' | 'translate'

interface ConfigField {
  key: string
  label: string
  secret?: boolean
}

function OverviewMetric({ title, value, hint }: { title: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-4">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{hint}</p>
    </div>
  )
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
      {fields.map((field) => (
        <FormField
          key={field.key}
          id={field.key}
          label={field.label}
          type={field.secret ? 'password' : 'text'}
          value={values[field.key] ?? ''}
          placeholder={values[field.key] ?? ''}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
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
  const [testResult, setTestResult] = useState<Record<number, string>>({})
  const [sttForm, setSttForm] = useState<Record<string, string>>({})
  const [translateForm, setTranslateForm] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('overview')

  const sectionRefs = {
    overview: useRef<HTMLElement | null>(null),
    smb: useRef<HTMLElement | null>(null),
    stt: useRef<HTMLElement | null>(null),
    translate: useRef<HTMLElement | null>(null),
  }

  const sections = useMemo(
    () => [
      { id: 'overview', label: t('settings.overview'), description: t('settings.overviewDesc') },
      { id: 'smb', label: t('settings.smbServers'), description: t('settings.smbDesc') },
      { id: 'stt', label: t('settings.sttTitle'), description: t('settings.sttDesc') },
      { id: 'translate', label: t('settings.transTitle'), description: t('settings.translateDesc') },
    ] satisfies Array<{ id: SettingsSectionId; label: string; description: string }>,
    [t],
  )

  useEffect(() => {
    const handleScroll = () => {
      const entries = (Object.entries(sectionRefs) as Array<[SettingsSectionId, typeof sectionRefs.overview]>)
        .map(([id, ref]) => ({ id, top: ref.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY }))
        .filter((item) => Number.isFinite(item.top))

      const current = entries
        .filter((item) => item.top <= 180)
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
    await smbApi.create(form)
    qc.invalidateQueries({ queryKey: ['smb-servers'] })
    setForm({ name: '', host: '', port: 445, share: '', username: '', password: '' })
  }

  const handleTest = async (id: number) => {
    setTesting(id)

    try {
      const result = await smbApi.test(id)
      setTestResult((current) => ({
        ...current,
        [id]: result.ok ? t('common.success') : result.error ?? t('common.failed'),
      }))
    } catch {
      setTestResult((current) => ({ ...current, [id]: t('common.error') }))
    }

    setTesting(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.confirmDel'))) return
    await smbApi.delete(id)
    qc.invalidateQueries({ queryKey: ['smb-servers'] })
  }

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

  const translateFields: ConfigField[] = [
    { key: 'deeplx_endpoint', label: t('settings.fields.deeplxEndpoint') },
    { key: 'deepl_api_key', label: t('settings.fields.deeplKey'), secret: true },
    { key: 'google_api_key', label: t('settings.fields.googleKey'), secret: true },
    { key: 'openai_api_key', label: t('settings.fields.openaiKey'), secret: true },
    { key: 'openai_model', label: t('settings.fields.openaiModel') },
    { key: 'openai_base_url', label: t('settings.fields.openaiBase') },
    { key: 'claude_api_key', label: t('settings.fields.claudeKey'), secret: true },
    { key: 'claude_model', label: t('settings.fields.claudeModel') },
    { key: 'claude_base_url', label: t('settings.fields.claudeBase') },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Settings Workspace"
        title={t('settings.title')}
        description={t('settings.heroDesc')}
        aside={
          <div className="rounded-[22px] border border-outline-variant bg-surface-container-low px-4 py-4 shadow-[var(--shadow-soft)]">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {t('settings.connectionHint')}
            </p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-on-surface">
              {servers?.length ?? 0}
            </p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={t('settings.serverCount')}
          value={servers?.length ?? 0}
          hint={t('settings.smbDesc')}
        />
        <StatCard
          title={t('settings.engineCount')}
          value={2}
          hint={t('settings.connectionHint')}
          tone="accent"
        />
        <StatCard
          title={t('settings.overview')}
          value={activeSection}
          hint={t('settings.directoryTitle')}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <SettingsDirectory
          title={t('settings.directoryTitle')}
          sections={sections}
          activeSection={activeSection}
          onSelect={(sectionId) => scrollToSection(sectionId as SettingsSectionId)}
        />

        <div className="flex flex-col gap-6">
          <SectionCard
            className="scroll-mt-28"
            eyebrow="Overview"
            title={t('settings.overviewTitle')}
            description={t('settings.overviewDesc')}
          >
            <section ref={sectionRefs.overview} id="settings-overview" className="grid gap-4 md:grid-cols-3">
              <OverviewMetric
                title={t('settings.serverCount')}
                value={servers?.length ?? 0}
                hint={t('settings.smbDesc')}
              />
              <OverviewMetric
                title={t('settings.engineCount')}
                value={2}
                hint={t('settings.connectionHint')}
              />
              <OverviewMetric
                title={t('settings.directoryTitle')}
                value={sections.length}
                hint={t('settings.translateDesc')}
              />
            </section>
          </SectionCard>

          <section ref={sectionRefs.smb} className="scroll-mt-28">
            <SectionCard
              eyebrow="Storage"
              title={t('settings.smbServers')}
              description={t('settings.smbDesc')}
            >
              <div className="space-y-4">
                <div className="space-y-3">
                  {servers?.map((server) => (
                    <div
                      key={server.id}
                      className="flex flex-col gap-4 rounded-[20px] border border-outline-variant bg-surface-container-low p-4 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="space-y-2">
                        <p className="text-lg font-bold tracking-[-0.03em] text-on-surface">{server.name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {server.username}@{server.host}/{server.share}
                        </p>
                        {testResult[server.id] ? (
                          <p className="text-sm font-semibold text-primary">{testResult[server.id]}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => handleTest(server.id)}
                          disabled={testing === server.id}
                        >
                          {testing === server.id ? t('settings.testing') : t('settings.ping')}
                        </Button>
                        <Button variant="ghost" onClick={() => handleDelete(server.id)}>
                          {t('common.delete')}
                        </Button>
                      </div>
                    </div>
                  ))}
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

          <section ref={sectionRefs.stt} className="scroll-mt-28">
            <SectionCard
              eyebrow="Speech"
              title={t('settings.sttTitle')}
              description={t('settings.sttDesc')}
              actions={<Button variant="secondary" onClick={handleSaveSTT}>{t('settings.commitStt')}</Button>}
            >
              <ConfigFieldsSection
                fields={sttFields}
                values={(sttData ?? {}) as Record<string, string>}
                onChange={(key, value) => setSttForm((current) => ({ ...current, [key]: value }))}
              />
            </SectionCard>
          </section>

          <section ref={sectionRefs.translate} className="scroll-mt-28">
            <SectionCard
              eyebrow="Translation"
              title={t('settings.transTitle')}
              description={t('settings.translateDesc')}
              actions={<Button variant="secondary" onClick={handleSaveTranslate}>{t('settings.commitTrans')}</Button>}
            >
              <ConfigFieldsSection
                fields={translateFields}
                values={(translateData ?? {}) as Record<string, string>}
                onChange={(key, value) => setTranslateForm((current) => ({ ...current, [key]: value }))}
              />
            </SectionCard>
          </section>
        </div>
      </div>
    </div>
  )
}
