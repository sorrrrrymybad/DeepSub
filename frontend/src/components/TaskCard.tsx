import { useState } from 'react'
import type { Task } from '../api/tasks'
import { tasksApi } from '../api/tasks'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from './atoms/Badge'
import TaskLogDrawer from './TaskLogDrawer'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

export default function TaskCard({ task }: { task: Task }) {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [showLog, setShowLog] = useState(false)

  const duration = task.started_at && task.finished_at
    ? dayjs(task.finished_at).diff(dayjs(task.started_at), 'second') + 's'
    : null

  const handleCancel = async () => {
    await tasksApi.cancel(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleRetry = async () => {
    await tasksApi.retry(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleRemove = async () => {
    await tasksApi.remove(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const filename = task.file_path.split('/').pop() ?? task.file_path

  return (
    <>
      <article className="section-card group relative p-5 transition-colors duration-150 ease-linear hover:bg-surface-container-low">
        <span className="absolute left-2 top-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
          #{task.id}
        </span>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div className="flex-1 min-w-0">
            <p className="truncate text-[1.125rem] font-bold leading-[1.5] tracking-[-0.03em] text-on-surface" title={task.file_path}>
              {filename}
            </p>
            <p className="truncate text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {task.file_path}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant={task.status}>{t(`status.${task.status}`)}</Badge>
            {duration && (
              <span className="rounded-full border border-outline-variant px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                {duration}
              </span>
            )}
          </div>
        </div>

        {task.status === 'running' && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              <span>{t('status.running')}</span>
              <span>{task.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-linear"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {task.error_message && (
          <p className="mt-4 rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
            {task.error_message}
          </p>
        )}

        <div className="mt-4 flex gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em]">
          <button
            onClick={() => setShowLog(true)}
            className="rounded-full border border-outline-variant px-3 py-2 text-primary transition-colors hover:border-primary hover:text-primary-dim"
          >
            {t('common.log')}
          </button>
          {task.status === 'running' && (
            <button
              onClick={handleCancel}
              className="rounded-full border border-outline-variant px-3 py-2 text-on-surface-variant transition-colors hover:border-primary hover:text-on-surface"
            >
              {t('common.cancel')}
            </button>
          )}
          {task.status === 'failed' && task.retry_count < 5 && (
            <button
              onClick={handleRetry}
              className="rounded-full border border-outline-variant px-3 py-2 text-primary transition-colors hover:border-primary hover:text-primary-dim"
            >
              {t('common.retry')}
            </button>
          )}
          <button
            onClick={handleRemove}
            className="ml-auto rounded-full border border-outline-variant px-3 py-2 text-on-surface-variant transition-colors hover:border-error hover:text-error"
          >
            {t('common.delete')}
          </button>
        </div>
      </article>
      {showLog && <TaskLogDrawer taskId={task.id} onClose={() => setShowLog(false)} />}
    </>
  )
}
