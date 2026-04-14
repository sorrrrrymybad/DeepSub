import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="mx-auto max-w-md space-y-3">
        <h3 className="text-xl font-bold tracking-[-0.03em] text-on-surface">{title}</h3>
        {description ? <p className="text-sm leading-6 text-on-surface-variant">{description}</p> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  )
}
