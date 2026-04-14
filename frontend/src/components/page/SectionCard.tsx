import type { ReactNode } from 'react'

interface SectionCardProps {
  eyebrow?: string
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export default function SectionCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section className={`section-card ${className}`.trim()}>
      {(eyebrow || title || description || actions) && (
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            {eyebrow ? (
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                {eyebrow}
              </p>
            ) : null}
            {title ? <h2 className="text-xl font-bold tracking-[-0.03em] text-on-surface">{title}</h2> : null}
            {description ? <p className="text-sm leading-6 text-on-surface-variant">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  )
}
