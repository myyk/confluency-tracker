import { describe, expect, it } from 'vitest'
import { absoluteTime, readingDate, relativeTime } from './relativeTime'

const NOW = new Date('2026-08-11T12:00:00Z')

function ago(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString()
}

describe('relativeTime', () => {
  it.each([
    [0, '0s ago'],
    [3, '3s ago'],
    [59, '59s ago'],
    [60, '1m ago'],
    [240, '4m ago'],
    [3599, '59m ago'],
    [3600, '1h ago'],
    [86399, '23h ago'],
    [86400, '1d ago'],
    [172800, '2d ago'],
    [86400 * 45, '45d ago'],
  ])('%i seconds ago reads as %s', (seconds, expected) => {
    expect(relativeTime(ago(seconds), NOW)).toBe(expected)
  })

  it('does not say "in the past" for a clock that runs ahead', () => {
    const future = new Date(NOW.getTime() + 5000).toISOString()

    expect(relativeTime(future, NOW)).toBe('just now')
  })

  it('degrades rather than throwing on an unparseable timestamp', () => {
    expect(relativeTime('not a date', NOW)).toBe('unknown')
  })
})

describe('readingDate', () => {
  // Midday UTC so the date is the same either side of most timezone offsets.
  const noon = '2026-03-14T12:00:00Z'

  it('names the day, which is what tells two readings apart', () => {
    expect(readingDate(noon)).toMatch(/Mar/)
    expect(readingDate(noon)).toMatch(/14/)
  })

  it('spells the month out in the long style, for an accessible name', () => {
    expect(readingDate(noon, 'long')).toMatch(/March/)
  })

  it('leaves the time of day out of both', () => {
    expect(readingDate(noon)).not.toMatch(/:/)
    expect(readingDate(noon, 'long')).not.toMatch(/:/)
  })

  it('passes an unparseable value straight through', () => {
    expect(readingDate('not a date')).toBe('not a date')
  })
})

describe('absoluteTime', () => {
  it('renders a real timestamp', () => {
    expect(absoluteTime('2026-08-11T12:00:00Z')).not.toBe('')
  })

  it('passes an unparseable value straight through', () => {
    expect(absoluteTime('not a date')).toBe('not a date')
  })
})
