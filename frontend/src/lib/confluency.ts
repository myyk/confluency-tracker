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
    description: '20–59% — on its way',
  },
  optimal: {
    id: 'optimal',
    label: 'optimal',
    symbol: '◕',
    description: '60–90% — ready to use',
  },
  'over-confluent': {
    id: 'over-confluent',
    label: 'over-confluent',
    symbol: '●',
    description: 'above 90% — split now',
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
  if (value < 60) return 'growing'
  if (value <= 90) return 'optimal'
  return 'over-confluent'
}

/** The band's presentation record, for callers that want it in one step. */
export function bandInfoFor(value: number | null | undefined): BandInfo {
  return BANDS[bandFor(value)]
}
