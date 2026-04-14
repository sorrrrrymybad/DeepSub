interface SettingsDirectorySection {
  id: string
  label: string
  description?: string
}

interface SettingsDirectoryProps {
  title: string
  sections: SettingsDirectorySection[]
  activeSection: string
  onSelect: (sectionId: string) => void
}

export default function SettingsDirectory({
  title,
  sections,
  activeSection,
  onSelect,
}: SettingsDirectoryProps) {
  return (
    <nav
      aria-label={title}
      className="ui-panel sticky top-6 self-start flex flex-col gap-3 rounded-[24px] p-4 md:p-5"
    >
      <div className="border-b border-outline-variant pb-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          {title}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {sections.map((section) => {
          const isActive = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(section.id)}
              className={[
                'rounded-[18px] border px-4 py-3 text-left transition-colors',
                isActive
                  ? 'border-primary bg-primary-container text-on-primary-container'
                  : 'border-transparent bg-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low hover:text-on-surface',
              ].join(' ')}
            >
              <span className="block text-sm font-semibold">{section.label}</span>
              {section.description ? (
                <span className="mt-1 block text-xs leading-5 opacity-80">{section.description}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
