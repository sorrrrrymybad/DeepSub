import { useEffect, useMemo, useRef, useState } from 'react'
import { tasksApi } from '../api/tasks'
import { useTranslation } from 'react-i18next'

interface LogSegment {
  id: string
  type: 'normal' | 'error'
  text: string
}

const LOG_ENTRY_RE = /^\d{4}-\d{2}-\d{2}.*\[(INFO|WARNING|ERROR|CRITICAL|DEBUG)\]/
const ERROR_RE = /\[(ERROR|CRITICAL)\]|Traceback|(?:^|\s)(Error|Exception):|Task failed|failed:|失败|错误/i

function isErrorLine(line: string): boolean {
  return ERROR_RE.test(line)
}

function isNormalLogEntry(line: string): boolean {
  return LOG_ENTRY_RE.test(line) && !isErrorLine(line)
}

function splitLogSegments(logs: string): LogSegment[] {
  if (!logs) return []

  const segments: LogSegment[] = []
  const lines = logs.split('\n')
  let currentLines: string[] = []
  let currentType: LogSegment['type'] = 'normal'

  const flush = () => {
    if (currentLines.length === 0) return
    segments.push({
      id: `${segments.length}-${currentType}`,
      type: currentType,
      text: currentLines.join('\n'),
    })
    currentLines = []
  }

  for (const line of lines) {
    const nextType: LogSegment['type'] = isErrorLine(line) ? 'error' : 'normal'
    const startsNewNormalEntry: boolean = currentType === 'error' && isNormalLogEntry(line)
    const startsNewErrorEntry: boolean = currentType === 'normal' && nextType === 'error'

    if (startsNewNormalEntry || startsNewErrorEntry) {
      flush()
      currentType = startsNewNormalEntry ? 'normal' : 'error'
    }

    currentLines.push(line)
  }

  flush()
  return segments
}

function getErrorSummary(text: string): string {
  return text.split('\n').find(Boolean) ?? text
}

export default function TaskLogDrawer({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState('')
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(() => new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const segments = useMemo(() => splitLogSegments(logs), [logs])

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

  const toggleError = (segmentId: string) => {
    setExpandedErrors((current) => {
      const next = new Set(current)
      if (next.has(segmentId)) {
        next.delete(segmentId)
      } else {
        next.add(segmentId)
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(22,18,14,0.36)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full min-w-0 w-full max-w-3xl flex-col border-l border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-6 py-5">
          <div className="min-w-0">
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
        <div
          data-testid="task-log-content"
          className="flex-1 overflow-y-auto overflow-x-hidden whitespace-pre-wrap bg-background p-4 font-mono text-xs leading-6 text-on-surface [overflow-wrap:anywhere] sm:p-6 sm:text-sm sm:leading-7"
        >
          {segments.length > 0 ? segments.map((segment) => {
            if (segment.type === 'normal') {
              return <div key={segment.id}>{segment.text}</div>
            }

            const expanded = expandedErrors.has(segment.id)
            return (
              <div key={segment.id} className="my-3 rounded-2xl border border-error/20 bg-error-container p-3 text-on-error-container">
                <div>{expanded ? segment.text : getErrorSummary(segment.text)}</div>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggleError(segment.id)}
                  className="mt-2 rounded-full border border-error/30 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:border-error"
                >
                  {expanded ? t('taskLogDrawer.hideErrorDetails') : t('taskLogDrawer.showErrorDetails')}
                </button>
              </div>
            )
          }) : t('taskLogDrawer.emptyState')}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
