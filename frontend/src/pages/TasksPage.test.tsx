import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { tasksApi, type Task } from '../api/tasks'
import TasksPage from './TasksPage'

const sampleTask: Task = {
  id: 1,
  smb_server_id: 1,
  file_path: '/media/movie_01.mkv',
  status: 'running',
  source_lang: 'auto',
  target_lang: 'zh',
  stt_engine: 'whisper_local',
  translate_engine: 'deeplx',
  overwrite: false,
  progress: 72,
  error_message: null,
  retry_count: 0,
  started_at: '2026-04-14T02:00:00Z',
  finished_at: null,
  created_at: '2026-04-14T01:59:00Z',
}

describe('TasksPage', () => {
  it('renders hero, summary cards and task list together', async () => {
    vi.spyOn(tasksApi, 'list').mockResolvedValue({
      items: [sampleTask],
      total: 1,
      page: 1,
      page_size: 20,
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderWithProviders(
      <QueryClientProvider client={queryClient}>
        <TasksPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/全部任务|All Tasks/i)).toBeInTheDocument()
    expect(await screen.findByText('movie_01.mkv')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getAllByText(/运行中|Running/i).length).toBeGreaterThan(0)
  })
})
