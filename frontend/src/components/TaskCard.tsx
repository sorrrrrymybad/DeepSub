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

  const filename = task.file_path.split('/').pop() ?? task.file_path

  return (
    <>
      <div className="group bg-surface-container-lowest hover:bg-surface-container-high p-4 flex flex-col gap-2 transition-colors duration-150 ease-linear">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[1.125rem] truncate leading-[1.6]" title={task.file_path}>
              {filename}
            </p>
            <p className="text-xs text-on-surface-variant truncate tracking-[0.05em] uppercase">
              {task.file_path}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={task.status}>{t(`status.${task.status}`)}</Badge>
            {duration && <span className="text-[0.6875rem] text-on-surface-variant uppercase tracking-[0.05em]">{duration}</span>}
          </div>
        </div>

        {task.status === 'running' && (
          <div className="w-full bg-surface-container h-1.5 mt-2">
            <div className="bg-primary h-1.5 transition-all duration-300 ease-linear"
                 style={{ width: `${task.progress}%` }} />
          </div>
        )}

        {task.error_message && (
          <p className="text-xs text-error mt-2">{task.error_message}</p>
        )}

        <div className="flex gap-4 mt-2 text-[0.6875rem] uppercase tracking-[0.05em] font-medium">
          <button onClick={() => setShowLog(true)}
                  className="text-primary hover:text-primary-dim transition-colors">{t('common.log')}</button>
          {task.status === 'running' && (
            <button onClick={handleCancel} className="text-on-surface-variant hover:text-on-surface transition-colors">{t('common.cancel')}</button>
          )}
          {task.status === 'failed' && task.retry_count < 5 && (
            <button onClick={handleRetry} className="text-primary hover:text-primary-dim transition-colors">{t('common.retry')}</button>
          )}
        </div>
      </div>
      {showLog && <TaskLogDrawer taskId={task.id} onClose={() => setShowLog(false)} />}
    </>
  )
}
