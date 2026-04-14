import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'default'
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const variants: Record<string, string> = {
    pending: 'bg-surface-container-high text-on-surface-variant border border-outline-variant',
    running: 'bg-primary-container text-on-primary-container border border-primary/20',
    done: 'bg-surface-variant text-on-surface border border-outline-variant',
    failed: 'bg-error-container text-on-error-container border border-error/20',
    cancelled: 'bg-surface-container text-on-surface-variant border border-outline-variant',
    default: 'bg-surface-container text-on-surface border border-outline-variant',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${variants[variant]}`}
    >
      {children}
    </span>
  )
}
