export type ThemeMode = 'auto' | 'a' | 'b' | 'c'

export interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}
