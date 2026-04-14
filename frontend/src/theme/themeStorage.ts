import type { ThemeMode } from './themeTypes'

const STORAGE_KEY = 'deep-sub-theme-mode'
const VALID_THEMES: ThemeMode[] = ['auto', 'a', 'b', 'c']

export const readThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    if (stored && VALID_THEMES.includes(stored)) {
      return stored
    }
  } catch {
    // ignore storage read errors
  }

  return 'auto'
}

export const writeThemeMode = (mode: ThemeMode) => {
  if (typeof window === 'undefined' || !VALID_THEMES.includes(mode)) {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore storage write errors
  }
}
