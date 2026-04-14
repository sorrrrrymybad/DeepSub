interface StatCardProps {
  title: string
  value: string | number
  hint?: string
  tone?: 'default' | 'accent' | 'success' | 'danger'
  trailing?: string
}

export default function StatCard({
  title,
  value,
  hint,
  tone = 'default',
  trailing,
}: StatCardProps) {
  const toneClass =
    tone === 'default'
      ? ''
      : tone === 'accent'
        ? 'stat-card--accent'
        : tone === 'success'
          ? 'stat-card--success'
          : 'stat-card--danger'

  return (
    <article className={['stat-card', toneClass].filter(Boolean).join(' ')}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {title}
          </p>
          <p className="text-3xl font-black tracking-[-0.04em] text-inherit">{value}</p>
        </div>
        {trailing ? (
          <span className="rounded-full border border-outline-variant px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {trailing}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-sm text-on-surface-variant">{hint}</p> : null}
    </article>
  )
}
