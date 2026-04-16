import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tasksApi, type TaskSummary } from '../api/tasks'
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
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((t) => t.status === 'running') ? 1000 : 5000
    },
  })

  const { data: summary } = useQuery<TaskSummary>({
    queryKey: ['tasks', 'summary'],
    queryFn: () => tasksApi.summary(),
    refetchInterval: (query) => ((query.state.data?.running ?? 0) > 0 ? 1000 : 5000),
  })

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title={t('tasks.title')}
        description="监控正在进行的字幕制作任务，实时查看进度"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t('status.all')}
          value={summary?.total ?? 0}
        />
        <StatCard
          title={t('status.running')}
          value={summary?.running ?? 0}
          tone="accent"
        />
        <StatCard
          title={t('status.done')}
          value={summary?.done ?? 0}
          tone="success"
        />
        <StatCard
          title={t('status.failed')}
          value={summary?.failed ?? 0}
          tone="danger"
        />
      </div>

      <SectionCard>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <FilterTabs
              items={STATUS_FILTERS}
              value={status}
              onChange={(nextValue) => {
                setStatus(nextValue)
                setPage(1)
              }}
            />
          </div>

          {isLoading ? (
            <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
              {t('tasks.loading')}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={t('tasks.noData')}
              description={t('tasks.emptyDescription')}
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
