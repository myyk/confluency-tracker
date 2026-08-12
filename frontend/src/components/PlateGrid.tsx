import type { Plate, Well } from '../api/types'
import { densityFor } from '../lib/density'
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
 * that the seeded plates happen to be 2x3 or 8x12. A 96-well plate is the same
 * code with different numbers, down to how much each well draws: the density
 * comes off the plate's own dimensions rather than off a prop, so no caller
 * has to know which format it is handing over.
 */
export function PlateGrid({
  plate,
  wells,
  selectedWellId = null,
  onSelectWell = () => {},
}: PlateGridProps) {
  const rows = Array.from({ length: plate.row_count }, (_, index) => index)
  const columns = Array.from({ length: plate.col_count }, (_, index) => index)
  const density = densityFor(plate.row_count, plate.col_count)

  return (
    /*
     * The scroller is the wrapper, not the grid: the grid carries a min-width
     * of a legible well per column, so on a narrow window the plate runs off
     * the side and is scrolled to rather than squeezed down to unreadable.
     */
    <div className="plate-scroll">
      <ol
        className="plate"
        data-density={density}
        style={{ '--cols': plate.col_count } as React.CSSProperties}
        aria-label={`${plate.name}, ${plate.row_count} by ${plate.col_count}`}
      >
        {/*
         * Decorative for a screen reader -- every well names its own address --
         * but at 96 wells they stop being decorative for the eye. Nobody counts
         * to 12 across a grid of circles.
         */}
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
            density={density}
            selected={well.id === selectedWellId}
            onSelect={onSelectWell}
          />
        ))}
      </ol>
    </div>
  )
}
