import type { PlateListItem } from '../api/types'
import { relativeTime } from '../lib/relativeTime'

interface PlatePickerProps {
  plates: PlateListItem[]
  selectedId: number | null
  onSelect: (plateId: number) => void
}

function summarise(plate: PlateListItem): string {
  const dims = `${plate.row_count}×${plate.col_count}`
  const lastUpdated = plate.last_reading_at
    ? `updated ${relativeTime(plate.last_reading_at)}`
    : 'never measured'
  return `${plate.name} — ${dims}, ${plate.well_count} wells, ${lastUpdated}`
}

export function PlatePicker({ plates, selectedId, onSelect }: PlatePickerProps) {
  return (
    <div className="picker">
      <label className="picker__label" htmlFor="plate-picker">
        Plate
      </label>
      <select
        id="plate-picker"
        className="picker__select"
        value={selectedId ?? ''}
        onChange={(event) => onSelect(Number(event.target.value))}
      >
        {plates.map((plate) => (
          <option key={plate.id} value={plate.id}>
            {summarise(plate)}
          </option>
        ))}
      </select>
    </div>
  )
}
