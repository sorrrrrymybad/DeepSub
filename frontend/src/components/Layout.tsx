import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Layout() {
  const { t, i18n } = useTranslation()

  const navItems = [
    { to: '/tasks', label: t('nav.Tasks') },
    { to: '/tasks/new', label: t('nav.NewTask') },
    { to: '/settings', label: t('nav.Settings') },
    { to: '/history', label: t('nav.History') },
  ]

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  }

  return (
    <div className="flex h-screen bg-background font-sans text-on-background">
      <aside className="w-64 bg-surface-container-low flex flex-col py-8 px-6 gap-4">
        <h1 className="text-[1.5rem] font-bold mb-8 uppercase tracking-[-0.02em] leading-none text-primary">DeepSub</h1>
        <nav className="flex flex-col gap-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors duration-150 ease-linear ${
                  isActive 
                    ? 'bg-surface-container-highest text-primary' 
                    : 'text-on-surface hover:bg-surface-container'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-background flex flex-col">
        <header className="flex justify-end p-6 pb-0 max-w-6xl w-full mx-auto">
          <button 
            onClick={toggleLanguage}
            className="text-[0.6875rem] font-medium tracking-[0.05em] uppercase text-on-surface-variant hover:text-primary transition-colors bg-surface-container-lowest border border-outline-variant px-3 py-1"
          >
            {i18n.language === 'zh' ? 'EN / 中文' : 'ZH / ENG'}
          </button>
        </header>
        <div className="p-12 pt-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
