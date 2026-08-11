import { describe, expect, it } from 'vitest'
import { BAND_ORDER, BANDS, bandFor, bandInfoFor } from './confluency'

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
