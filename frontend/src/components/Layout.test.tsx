import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../test/renderWithProviders'
import { ThemeProvider } from '../theme/ThemeProvider'
import Layout from './Layout'

describe('Layout', () => {
  it('opens theme menu and closes after selecting a theme', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/tasks']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/tasks" element={<div>Tasks Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: /theme/i }))
    expect(screen.getByRole('menu', { name: /theme/i })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitemradio', { name: /theme a/i }))
    expect(screen.queryByRole('menu', { name: /theme/i })).not.toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('a')
    expect(document.documentElement.dataset.themeMode).toBe('a')
  })
})
