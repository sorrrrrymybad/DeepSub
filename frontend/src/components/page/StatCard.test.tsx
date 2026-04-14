import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('renders title, value and hint content', () => {
    renderWithProviders(
      <StatCard title="Running" value="12" hint="tasks in progress" tone="accent" />,
    )

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('tasks in progress')).toBeInTheDocument()
  })
})
