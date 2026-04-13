interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

export default function EngineSelector({ label, value, onChange, options }: Props) {
  return (
    <div>
      <label className="block text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-[0.05em] mb-2">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-none px-4 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
