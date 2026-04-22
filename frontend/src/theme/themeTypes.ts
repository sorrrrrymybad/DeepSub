export type ThemeMode = 'auto' | 'a' | 'b' | 'c'

export interface ThemeOption {
  value: ThemeMode
  labelKey:
    | 'layout.themeOptionAuto'
    | 'layout.themeOptionA'
    | 'layout.themeOptionB'
    | 'layout.themeOptionC'
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'auto', labelKey: 'layout.themeOptionAuto' },
  { value: 'a', labelKey: 'layout.themeOptionA' },
  { value: 'b', labelKey: 'layout.themeOptionB' },
  { value: 'c', labelKey: 'layout.themeOptionC' },
]

export interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode, coords?: { x: number; y: number }) => void
}
