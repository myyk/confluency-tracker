import type { Well } from '../api/types'
import { bandInfoFor, rangePositionPhrase } from '../lib/confluency'
import { absoluteTime, relativeTime } from '../lib/relativeTime'
import { wellLabel } from '../lib/wellLabel'
import { WellDial } from './WellDial'

interface WellCellProps {
  well: Well
  selected: boolean
  onSelect: (well: Well) => void
}

export function WellCell({ well, selected, onSelect }: WellCellProps) {
  const label = wellLabel(well.row_index, well.col_index)
  const band = bandInfoFor(well.latest?.value)
  const reading = well.latest

  return (
    // The li holds the grid seat, the button holds the card: placed by index
    // rather than by document order, so a gap in the well list could never
    // shift the rest of the plate.
    <li
      className="well-cell"
      style={{ gridRow: well.row_index + 2, gridColumn: well.col_index + 2 }}
    >
      <button
        type="button"
        className="well"
        data-band={band.id}
        aria-pressed={selected}
        onClick={() => onSelect(well)}
        aria-label={
          reading
            ? // The band alone ("optimal") names the state but not the
              // relationship, so the range is spelled out too: sighted users
              // read it off the dial, everyone else needs it said.
              `Well ${label}: ${reading.value}% confluency, ${band.label}, ${rangePositionPhrase(reading.value)}, updated ${relativeTime(reading.recorded_at)}`
            : `Well ${label}: no data, never measured`
        }
      >
        <span className="well__head">
          <span className="well__label">{label}</span>
          <WellDial value={reading?.value} />
        </span>

        <span className="well__value">
          {reading ? (
            <>
              {reading.value}
              <span className="well__unit">%</span>
            </>
          ) : (
            <span className="well__empty" aria-hidden="true">
              —
            </span>
          )}
        </span>

        <span className="well__band">
          <span className="well__symbol" aria-hidden="true">
            {band.symbol}
          </span>
          {band.label}
        </span>

        {reading ? (
          <time
            className="well__time"
            dateTime={reading.recorded_at}
            title={absoluteTime(reading.recorded_at)}
          >
            {relativeTime(reading.recorded_at)}
          </time>
        ) : (
          <span className="well__time">never measured</span>
        )}
      </button>
    </li>
  )
}
