import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders'
import { ThemeProvider, useTheme } from './ThemeProvider'

const createMatchMedia = (initialMatches: boolean) => {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  const toCallback = (
    listener: EventListenerOrEventListenerObject,
  ): ((event: MediaQueryListEvent) => void) => {
    if (typeof listener === 'function') {
      return listener as (event: MediaQueryListEvent) => void
    }

    return (event: MediaQueryListEvent) => listener.handleEvent(event)
  }

  const notifyListeners = (nextMatches: boolean) => {
    const event = { matches: nextMatches } as MediaQueryListEvent
    listeners.forEach((listener) => listener(event))
  }

  const matchMedia: MediaQueryList & { changeMatches(next: boolean): void } = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'change') {
        listeners.add(toCallback(listener))
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === 'change') {
        listeners.delete(toCallback(listener))
      }
    },
    addListener(listener: (event: MediaQueryListEvent) => void) {
      listeners.add(listener)
    },
    removeListener(listener: (event: MediaQueryListEvent) => void) {
      listeners.delete(listener)
    },
    dispatchEvent: () => false,
    changeMatches(next: boolean) {
      matches = next
      notifyListeners(next)
    },
  }

  return matchMedia
}

const attachMatchMedia = (matches: boolean) => {
  const mediaQueryList = createMatchMedia(matches)
  window.matchMedia = vi.fn(() => mediaQueryList) as typeof window.matchMedia
  return mediaQueryList
}

const TestComponent = () => {
  const { mode, setMode } = useTheme()

  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('a')}>Set A</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.theme = ''
    document.documentElement.dataset.themeMode = ''
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('defaults to auto and writes light theme attributes', () => {
    attachMatchMedia(false)

    renderWithProviders(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    )

    expect(document.documentElement.dataset.theme).toBe('c')
    expect(document.documentElement.dataset.themeMode).toBe('auto')
  })

  it('resolves auto to dark theme when system prefers dark', () => {
    attachMatchMedia(true)

    renderWithProviders(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    )

    expect(document.documentElement.dataset.theme).toBe('b')
    expect(document.documentElement.dataset.themeMode).toBe('auto')
  })

  it('removes prefers-color-scheme listener when unmounted', () => {
    const mediaQueryList = attachMatchMedia(false)
    const addSpy = vi.spyOn(mediaQueryList, 'addEventListener')
    const removeSpy = vi.spyOn(mediaQueryList, 'removeEventListener')

    const { unmount } = renderWithProviders(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    )

    expect(addSpy).toHaveBeenCalledWith('change', expect.any(Function))
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('writes selection updates to localStorage and document', async () => {
    attachMatchMedia(false)
    const user = userEvent.setup()

    renderWithProviders(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set A' }))

    expect(window.localStorage.getItem('deep-sub-theme-mode')).toBe('a')
    expect(document.documentElement.dataset.theme).toBe('a')
    expect(document.documentElement.dataset.themeMode).toBe('a')
  })
})
