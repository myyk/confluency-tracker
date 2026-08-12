/**
 * Geometry for the well dial, kept apart from the component so the arithmetic
 * is testable without rendering anything.
 *
 * The dial is drawn in a 100x100 user-space box and scaled by CSS, so every
 * number here is a fraction of the well's rendered size rather than a pixel
 * count -- the same dial works at 40px on a 96-well plate and at 200px if it
 * ever gets used somewhere larger.
 *
 * Both rings are stroked circles rather than paths: a circle with radius r and
 * stroke width w paints the annulus from r - w/2 to r + w/2, so a full disc of
 * radius R is a circle of radius R/2 stroked at width R. Sweeping a fraction of
 * it is then a dash pattern, which is far less to get wrong than an arc path.
 */

/** Reading pie: a filled disc, pulled in from the edge to leave a margin. */
export const PIE_DIAMETER = 44
export const PIE_RADIUS = PIE_DIAMETER / 2
export const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS

/** Target arc: a hairline in that margin, outside the disc, inside the box. */
export const TARGET_RADIUS = 48
export const TARGET_STROKE = 3
export const TARGET_CIRCUMFERENCE = 2 * Math.PI * TARGET_RADIUS

export interface ArcDash {
  strokeDasharray: string
  strokeDashoffset: string
}

/**
 * A sweep from `start` running `span`, both as percentages of the full circle,
 * as the dash attributes for a circle of the given circumference.
 *
 * Pair it with `transform="rotate(-90 50 50)"` on the element: a dash pattern
 * starts at 3 o'clock, and a dial reads from 12.
 */
export function arcDash(start: number, span: number, circumference: number): ArcDash {
  // A reading outside 0..100 would otherwise wrap the dash past the full
  // circle and paint a sweep shorter than the one before it.
  const clamped = Math.min(Math.max(span, 0), 100)

  return {
    strokeDasharray: `${(clamped / 100) * circumference} ${circumference}`,
    strokeDashoffset: `${-(start / 100) * circumference}`,
  }
}

/** The reading itself, sweeping from 12 o'clock. */
export function valueArcDash(value: number, circumference: number): ArcDash {
  return arcDash(0, value, circumference)
}

/**
 * The target band, as the arc that marks it. The bounds are a parameter rather
 * than a constant so this file never has an opinion about where "optimal" is --
 * `confluency.ts` owns that, and passes it in.
 */
export function targetArcDash(
  range: { min: number; max: number },
  circumference: number,
): ArcDash {
  return arcDash(range.min, range.max - range.min, circumference)
}

export interface TickLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * A radial tick at `percent` round the dial, running between two radii. Same
 * clock as the arcs -- 0 at 12, climbing clockwise -- but computed here rather
 * than inherited from a rotate, so a tick needs no wrapping group.
 */
export function tickLine(percent: number, inner: number, outer: number): TickLine {
  const radians = ((percent / 100) * 2 - 0.5) * Math.PI

  return {
    x1: 50 + inner * Math.cos(radians),
    y1: 50 + inner * Math.sin(radians),
    x2: 50 + outer * Math.cos(radians),
    y2: 50 + outer * Math.sin(radians),
  }
}

/**
 * Ticks closing the ends of the target arc, one per bound. They cross the arc
 * rather than overhang it: anything past `TARGET_RADIUS + TARGET_STROKE / 2`
 * is outside the 100-unit box and gets clipped by the SVG's own overflow.
 */
export function targetTicks(range: { min: number; max: number }): TickLine[] {
  const inner = TARGET_RADIUS - TARGET_STROKE
  const outer = TARGET_RADIUS + TARGET_STROKE / 2

  return [tickLine(range.min, inner, outer), tickLine(range.max, inner, outer)]
}
