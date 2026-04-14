import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'

type MenuType = 'language' | 'theme' | null

const iconClassName = 'h-[18px] w-[18px]'

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.7 2.7 4 5.7 4 9s-1.3 6.3-4 9c-2.7-2.7-4-5.7-4-9s1.3-6.3 4-9Z" />
    </svg>
  )
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClassName} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { mode, setMode } = useTheme()
  const [openMenu, setOpenMenu] = useState<MenuType>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const navItems = [
    { to: '/tasks', label: t('nav.Tasks') },
    { to: '/tasks/new', label: t('nav.NewTask') },
    { to: '/settings', label: t('nav.Settings') },
    { to: '/history', label: t('nav.History') },
  ]

  useEffect(() => {
    if (!openMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenu])

  const toggleMenu = (menu: Exclude<MenuType, null>) => {
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  const handleLanguageSelect = (nextLanguage: 'zh' | 'en') => {
    void i18n.changeLanguage(nextLanguage)
    setOpenMenu(null)
  }

  const handleThemeSelect = (nextTheme: 'auto' | 'a' | 'b' | 'c') => {
    setMode(nextTheme)
    setOpenMenu(null)
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 md:px-6 md:py-6">
        <aside className="ui-panel hidden w-72 shrink-0 rounded-[28px] p-6 md:flex md:flex-col">
          <div className="border-b border-outline-variant pb-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary">
              Subtitle Ops Console
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-on-surface">DeepSub</h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Manage subtitle jobs, engine settings and execution history from one workspace.
            </p>
          </div>

          <nav className="mt-6 flex flex-1 flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low hover:text-on-surface',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="ui-panel sticky top-4 z-20 flex items-center justify-between rounded-[24px] px-5 py-4">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Workspace
              </p>
              <p className="text-lg font-bold tracking-[-0.03em] text-on-surface">{t('nav.Tasks')}</p>
            </div>

            <div ref={menuRef} className="relative flex items-center gap-2">
              <button
                type="button"
                aria-label="language"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'language'}
                onClick={() => toggleMenu('language')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
              >
                <GlobeIcon />
              </button>

              <button
                type="button"
                aria-label="theme"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'theme'}
                onClick={() => toggleMenu('theme')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
              >
                <ThemeIcon />
              </button>

              {openMenu === 'language' && (
                <div
                  role="menu"
                  aria-label="language"
                  className="absolute right-14 top-14 min-w-[180px] rounded-[20px] border border-outline-variant bg-surface-container-lowest p-2 shadow-[var(--shadow-card)]"
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={i18n.language === 'zh'}
                    onClick={() => handleLanguageSelect('zh')}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    <span>中文</span>
                    {i18n.language === 'zh' ? <span>✓</span> : null}
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={i18n.language === 'en'}
                    onClick={() => handleLanguageSelect('en')}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    <span>English</span>
                    {i18n.language === 'en' ? <span>✓</span> : null}
                  </button>
                </div>
              )}

              {openMenu === 'theme' && (
                <div
                  role="menu"
                  aria-label="theme"
                  className="absolute right-0 top-14 min-w-[220px] rounded-[20px] border border-outline-variant bg-surface-container-lowest p-2 shadow-[var(--shadow-card)]"
                >
                  {[
                    { value: 'auto', label: 'Auto' },
                    { value: 'a', label: 'Theme A' },
                    { value: 'b', label: 'Theme B' },
                    { value: 'c', label: 'Theme C' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="menuitemradio"
                      aria-label={item.label}
                      aria-checked={mode === item.value}
                      onClick={() => handleThemeSelect(item.value as 'auto' | 'a' | 'b' | 'c')}
                      className={[
                        'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                        mode === item.value
                          ? 'bg-surface-container-high text-on-surface'
                          : 'text-on-surface hover:bg-surface-container-low',
                      ].join(' ')}
                    >
                      <span>{item.label}</span>
                      {mode === item.value ? <span>✓</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <div className="min-w-0 px-1 pb-8 md:px-2">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
