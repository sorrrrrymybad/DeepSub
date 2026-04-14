import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { smbApi } from '../api/smb'
import { renderWithProviders } from '../test/renderWithProviders'
import NewTaskPage from './NewTaskPage'

describe('NewTaskPage', () => {
  it('renders smb selection, parameter section and selected file summary', async () => {
    const user = userEvent.setup()

    vi.spyOn(smbApi, 'list').mockResolvedValue([
      {
        id: 1,
        name: 'Media Hub',
        host: '192.168.1.9',
        port: 445,
        share: 'videos',
        domain: null,
        username: 'demo',
        created_at: '2026-04-14T02:00:00Z',
      },
    ])

    vi.spyOn(smbApi, 'browse').mockResolvedValue([
      { name: 'movie_01.mkv', is_dir: false, size: 1024 * 1024 * 512 },
    ])

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderWithProviders(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewTaskPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: /新建作业|New Operation/i })).toBeInTheDocument()
    expect(screen.getByText(/Operation Pipeline|任务流水线/i)).toBeInTheDocument()
    expect(screen.getByText(/Processing Profile|处理配置/i)).toBeInTheDocument()

    expect(await screen.findByRole('option', { name: /Media Hub/i })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/SMB Server|SMB 服务器/i), '1')
    await user.click(await screen.findByLabelText(/movie_01\.mkv/i))

    expect(screen.getAllByText(/Selected Assets|已选文件/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('movie_01.mkv').length).toBeGreaterThan(0)
  })
})
