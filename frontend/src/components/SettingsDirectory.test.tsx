import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import SettingsDirectory from './SettingsDirectory'

describe('SettingsDirectory', () => {
  it('renders section entries and triggers onSelect for the clicked item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    renderWithProviders(
      <SettingsDirectory
        title="Settings Directory"
        sections={[
          { id: 'overview', label: 'Overview', description: 'Workspace summary' },
          { id: 'smb', label: 'SMB 服务器', description: 'Storage endpoints' },
        ]}
        activeSection="overview"
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('navigation', { name: /Settings Directory/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /SMB 服务器/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /SMB 服务器/i }))
    expect(onSelect).toHaveBeenCalledWith('smb')
  })
})
