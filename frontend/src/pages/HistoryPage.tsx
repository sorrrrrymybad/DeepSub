import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import TaskCard from '../components/TaskCard'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'
import PageHero from '../components/page/PageHero'
import SectionCard from '../components/page/SectionCard'
import StatCard from '../components/page/StatCard'
import EmptyState from '../components/page/EmptyState'

export default function HistoryPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['history', page],
    queryFn: () => tasksApi.list({ status: 'done', page, page_size: 20 }),
  })

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="Archive Feed"
        title={t('history.title')}
        description={t('history.heroDesc')}
        aside={
          <div className="rounded-[22px] border border-outline-variant bg-surface-container-low px-4 py-4 shadow-[var(--shadow-soft)]">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {t('history.currentPage')}
            </p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-on-surface">{page}</p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={t('history.archivedTotal')}
          value={data?.total ?? 0}
          hint={t('history.overviewDesc')}
        />
        <StatCard
          title={t('history.currentPage')}
          value={page}
          hint={t('common.pageOf', { current: page, total: Math.max(1, Math.ceil((data?.total ?? 1) / (data?.page_size ?? 20))) })}
          tone="accent"
        />
        <StatCard
          title={t('history.visibleItems')}
          value={items.length}
          hint={t('history.heroDesc')}
        />
      </div>

      <SectionCard
        eyebrow="Archive"
        title={t('history.overviewTitle')}
        description={t('history.overviewDesc')}
      >
        {isLoading ? (
          <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            {t('history.loading')}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={t('history.noData')} description={t('history.overviewDesc')} />
        ) : (
          <div className="flex flex-col gap-4">
            {items.map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </SectionCard>

      {data && data.total > data.page_size ? (
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            {t('common.prev')}
          </Button>
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            {t('common.pageOf', { current: page, total: Math.ceil(data.total / data.page_size) })}
          </span>
          <Button
            variant="ghost"
            disabled={page * data.page_size >= data.total}
            onClick={() => setPage(p => p + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
