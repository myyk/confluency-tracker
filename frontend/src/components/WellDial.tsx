import { OPTIMAL_RANGE } from '../lib/confluency'
import {
  PIE_CIRCUMFERENCE,
  PIE_DIAMETER,
  PIE_RADIUS,
  TARGET_CIRCUMFERENCE,
  TARGET_RADIUS,
  TARGET_STROKE,
  targetArcDash,
  targetTicks,
  valueArcDash,
} from '../lib/dialGeometry'

interface WellDialProps {
  /** The latest reading, or null/undefined for a well never measured. */
  value: number | null | undefined
  /** Close the arc's ends with a tick at each bound. */
  ticks?: boolean
  /**
   * Draw the optimal-range arc. Off at density, where its 3-unit stroke lands
   * under a pixel and reads as a smudge on the pie rather than as a reference.
   */
  targetRange?: boolean
}

/**
 * A tachometer for one well: the reading as a filled pie, the optimal range as
 * a hairline arc in the margin outside it. Colour comes from `--band` on the
 * enclosing well, so the dial cannot drift away from the card it sits on.
 *
 * Where the arc is drawn at all it is drawn on every well, never-measured ones
 * included. A reference mark that comes and goes is no use for comparing wells
 * down a plate -- the eye needs it in the same place on every dial to read the
 * row at a glance. Dropping it is a decision about the whole plate, not about
 * one well, which is why it is the caller's switch and not a value test.
 *
 * Entirely decorative: the reading, the band and the range are all in the
 * button's accessible name already, so both layers are hidden from the tree.
 */
export function WellDial({ value, ticks = false, targetRange = true }: WellDialProps) {
  const measured = value !== null && value !== undefined && !Number.isNaN(value)

  return (
    <span className="dial">
      <svg className="dial__face" viewBox="0 0 100 100" aria-hidden="true">
        <circle
          className="dial__track"
          cx="50"
          cy="50"
          r={PIE_RADIUS}
          fill="none"
          strokeWidth={PIE_DIAMETER}
        />
        {measured && (
          <circle
            className="dial__fill"
            cx="50"
            cy="50"
            r={PIE_RADIUS}
            fill="none"
            strokeWidth={PIE_DIAMETER}
            strokeLinecap="butt"
            transform="rotate(-90 50 50)"
            {...valueArcDash(value, PIE_CIRCUMFERENCE)}
          />
        )}
      </svg>

      {/*
       * A second, absolutely positioned layer rather than another circle in the
       * first: the arc has to paint over the pie's edge, and stacking order in
       * SVG is document order, which would put it under any later sibling.
       */}
      {targetRange && (
        <svg className="dial__overlay" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            className="dial__target"
            cx="50"
            cy="50"
            r={TARGET_RADIUS}
            fill="none"
            strokeWidth={TARGET_STROKE}
            strokeLinecap="butt"
            transform="rotate(-90 50 50)"
            {...targetArcDash(OPTIMAL_RANGE, TARGET_CIRCUMFERENCE)}
          />
          {ticks &&
            targetTicks(OPTIMAL_RANGE).map((tick) => (
              <line key={tick.x1} className="dial__tick" strokeLinecap="butt" {...tick} />
            ))}
        </svg>
      )}
    </span>
  )
}
