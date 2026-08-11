import type { Plate, Well } from '../api/types'
import { columnLabel, rowLabel } from '../lib/wellLabel'
import { WellCell } from './WellCell'

interface PlateGridProps {
  plate: Plate
  wells: Well[]
  selectedWellId?: number | null
  onSelectWell?: (well: Well) => void
}

/**
 * The grid is sized entirely from row_count/col_count -- nothing here knows
 * that the seeded plates happen to be 2x3. A 96-well plate is the same code
 * with different numbers.
 */
export function PlateGrid({
  plate,
  wells,
  selectedWellId = null,
  onSelectWell = () => {},
}: PlateGridProps) {
  const rows = Array.from({ length: plate.row_count }, (_, index) => index)
  const columns = Array.from({ length: plate.col_count }, (_, index) => index)

  return (
    <ol
      className="plate"
      style={{
        // The leading `auto` is the row-letter gutter.
        gridTemplateColumns: `auto repeat(${plate.col_count}, minmax(5.5rem, 1fr))`,
      }}
      aria-label={`${plate.name}, ${plate.row_count} by ${plate.col_count}`}
    >
      {columns.map((col) => (
        <li
          key={`col-${col}`}
          className="plate__heading"
          aria-hidden="true"
          style={{ gridRow: 1, gridColumn: col + 2 }}
        >
          {columnLabel(col)}
        </li>
      ))}

      {rows.map((row) => (
        <li
          key={`row-${row}`}
          className="plate__heading"
          aria-hidden="true"
          style={{ gridRow: row + 2, gridColumn: 1 }}
        >
          {rowLabel(row)}
        </li>
      ))}

      {wells.map((well) => (
        <WellCell
          key={well.id}
          well={well}
          selected={well.id === selectedWellId}
          onSelect={onSelectWell}
        />
      ))}
    </ol>
  )
}
