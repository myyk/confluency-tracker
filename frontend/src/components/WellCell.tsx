import type { Well } from '../api/types'
import { bandInfoFor } from '../lib/confluency'
import { absoluteTime, relativeTime } from '../lib/relativeTime'
import { wellLabel } from '../lib/wellLabel'

interface WellCellProps {
  well: Well
}

export function WellCell({ well }: WellCellProps) {
  const label = wellLabel(well.row_index, well.col_index)
  const band = bandInfoFor(well.latest?.value)
  const reading = well.latest

  return (
    <li
      className="well"
      data-band={band.id}
      // Placed by index rather than by document order, so a gap in the well
      // list could never shift the rest of the plate into the wrong seats.
      style={{ gridRow: well.row_index + 2, gridColumn: well.col_index + 2 }}
      aria-label={
        reading
          ? `Well ${label}: ${reading.value}% confluency, ${band.label}, updated ${relativeTime(reading.recorded_at)}`
          : `Well ${label}: no data, never measured`
      }
    >
      <span className="well__label">{label}</span>

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
    </li>
  )
}
