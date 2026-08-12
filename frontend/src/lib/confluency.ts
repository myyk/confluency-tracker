/**
 * Confluency display bands. This is the single place the thresholds live --
 * the grid, the legend and the well tooltips all read them from here.
 *
 *   [0, 20)   very low
 *   [20, 60)  growing
 *   [60, 90]  optimal
 *   (90, 100] over-confluent
 *   null      no data
 *
 * Note the asymmetry: 90 is optimal, 91 is over-confluent. The upper band is
 * closed at the bottom on purpose -- a well sitting exactly at 90 is still
 * fine to leave alone.
 */

export type Band = 'no-data' | 'very-low' | 'growing' | 'optimal' | 'over-confluent'

/**
 * The optimal band's bounds, inclusive at both ends. Everything that needs to
 * know where "ready to use" starts and stops -- the classifier below, the band
 * descriptions, the accessible names, any on-screen target marker -- derives
 * from this. 60 and 90 are written down here and nowhere else in the app, and
 * `confluency.source-of-truth.test.ts` fails if they turn up elsewhere.
 */
export const OPTIMAL_RANGE = { min: 60, max: 90 } as const

export interface BandInfo {
  id: Band
  /** Shown on the well, so colour is never the only carrier of the band. */
  label: string
  /**
   * A second, non-colour channel. The glyphs read as fill level, so the band
   * survives colourblindness, greyscale printing and forced-colors mode.
   */
  symbol: string
  /** Longer phrasing for the legend and the accessible name. */
  description: string
}

export const BANDS: Record<Band, BandInfo> = {
  'no-data': {
    id: 'no-data',
    label: 'no data',
    symbol: '○',
    description: 'never measured',
  },
  'very-low': {
    id: 'very-low',
    label: 'very low',
    symbol: '◔',
    description: 'below 20% — barely established',
  },
  growing: {
    id: 'growing',
    label: 'growing',
    symbol: '◑',
    description: `20–${OPTIMAL_RANGE.min - 1}% — on its way`,
  },
  optimal: {
    id: 'optimal',
    label: 'optimal',
    symbol: '◕',
    description: `${OPTIMAL_RANGE.min}–${OPTIMAL_RANGE.max}% — ready to use`,
  },
  'over-confluent': {
    id: 'over-confluent',
    label: 'over-confluent',
    symbol: '●',
    description: `above ${OPTIMAL_RANGE.max}% — over`,
  },
}

/** Legend order, low to high. `no-data` sits last: it is a state, not a level. */
export const BAND_ORDER: Band[] = [
  'very-low',
  'growing',
  'optimal',
  'over-confluent',
  'no-data',
]

/**
 * The band a reading falls in. `null` (and `undefined`, so an absent `latest`
 * needs no unwrapping at the call site) means the well was never measured.
 */
export function bandFor(value: number | null | undefined): Band {
  if (value === null || value === undefined || Number.isNaN(value)) return 'no-data'
  if (value < 20) return 'very-low'
  if (value < OPTIMAL_RANGE.min) return 'growing'
  if (value <= OPTIMAL_RANGE.max) return 'optimal'
  return 'over-confluent'
}

/** The band's presentation record, for callers that want it in one step. */
export function bandInfoFor(value: number | null | undefined): BandInfo {
  return BANDS[bandFor(value)]
}

/**
 * Where a reading sits relative to the optimal range. The bands answer "what
 * is this well?"; this answers "has it reached passage readiness yet?", which
 * is the question the plate view is actually scanned for.
 */
export type RangePosition = 'no-data' | 'below' | 'within' | 'above'

export function rangePositionFor(value: number | null | undefined): RangePosition {
  if (value === null || value === undefined || Number.isNaN(value)) return 'no-data'
  if (value < OPTIMAL_RANGE.min) return 'below'
  if (value <= OPTIMAL_RANGE.max) return 'within'
  return 'above'
}

/**
 * The relationship, spelled out for an accessible name: "within optimal range
 * 60 to 90". The bounds are named every time rather than only when the reading
 * is inside them -- a screen reader user comparing wells across a plate should
 * not have to remember the thresholds either.
 */
export function rangePositionPhrase(value: number | null | undefined): string | null {
  const position = rangePositionFor(value)
  if (position === 'no-data') return null
  return `${position} optimal range ${OPTIMAL_RANGE.min} to ${OPTIMAL_RANGE.max}`
}
