import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import { tasksApi, type Task } from '../api/tasks'
import { renderWithProviders } from '../test/renderWithProviders'
import HistoryPage from './HistoryPage'

const sampleHistoryTask: Task = {
  id: 8,
  smb_server_id: 1,
  file_path: '/archive/movie_done.mkv',
  status: 'done',
  source_lang: 'auto',
  target_lang: 'zh',
  stt_engine: 'whisper_local',
  translate_engine: 'deeplx',
  overwrite: false,
  progress: 100,
  error_message: null,
  retry_count: 0,
  started_at: '2026-04-12T02:00:00Z',
  finished_at: '2026-04-12T02:15:00Z',
  created_at: '2026-04-12T01:59:00Z',
}

describe('HistoryPage', () => {
  it('renders archive summary and history list', async () => {
    vi.spyOn(tasksApi, 'list').mockResolvedValue({
      items: [sampleHistoryTask],
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
        <HistoryPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/已完成任务归档|Archive Overview/i)).toBeInTheDocument()
    expect(await screen.findByText('movie_done.mkv')).toBeInTheDocument()
  })
})
