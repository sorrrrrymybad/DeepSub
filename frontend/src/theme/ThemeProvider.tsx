import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { ThemeContextValue, ThemeMode } from './themeTypes'
import { readThemeMode, writeThemeMode } from './themeStorage'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const PREFERS_COLOR_SCHEME = '(prefers-color-scheme: dark)'

const getDocumentElement = () => (typeof document === 'undefined' ? null : document.documentElement)
const getSystemPrefersDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(PREFERS_COLOR_SCHEME).matches
    : false

const applyTheme = (mode: ThemeMode, resolvedTheme: ThemeMode) => {
  const documentElement = getDocumentElement()
  if (!documentElement) {
    return
  }

  documentElement.dataset.themeMode = mode
  documentElement.dataset.theme = resolvedTheme
}

const resolveTheme = (mode: ThemeMode, prefersDark: boolean): ThemeMode => {
  if (mode === 'auto') {
    return prefersDark ? 'b' : 'c'
  }

  return mode
}

const listenPrefersColorScheme = (
  mediaQueryList: MediaQueryList,
  handler: (event: MediaQueryListEvent) => void,
) => {
  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handler)
    return () => {
      mediaQueryList.removeEventListener('change', handler)
    }
  }

  mediaQueryList.addListener(handler)
  return () => {
    mediaQueryList.removeListener(handler)
  }
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readThemeMode())
  const [prefersDark, setPrefersDark] = useState(() => getSystemPrefersDark())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQueryList = window.matchMedia(PREFERS_COLOR_SCHEME)
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches)
    }
    const cleanup = listenPrefersColorScheme(mediaQueryList, handleChange)
    setPrefersDark(mediaQueryList.matches)

    return cleanup
  }, [])

  const resolvedTheme = useMemo(() => resolveTheme(mode, prefersDark), [mode, prefersDark])

  useLayoutEffect(() => {
    applyTheme(mode, resolvedTheme)
  }, [mode, resolvedTheme])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    writeThemeMode(next)
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({ mode, setMode }), [mode, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return ctx
}
