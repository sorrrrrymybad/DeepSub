import { useEffect, useRef, useState } from 'react'
import { tasksApi } from '../api/tasks'
import { useTranslation } from 'react-i18next'

export default function TaskLogDrawer({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(tasksApi.getLogsUrl(taskId))
      .then(r => r.text())
      .then(setLogs)
      .catch((err) => setLogs(t('taskLogDrawer.failedLoad', { msg: err.message })))
  }, [taskId, t])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView()
    }
  }, [logs])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(22,18,14,0.36)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col border-l border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-5">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              {t('taskLogDrawer.panelLabel')}
            </p>
            <h2 className="mt-2 text-[1.125rem] font-bold tracking-[-0.03em] text-on-surface">
              {t('taskLogDrawer.title', { id: taskId })}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-outline-variant px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
          >
            {t('common.close')}
          </button>
        </div>
        <pre className="flex-1 overflow-auto bg-background p-6 text-sm leading-7 text-on-surface">
          {logs || t('taskLogDrawer.emptyState')}
          <div ref={bottomRef} />
        </pre>
      </div>
    </div>
  )
}
