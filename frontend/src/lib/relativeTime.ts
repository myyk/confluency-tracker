/**
 * Compact "time since" for the last reading on a well: 3s ago, 4m ago, 2d ago.
 * Deliberately coarse -- the exact instant is on hover via `absoluteTime`.
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'

  const seconds = Math.floor((now.getTime() - then) / 1000)
  // A reading recorded a moment ago can land slightly in the future when the
  // instrument clock runs ahead of the browser's. "in 3s ago" would be absurd.
  if (seconds < 0) return 'just now'

  if (seconds < MINUTE) return `${seconds}s ago`
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`
  return `${Math.floor(seconds / DAY)}d ago`
}

/** The full timestamp, for the `title` tooltip and the `datetime` attribute. */
export function absoluteTime(iso: string): string {
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleString()
}
