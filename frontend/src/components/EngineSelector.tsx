interface Props {
  id?: string
  label: string
  description?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function EngineSelector({
  id,
  label,
  description,
  value,
  onChange,
  options,
}: Props) {
  return (
    <div className="rounded-[20px] border border-outline-variant bg-surface-container-low p-4">
      <div className="mb-3 space-y-1">
        <label
          htmlFor={id}
          className="block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
        >
          {label}
        </label>
        {description ? <p className="text-sm leading-6 text-on-surface-variant">{description}</p> : null}
      </div>

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 pr-11 text-sm text-on-surface"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-on-surface-variant">
          <ChevronIcon />
        </span>
      </div>
    </div>
  )
}
