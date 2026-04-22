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
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)

  const STATUS_FILTERS = [
    { label: t('taskStatus.all'), value: '' },
    { label: t('taskStatus.pending'), value: 'pending' },
    { label: t('taskStatus.running'), value: 'running' },
    { label: t('taskStatus.done'), value: 'done' },
    { label: t('taskStatus.failed'), value: 'failed' },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', status, keyword, sort, page],
    queryFn: () => tasksApi.list({ status: status || undefined, keyword: keyword || undefined, sort: sort || undefined, page, page_size: 10 }),
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
        title={t('tasksPage.title')}
        description={t('tasksPage.heroDescription')}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title={t('taskStatus.all')}
          value={summary?.total ?? 0}
        />
        <StatCard
          title={t('taskStatus.running')}
          value={summary?.running ?? 0}
          tone="accent"
        />
        <StatCard
          title={t('taskStatus.done')}
          value={summary?.done ?? 0}
          tone="success"
        />
        <StatCard
          title={t('taskStatus.failed')}
          value={summary?.failed ?? 0}
          tone="danger"
        />
      </div>

      <SectionCard>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <FilterTabs
              items={STATUS_FILTERS}
              value={status}
              onChange={(nextValue) => {
                setStatus(nextValue)
                setPage(1)
              }}
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder={t('tasksPage.searchPlaceholder')}
                className="h-9 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-low px-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none sm:w-48 sm:flex-none"
              />
              <button
                type="button"
                onClick={() => {
                  setSort((prev) => {
                    if (!prev) return 'name_asc'
                    if (prev === 'name_asc') return 'name_desc'
                    return ''
                  })
                  setPage(1)
                }}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-primary hover:text-on-surface"
              >
                {sort ? t('tasksPage.sortByName') : t('tasksPage.sortByTime')}
                {sort === 'name_asc' && <span>↑</span>}
                {sort === 'name_desc' && <span>↓</span>}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
              {t('tasksPage.loadingState')}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={t('tasksPage.emptyTitle')}
              description={t('tasksPage.emptyDescription')}
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
            {t('common.previous')}
          </Button>
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {t('common.pageIndicator', { current: page, total: Math.ceil(data.total / data.page_size) })}
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
