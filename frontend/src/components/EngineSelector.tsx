interface Props {
  id?: string
  label: string
  description?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
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

      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl px-4 py-3 text-sm"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
