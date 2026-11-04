'use client'

interface FilterConfig {
  label: string
  options: string[]
  onChange: (value: string) => void
}

export function FilterBar({ config }: { config: FilterConfig }) {
  return (
    <label>
      {config.label}
      <select onChange={(e) => config.onChange(e.target.value)}>
        {config.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}
