import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'default'
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const variants: Record<string, string> = {
    pending: 'bg-surface-container-high text-on-surface-variant',
    running: 'bg-primary-container text-on-primary-container',
    done: 'bg-surface-variant text-on-surface',
    failed: 'bg-error-container text-on-error-container',
    cancelled: 'bg-surface-container text-on-surface-variant',
    default: 'bg-surface-container text-on-surface',
  }

  return (
    <span className={`px-2 py-0.5 text-[0.6875rem] uppercase tracking-[0.05em] font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
