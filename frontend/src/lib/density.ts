/**
 * How much a well can afford to say, decided by how many of them share the
 * screen.
 *
 * Derived from the plate's own dimensions rather than passed in: a caller that
 * has to choose the mode is a caller that can get it wrong, and the plate
 * already knows how big it is. The same reason the well label is computed from
 * its indices -- a 96-well plate stays a data change.
 *
 *   comfortable  a well is a card: the reading in figures, the band named, the
 *                target range on the dial, when it was last read.
 *   compact      a well is a dial and nothing else. At the size 96 wells leave
 *                each other, a two-digit number and a 1px reference arc are
 *                not small information, they are noise -- the fill angle is
 *                what carries at that size, and the exact figure is a hover
 *                and a screen reader away.
 */

export type Density = 'comfortable' | 'compact'

/**
 * The most wells that still get the full card. A 24-well plate (4x6) is a real
 * format and the last one where a card's worth of text fits; 96 is the next
 * one up and is nowhere near.
 */
export const COMFORTABLE_MAX_WELLS = 24

export function densityFor(rowCount: number, colCount: number): Density {
  return rowCount * colCount > COMFORTABLE_MAX_WELLS ? 'compact' : 'comfortable'
}
