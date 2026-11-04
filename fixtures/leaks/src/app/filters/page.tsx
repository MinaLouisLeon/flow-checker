import { FilterBar } from '@/components/filter-bar'
import { FilterShell } from '@/components/filter-shell'

// Planted: a function inside an object, handed on by a server component.
export default function FiltersPage() {
  return (
    <FilterShell title="Orders">
      <FilterBar
        config={{
          label: 'Status',
          options: ['new', 'paid'],
          onChange: (value: string) => console.log(value),
        }}
      />
    </FilterShell>
  )
}
