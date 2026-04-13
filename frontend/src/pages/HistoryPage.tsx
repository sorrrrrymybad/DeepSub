import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import TaskCard from '../components/TaskCard'
import { Button } from '../components/atoms/Button'
import { useTranslation } from 'react-i18next'

export default function HistoryPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['history', page],
    queryFn: () => tasksApi.list({ status: 'done', page, page_size: 20 }),
  })

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] text-on-surface">{t('history.title')}</h1>
      </div>

      {isLoading ? (
        <p className="text-[0.6875rem] font-medium tracking-[0.05em] text-on-surface-variant uppercase">{t('history.loading')}</p>
      ) : (
        <div className="flex flex-col gap-0 border-y border-outline-variant">
          {data?.items.map(task => <TaskCard key={task.id} task={task} />)}
          {(!data?.items || data.items.length === 0) && (
            <p className="text-sm text-on-surface-variant text-center py-12 uppercase tracking-[0.05em]">{t('history.noData')}</p>
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
