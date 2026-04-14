interface FilterTabItem {
  value: string
  label: string
}

interface FilterTabsProps {
  items: FilterTabItem[]
  value: string
  onChange: (value: string) => void
}

export default function FilterTabs({ items, value, onChange }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className="filter-tab"
          data-active={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
