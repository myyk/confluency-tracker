import { describe, expect, it } from 'vitest'
import {
  BAND_ORDER,
  BANDS,
  OPTIMAL_RANGE,
  bandFor,
  bandInfoFor,
  rangePositionFor,
  rangePositionPhrase,
} from './confluency'

describe('bandFor — the boundary values', () => {
  it.each([
    [0, 'very-low'],
    [19, 'very-low'],
    [20, 'growing'],
    [59, 'growing'],
    [60, 'optimal'],
    [90, 'optimal'],
    [91, 'over-confluent'],
    [100, 'over-confluent'],
  ])('%i is %s', (value, expected) => {
    expect(bandFor(value)).toBe(expected)
  })

  it('puts each boundary on the opposite side of its neighbour', () => {
    // The pairs that would silently swap if a < became a <=.
    expect(bandFor(19)).not.toBe(bandFor(20))
    expect(bandFor(59)).not.toBe(bandFor(60))
    expect(bandFor(90)).not.toBe(bandFor(91))
  })
})

describe('bandFor — missing readings', () => {
  it('treats null as no data', () => {
    expect(bandFor(null)).toBe('no-data')
  })

  it('treats undefined as no data, so an absent latest needs no unwrapping', () => {
    expect(bandFor(undefined)).toBe('no-data')
  })

  it('does not treat 0 as missing', () => {
    expect(bandFor(0)).toBe('very-low')
  })
})

describe('bandFor — outside the API range', () => {
  it('clamps below zero into the lowest band', () => {
    expect(bandFor(-1)).toBe('very-low')
  })

  it('clamps above 100 into the highest band', () => {
    expect(bandFor(101)).toBe('over-confluent')
  })
})

describe('band presentation', () => {
  it('gives every band a label and a non-colour symbol', () => {
    for (const band of BAND_ORDER) {
      expect(BANDS[band].label).toBeTruthy()
      expect(BANDS[band].symbol).toBeTruthy()
      expect(BANDS[band].description).toBeTruthy()
    }
  })

  it('uses a distinct symbol per band, so the glyph alone identifies it', () => {
    const symbols = BAND_ORDER.map((band) => BANDS[band].symbol)

    expect(new Set(symbols).size).toBe(BAND_ORDER.length)
  })

  it('lists every band exactly once in the legend order', () => {
    expect([...BAND_ORDER].sort()).toEqual(Object.keys(BANDS).sort())
  })

  it('resolves a value straight to its presentation record', () => {
    expect(bandInfoFor(75).label).toBe('optimal')
    expect(bandInfoFor(null).label).toBe('no data')
  })
})

/**
 * These are written against OPTIMAL_RANGE rather than against 60 and 90, so
 * they keep holding after someone edits the constant -- and start failing the
 * moment a consumer stops deriving from it. The literal expectations above are
 * the deliberate pin on today's values; these are the wiring check.
 */
describe('OPTIMAL_RANGE — everything derives from it', () => {
  it('classifies its own bounds as optimal', () => {
    expect(bandFor(OPTIMAL_RANGE.min)).toBe('optimal')
    expect(bandFor(OPTIMAL_RANGE.max)).toBe('optimal')
  })

  it('classifies just outside its bounds as something else', () => {
    expect(bandFor(OPTIMAL_RANGE.min - 1)).toBe('growing')
    expect(bandFor(OPTIMAL_RANGE.max + 1)).toBe('over-confluent')
  })

  it('spans a real range, low bound below high', () => {
    expect(OPTIMAL_RANGE.min).toBeLessThan(OPTIMAL_RANGE.max)
  })

  it('prints its bounds into the band descriptions', () => {
    expect(BANDS.optimal.description).toContain(`${OPTIMAL_RANGE.min}`)
    expect(BANDS.optimal.description).toContain(`${OPTIMAL_RANGE.max}`)
    expect(BANDS['over-confluent'].description).toContain(`${OPTIMAL_RANGE.max}`)
    expect(BANDS.growing.description).toContain(`${OPTIMAL_RANGE.min - 1}`)
  })
})

describe('rangePositionFor — the passage-readiness question', () => {
  it.each([
    [0, 'below'],
    [OPTIMAL_RANGE.min - 1, 'below'],
    [OPTIMAL_RANGE.min, 'within'],
    [OPTIMAL_RANGE.max, 'within'],
    [OPTIMAL_RANGE.max + 1, 'above'],
    [100, 'above'],
  ])('%i is %s the optimal range', (value, expected) => {
    expect(rangePositionFor(value)).toBe(expected)
  })

  it('reports a never-measured well as no data, not as below', () => {
    expect(rangePositionFor(null)).toBe('no-data')
    expect(rangePositionFor(undefined)).toBe('no-data')
  })

  it('agrees with the band classifier on every value 0..100', () => {
    for (let value = 0; value <= 100; value++) {
      const inOptimalBand = bandFor(value) === 'optimal'
      expect(rangePositionFor(value) === 'within').toBe(inOptimalBand)
    }
  })
})

describe('rangePositionPhrase — the accessible relationship', () => {
  it('names the relationship and the bounds', () => {
    expect(rangePositionPhrase(72)).toBe(
      `within optimal range ${OPTIMAL_RANGE.min} to ${OPTIMAL_RANGE.max}`,
    )
    expect(rangePositionPhrase(34)).toBe(
      `below optimal range ${OPTIMAL_RANGE.min} to ${OPTIMAL_RANGE.max}`,
    )
    expect(rangePositionPhrase(95)).toBe(
      `above optimal range ${OPTIMAL_RANGE.min} to ${OPTIMAL_RANGE.max}`,
    )
  })

  it('has nothing to say about a well that was never measured', () => {
    expect(rangePositionPhrase(null)).toBeNull()
  })
})
