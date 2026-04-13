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
      .catch((err) => setLogs(t('drawer.failedLoad', { msg: err.message })))
  }, [taskId, t])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView()
    }
  }, [logs])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-2/3 max-w-2xl h-full bg-surface-container-lowest flex flex-col shadow-[0_0_32px_rgba(45,52,53,0.04)]"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 bg-surface-container-low">
          <h2 className="font-semibold text-[1.125rem] text-on-surface tracking-[-0.02em] uppercase">{t('drawer.title', { id: taskId })}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors uppercase text-[0.6875rem] tracking-[0.05em] font-medium">{t('common.close')}</button>
        </div>
        <pre className="flex-1 overflow-auto p-6 text-sm font-mono text-on-surface bg-background">
          {logs || t('drawer.noLogs')}
          <div ref={bottomRef} />
        </pre>
      </div>
    </div>
  )
}
