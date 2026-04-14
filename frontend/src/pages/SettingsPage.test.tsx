import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { smbApi } from '../api/smb'
import { settingsApi } from '../api/settings'
import { renderWithProviders } from '../test/renderWithProviders'
import SettingsPage from './SettingsPage'

describe('SettingsPage', () => {
  it('renders the settings directory and scrolls to sections from the directory', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.fn()

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    })
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
    vi.spyOn(settingsApi, 'getSTT').mockResolvedValue({})
    vi.spyOn(settingsApi, 'getTranslate').mockResolvedValue({})

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderWithProviders(
      <QueryClientProvider client={queryClient}>
        <SettingsPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: /系统设置|System Settings/i })).toBeInTheDocument()

    const directory = screen.getByRole('navigation', { name: /设置目录|Settings Directory/i })
    await user.click(within(directory).getByRole('button', { name: /SMB Servers|SMB 服务器/i }))

    expect(scrollSpy).toHaveBeenCalled()
  })
})
