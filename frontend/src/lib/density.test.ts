import { describe, expect, it } from 'vitest'
import { COMFORTABLE_MAX_WELLS, densityFor } from './density'

describe('densityFor — the formats it will actually meet', () => {
  it('gives a 6-well plate the full card', () => {
    expect(densityFor(2, 3)).toBe('comfortable')
  })

  it('gives a 24-well plate the full card, being the largest that fits', () => {
    expect(densityFor(4, 6)).toBe('comfortable')
  })

  it('goes compact for a 96-well plate', () => {
    expect(densityFor(8, 12)).toBe('compact')
  })

  it('goes compact for a 384-well plate too, rather than running out', () => {
    expect(densityFor(16, 24)).toBe('compact')
  })
})

describe('densityFor — the threshold', () => {
  it('switches on well count, not on either dimension alone', () => {
    // Same 24 wells, three shapes, one answer.
    expect(densityFor(1, 24)).toBe('comfortable')
    expect(densityFor(24, 1)).toBe('comfortable')
    expect(densityFor(4, 6)).toBe('comfortable')
  })

  it('puts the boundary where the constant says, inclusive', () => {
    expect(densityFor(1, COMFORTABLE_MAX_WELLS)).toBe('comfortable')
    expect(densityFor(1, COMFORTABLE_MAX_WELLS + 1)).toBe('compact')
  })

  it('does not choke on a plate with no wells', () => {
    expect(densityFor(0, 0)).toBe('comfortable')
  })
})
