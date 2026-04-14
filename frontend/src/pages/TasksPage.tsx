import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import TaskCard from '../components/TaskCard'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import StatCard from '../components/page/StatCard'
import SectionCard from '../components/page/SectionCard'
import FilterTabs from '../components/page/FilterTabs'
import EmptyState from '../components/page/EmptyState'

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

  const items = data?.items ?? []
  const runningCount = items.filter((task) => task.status === 'running').length
  const doneCount = items.filter((task) => task.status === 'done').length
  const failedCount = items.filter((task) => task.status === 'failed').length

  const handleBatchCancel = async () => {
    const running = data?.items.filter(t => t.status === 'running') ?? []
    await Promise.all(running.map(ta => tasksApi.cancel(ta.id)))
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Task Operations"
        title={t('tasks.title')}
        description="Monitor active subtitle jobs, watch progress in real time, and jump straight into new task creation."
        actions={<Button variant="primary">{t('nav.NewTask')}</Button>}
        aside={
          <div className="rounded-[22px] border border-outline-variant bg-surface-container-low px-4 py-3 shadow-[var(--shadow-soft)]">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Active Queue
            </p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-on-surface">
              {runningCount}
            </p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t('tasks.summary.total', { defaultValue: 'All Tasks' })}
          value={data?.total ?? 0}
          hint={t('tasks.summary.totalHint', { defaultValue: 'All queued and completed jobs' })}
        />
        <StatCard
          title={t('status.running')}
          value={runningCount}
          hint={t('tasks.summary.runningHint', { defaultValue: 'Jobs currently in progress' })}
          tone="accent"
        />
        <StatCard
          title={t('status.done')}
          value={doneCount}
          hint={t('tasks.summary.doneHint', { defaultValue: 'Completed jobs on this page' })}
          tone="success"
        />
        <StatCard
          title={t('status.failed')}
          value={failedCount}
          hint={t('tasks.summary.failedHint', { defaultValue: 'Jobs needing attention' })}
          tone="danger"
        />
      </div>

      <SectionCard
        eyebrow="Queue Browser"
        title={t('tasks.queueTitle', { defaultValue: 'Execution Queue' })}
        description={t('tasks.queueDescription', {
          defaultValue: 'Filter the current queue, inspect progress, and act on failed or running jobs.',
        })}
        actions={
          <Button variant="ghost" onClick={handleBatchCancel} disabled={runningCount === 0}>
            {t('tasks.cancelAll')}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <FilterTabs
            items={STATUS_FILTERS}
            value={status}
            onChange={(nextValue) => {
              setStatus(nextValue)
              setPage(1)
            }}
          />

          {isLoading ? (
            <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
              {t('tasks.loading')}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={t('tasks.noData')}
              description={t('tasks.emptyDescription', {
                defaultValue: 'Once subtitle jobs are created, they will appear here with progress and status details.',
              })}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            {t('common.prev')}
          </Button>
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {t('common.pageOf', { current: page, total: Math.ceil(data.total / data.page_size) })}
          </span>
          <Button
            variant="ghost"
            disabled={page * data.page_size >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
