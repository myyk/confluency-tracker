import { describe, expect, it } from 'vitest'
import { columnLabel, rowLabel, wellLabel } from './wellLabel'

describe('rowLabel — single letters', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [2, 'C'],
    [24, 'Y'],
    [25, 'Z'],
  ])('row %i is %s', (index, expected) => {
    expect(rowLabel(index)).toBe(expected)
  })
})

describe('rowLabel — past Z', () => {
  it.each([
    [26, 'AA'],
    [27, 'AB'],
    [50, 'AY'],
    [51, 'AZ'],
    [52, 'BA'],
    [53, 'BB'],
    [54, 'BC'],
    [77, 'BZ'],
    [78, 'CA'],
  ])('row %i is %s', (index, expected) => {
    expect(rowLabel(index)).toBe(expected)
  })

  it('rolls over from Z to AA rather than to BA', () => {
    // Plain base-26 would produce "BA" here: there is no zero letter, so the
    // carry has to subtract one. This is the case that catches that bug.
    expect(rowLabel(25)).toBe('Z')
    expect(rowLabel(26)).toBe('AA')
  })
})

describe('rowLabel — past ZZ', () => {
  it.each([
    [700, 'ZY'],
    [701, 'ZZ'],
    [702, 'AAA'],
    [703, 'AAB'],
    [728, 'ABA'],
    [1377, 'AZZ'],
    [1378, 'BAA'],
    [18277, 'ZZZ'],
    [18278, 'AAAA'],
  ])('row %i is %s', (index, expected) => {
    expect(rowLabel(index)).toBe(expected)
  })
})

describe('rowLabel — properties', () => {
  it('never repeats a label across the first 5000 rows', () => {
    const labels = Array.from({ length: 5000 }, (_, index) => rowLabel(index))

    expect(new Set(labels).size).toBe(5000)
  })

  it('grows in length only at the documented boundaries', () => {
    expect(rowLabel(25)).toHaveLength(1)
    expect(rowLabel(26)).toHaveLength(2)
    expect(rowLabel(701)).toHaveLength(2)
    expect(rowLabel(702)).toHaveLength(3)
    expect(rowLabel(18277)).toHaveLength(3)
    expect(rowLabel(18278)).toHaveLength(4)
  })

  it('uses only capital letters', () => {
    for (let index = 0; index < 2000; index += 7) {
      expect(rowLabel(index)).toMatch(/^[A-Z]+$/)
    }
  })

  it('orders lexicographically within a fixed length', () => {
    const twoLetter = Array.from({ length: 676 }, (_, index) => rowLabel(index + 26))

    expect(twoLetter).toEqual([...twoLetter].sort())
  })
})

describe('rowLabel — rejects nonsense', () => {
  it.each([-1, 1.5, NaN, Infinity])('throws on %s', (index) => {
    expect(() => rowLabel(index)).toThrow(RangeError)
  })
})

describe('columnLabel', () => {
  it('is one-based', () => {
    expect(columnLabel(0)).toBe('1')
    expect(columnLabel(11)).toBe('12')
    expect(columnLabel(41)).toBe('42')
  })

  it.each([-1, 2.5, NaN])('throws on %s', (index) => {
    expect(() => columnLabel(index)).toThrow(RangeError)
  })
})

describe('wellLabel', () => {
  it.each([
    [0, 0, 'A1'],
    [1, 1, 'B2'],
    [2, 0, 'C1'],
    [0, 2, 'A3'],
  ])('row %i col %i is %s', (row, col, expected) => {
    expect(wellLabel(row, col)).toBe(expected)
  })

  it('labels the corners of a 6-well plate', () => {
    expect(wellLabel(0, 0)).toBe('A1')
    expect(wellLabel(1, 2)).toBe('B3')
  })

  it('labels the corners of a 96-well plate', () => {
    expect(wellLabel(0, 0)).toBe('A1')
    expect(wellLabel(7, 11)).toBe('H12')
  })

  it('labels the corners of a 1536-well plate', () => {
    // 32 rows x 48 columns: the last row is AF, well past Z.
    expect(wellLabel(31, 47)).toBe('AF48')
  })

  it('handles a plate deep past Z', () => {
    expect(wellLabel(54, 41)).toBe('BC42')
  })
})
