import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import TaskCard from '../components/TaskCard'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'

export default function TasksPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const STATUS_FILTERS = [
    { label: t('status.all'), value: '' },
    { label: t('status.pending'), value: 'pending' },
    { label: t('status.running'), value: 'running' },
    { label: t('status.done'), value: 'done' },
    { label: t('status.failed'), value: 'failed' },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', status, page],
    queryFn: () => tasksApi.list({ status: status || undefined, page, page_size: 20 }),
    refetchInterval: 5000,
  })

  const handleBatchCancel = async () => {
    const running = data?.items.filter(t => t.status === 'running') ?? []
    await Promise.all(running.map(ta => tasksApi.cancel(ta.id)))
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between">
          <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] text-on-surface">{t('tasks.title')}</h1>
          <button onClick={handleBatchCancel}
                  className="text-[0.6875rem] font-medium tracking-[0.05em] uppercase text-error hover:text-error-dim transition-colors">
            {t('tasks.cancelAll')}
          </button>
        </div>

        <div className="flex gap-4 border-b border-surface-variant pb-2">
          {STATUS_FILTERS.map(f => (
            <button key={f.value}
                    onClick={() => { setStatus(f.value); setPage(1) }}
                    className={`text-[0.6875rem] font-medium tracking-[0.05em] uppercase pb-2 px-1 transition-colors relative ${
                      status === f.value
                        ? 'text-primary'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}>
              {f.label}
              {status === f.value && (
                <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-[0.6875rem] font-medium tracking-[0.05em] text-on-surface-variant uppercase">{t('tasks.loading')}</p>
      ) : (
        <div className="flex flex-col gap-0 border-y border-outline-variant">
          {data?.items.map(task => <TaskCard key={task.id} task={task} />)}
          {(!data?.items || data.items.length === 0) && (
            <p className="text-sm text-on-surface-variant text-center py-12 uppercase tracking-[0.05em]">{t('tasks.noData')}</p>
          )}
        </div>
      )}

      {data && data.total > data.page_size && (
        <div className="flex justify-center items-center gap-6 mt-4">
          <Button variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('common.prev')}</Button>
          <span className="text-[0.6875rem] font-medium tracking-[0.05em] text-on-surface-variant uppercase">
            {t('common.pageOf', { current: page, total: Math.ceil(data.total / data.page_size) })}
          </span>
          <Button variant="ghost" disabled={page * data.page_size >= data.total} onClick={() => setPage(p => p + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  )
}
