import { describe, expect, it } from 'vitest'
import { OPTIMAL_RANGE } from './confluency'

/**
 * The optimal bounds are a number two different things want to know: the band
 * classifier, and anything drawing the range on screen. The failure mode is
 * cheap and silent -- someone types 60 into a component, the constant moves
 * later, and the display disagrees with the classifier with nothing failing.
 *
 * So: scan the source for the bounds as bare literals and require they appear
 * in one file only. Test files are not scanned; pinning concrete expected
 * values is exactly their job (see `confluency.test.ts`, which asserts 60 and
 * 90 on purpose). A file whose 60 or 90 genuinely means something else is
 * exempted by name below, with the reason.
 *
 * The sources are read through `import.meta.glob` rather than `node:fs` so the
 * test stays inside the app's TypeScript project, which has no node globals.
 */

const EXEMPT = new Map([
  ['lib/confluency.ts', 'defines OPTIMAL_RANGE — this is the one file'],
  ['lib/relativeTime.ts', '60 is seconds per minute, unrelated to confluency'],
])

// Root-relative so the keys come back as stable `/src/...` paths -- a pattern
// relative to this file collapses same-directory hits down to `./name.ts`.
const SOURCES = Object.entries(
  import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
)
  .map(([path, source]) => [path.replace(/^\/src\//, ''), source as string] as const)
  .filter(([path]) => !/\.test\.tsx?$/.test(path))

/** Bare `60` / `90`, not the 60 inside 160, 6.0 or `--gap-60`. */
function mentionsBound(source: string, bound: number): boolean {
  return new RegExp(`(?<![\\w.$-])${bound}(?![\\w.])`).test(source)
}

describe('the optimal bounds live in exactly one file', () => {
  it('finds the source tree, so an empty scan cannot pass silently', () => {
    expect(SOURCES.length).toBeGreaterThan(5)
    expect(SOURCES.map(([path]) => path)).toContain('lib/confluency.ts')
  })

  it.each([OPTIMAL_RANGE.min, OPTIMAL_RANGE.max])('%i appears in one file only', (bound) => {
    const offenders = SOURCES.filter(([path]) => !EXEMPT.has(path))
      .filter(([, source]) => mentionsBound(source, bound))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('keeps every exemption pointing at a file that still exists', () => {
    const present = new Set(SOURCES.map(([path]) => path))

    for (const path of EXEMPT.keys()) expect(present).toContain(path)
  })
})
