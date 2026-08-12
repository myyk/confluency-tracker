import { describe, expect, it } from 'vitest'
import { OPTIMAL_RANGE, bandFor } from './confluency'
import {
  PIE_CIRCUMFERENCE,
  PIE_DIAMETER,
  PIE_RADIUS,
  TARGET_CIRCUMFERENCE,
  TARGET_RADIUS,
  TARGET_STROKE,
  arcDash,
  targetArcDash,
  targetTicks,
  tickLine,
  valueArcDash,
} from './dialGeometry'

/** The dash attributes back as the percentages they encode. */
function decode(dash: { strokeDasharray: string; strokeDashoffset: string }, circumference: number) {
  const [drawn] = dash.strokeDasharray.split(' ').map(Number)
  return {
    start: (-Number(dash.strokeDashoffset) / circumference) * 100,
    span: (drawn / circumference) * 100,
  }
}

describe('arcDash — the sweep it encodes', () => {
  it('draws nothing for an empty span, and leaves the rest of the circle as gap', () => {
    expect(arcDash(0, 0, 400)).toEqual({ strokeDasharray: '0 400', strokeDashoffset: '0' })
  })

  it('draws the whole circle for a full span', () => {
    expect(arcDash(0, 100, 400)).toEqual({ strokeDasharray: '400 400', strokeDashoffset: '0' })
  })

  it('draws a quarter as a quarter', () => {
    expect(arcDash(0, 25, 400).strokeDasharray).toBe('100 400')
  })

  it('offsets a sweep that starts partway round, negatively', () => {
    // A positive dashoffset walks the pattern backwards, so a mark that starts
    // at 30% needs -30% of the circumference.
    expect(arcDash(30, 10, 400)).toEqual({ strokeDasharray: '40 400', strokeDashoffset: '-120' })
  })

  it('always names the full circumference as the gap, so nothing repeats', () => {
    for (const span of [1, 33, 99]) {
      expect(arcDash(0, span, 400).strokeDasharray.split(' ')[1]).toBe('400')
    }
  })

  it('round-trips an arbitrary start and span', () => {
    const decoded = decode(arcDash(17, 42, TARGET_CIRCUMFERENCE), TARGET_CIRCUMFERENCE)

    expect(decoded.start).toBeCloseTo(17)
    expect(decoded.span).toBeCloseTo(42)
  })
})

describe('arcDash — readings outside 0..100', () => {
  it('clamps a span over 100 to the full circle rather than wrapping it', () => {
    expect(arcDash(0, 140, 400).strokeDasharray).toBe('400 400')
  })

  it('clamps a negative span to nothing rather than drawing backwards', () => {
    expect(arcDash(0, -20, 400).strokeDasharray).toBe('0 400')
  })
})

describe('valueArcDash — the reading', () => {
  it('starts at 12 o’clock, which is offset zero before the rotate', () => {
    expect(valueArcDash(72, 400).strokeDashoffset).toBe('0')
  })

  it('sweeps in proportion to the reading', () => {
    expect(decode(valueArcDash(72, PIE_CIRCUMFERENCE), PIE_CIRCUMFERENCE).span).toBeCloseTo(72)
  })

  it('shows nothing at zero, which is a real reading and not a missing one', () => {
    expect(valueArcDash(0, 400).strokeDasharray).toBe('0 400')
  })
})

describe('targetArcDash — the range mark', () => {
  it('starts at the low bound and spans to the high one', () => {
    const decoded = decode(targetArcDash({ min: 25, max: 75 }, 400), 400)

    expect(decoded.start).toBeCloseTo(25)
    expect(decoded.span).toBeCloseTo(50)
  })

  it('takes the bounds as an argument, holding no opinion of its own', () => {
    const narrow = decode(targetArcDash({ min: 40, max: 45 }, 400), 400)
    const wide = decode(targetArcDash({ min: 10, max: 95 }, 400), 400)

    expect(narrow.span).toBeCloseTo(5)
    expect(wide.span).toBeCloseTo(85)
  })
})

/**
 * The point of the whole exercise: the arc has to mark the same stretch the
 * classifier calls optimal. Both derive from OPTIMAL_RANGE, and this is what
 * fails if one of them stops doing so.
 */
