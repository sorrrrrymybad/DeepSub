import type { ReactNode } from 'react'

interface PageHeroProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  aside?: ReactNode
  className?: string
}

export default function PageHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className = '',
}: PageHeroProps) {
  return (
    <section className={`page-hero ${className}`.trim()}>
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          {eyebrow ? (
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl font-black tracking-[-0.04em] text-on-surface md:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-7 text-on-surface-variant md:text-[0.95rem]">
              {description}
            </p>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="relative z-10 md:min-w-[220px]">{aside}</div> : null}
      </div>
    </section>
  )
}