describe('the arc marks exactly what the classifier calls optimal', () => {
  const arc = decode(targetArcDash(OPTIMAL_RANGE, TARGET_CIRCUMFERENCE), TARGET_CIRCUMFERENCE)

  it('begins at the first reading in the optimal band', () => {
    expect(bandFor(Math.round(arc.start))).toBe('optimal')
    expect(bandFor(Math.round(arc.start) - 1)).not.toBe('optimal')
  })

  it('ends at the last reading in the optimal band', () => {
    const end = Math.round(arc.start + arc.span)

    expect(bandFor(end)).toBe('optimal')
    expect(bandFor(end + 1)).not.toBe('optimal')
  })

  it('covers every optimal reading and nothing else', () => {
    for (let value = 0; value <= 100; value++) {
      const underTheArc = value >= arc.start && value <= arc.start + arc.span
      expect(underTheArc).toBe(bandFor(value) === 'optimal')
    }
  })
})

describe('tickLine — the boundary marks', () => {
  it('puts a tick at 0% straight up from the centre', () => {
    const tick = tickLine(0, 40, 50)

    expect(tick.x1).toBeCloseTo(50)
    expect(tick.y1).toBeCloseTo(10)
    expect(tick.x2).toBeCloseTo(50)
    expect(tick.y2).toBeCloseTo(0)
  })

  it('puts a tick at 25% out to the right, matching the arcs’ clock', () => {
    const tick = tickLine(25, 40, 50)

    expect(tick.x1).toBeCloseTo(90)
    expect(tick.y1).toBeCloseTo(50)
  })

  it('puts a tick at 50% straight down', () => {
    const tick = tickLine(50, 40, 50)

    expect(tick.x1).toBeCloseTo(50)
    expect(tick.y1).toBeCloseTo(90)
  })

  it('runs radially, both ends on the same bearing from the centre', () => {
    const tick = tickLine(37, 40, 50)
    const bearing = (x: number, y: number) => Math.atan2(y - 50, x - 50)

    expect(bearing(tick.x1, tick.y1)).toBeCloseTo(bearing(tick.x2, tick.y2))
  })
})

describe('targetTicks — one per bound, inside the box', () => {
  it('marks both ends of the range', () => {
    const [low, high] = targetTicks({ min: 25, max: 50 })

    expect(low.x1).toBeCloseTo(50 + (TARGET_RADIUS - TARGET_STROKE))
    expect(high.y1).toBeCloseTo(50 + (TARGET_RADIUS - TARGET_STROKE))
  })

  it('stays within the 100-unit box, so the SVG cannot clip a tick', () => {
    for (const tick of targetTicks(OPTIMAL_RANGE)) {
      for (const coordinate of [tick.x1, tick.y1, tick.x2, tick.y2]) {
        expect(coordinate).toBeGreaterThanOrEqual(0)
        expect(coordinate).toBeLessThanOrEqual(100)
      }
    }
  })

  it('crosses the arc rather than sitting beside it', () => {
    const [tick] = targetTicks(OPTIMAL_RANGE)
    const radius = (x: number, y: number) => Math.hypot(x - 50, y - 50)

    expect(radius(tick.x1, tick.y1)).toBeLessThan(TARGET_RADIUS)
    expect(radius(tick.x2, tick.y2)).toBeGreaterThan(TARGET_RADIUS)
  })
})

describe('dial proportions', () => {
  it('strokes the pie at its own diameter, so it paints a disc and not a ring', () => {
    expect(PIE_RADIUS * 2).toBe(PIE_DIAMETER)
  })

  it('leaves the pie a margin inside the 100-unit box for the arc to sit in', () => {
    const pieEdge = PIE_RADIUS + PIE_DIAMETER / 2
    const arcInnerEdge = TARGET_RADIUS - TARGET_STROKE / 2
    const arcOuterEdge = TARGET_RADIUS + TARGET_STROKE / 2

    expect(arcInnerEdge).toBeGreaterThan(pieEdge)
    expect(arcOuterEdge).toBeLessThanOrEqual(50)
  })

  it('derives each circumference from its own radius', () => {
    expect(PIE_CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * PIE_RADIUS)
    expect(TARGET_CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * TARGET_RADIUS)
  })
})
