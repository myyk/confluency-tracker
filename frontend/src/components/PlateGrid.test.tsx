import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Plate, Well } from '../api/types'
import { PlateGrid } from './PlateGrid'

function plate(rows: number, cols: number): Plate {
  return {
    id: 1,
    name: `${rows}x${cols} plate`,
    row_count: rows,
    col_count: cols,
    created_at: '2026-08-07T09:15:00Z',
  }
}

/** Every well, with `values[i]` as the latest reading (null = never measured). */
function wells(rows: number, cols: number, values: (number | null)[]): Well[] {
  return Array.from({ length: rows * cols }, (_, index) => {
    const value = values[index] ?? null
    return {
      id: index + 1,
      row_index: Math.floor(index / cols),
      col_index: index % cols,
      latest:
        value === null
          ? null
          : {
              id: index + 1,
              value,
              recorded_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
              created_at: '2026-08-07T09:15:00Z',
              updated_at: '2026-08-07T09:15:00Z',
            },
    }
  })
}

describe('PlateGrid — sized from the plate, not hardcoded', () => {
  it('renders a 2x3 plate as 6 wells', () => {
    render(<PlateGrid plate={plate(2, 3)} wells={wells(2, 3, [10, 30, 70, 95, 50, null])} />)

    expect(screen.getAllByRole('listitem').filter((el) => el.className === 'well')).toHaveLength(6)
  })

  it('renders a 96-well plate as 96 wells with the right column count', () => {
    const grid = render(
      <PlateGrid plate={plate(8, 12)} wells={wells(8, 12, Array(96).fill(55))} />,
    )

    const list = grid.container.querySelector('.plate') as HTMLElement
    expect(list.style.gridTemplateColumns).toContain('repeat(12,')
    expect(grid.container.querySelectorAll('.well')).toHaveLength(96)
  })

  it('labels the far corner of a 96-well plate H12', () => {
    render(<PlateGrid plate={plate(8, 12)} wells={wells(8, 12, Array(96).fill(55))} />)

    expect(screen.getByLabelText(/^Well H12:/)).toBeInTheDocument()
  })

  it('labels rows past Z on a very tall plate', () => {
    render(<PlateGrid plate={plate(28, 2)} wells={wells(28, 2, Array(56).fill(55))} />)

    expect(screen.getByLabelText(/^Well AB2:/)).toBeInTheDocument()
  })
})

describe('PlateGrid — what a well shows', () => {
  it('shows the value, the band name and a relative time', () => {
    render(<PlateGrid plate={plate(1, 1)} wells={wells(1, 1, [72])} />)

    const well = screen.getByLabelText(/^Well A1:/)
    expect(within(well).getByText('72')).toBeInTheDocument()
    expect(within(well).getByText('%')).toBeInTheDocument()
    expect(within(well).getByText('optimal')).toBeInTheDocument()
    expect(within(well).getByText('2d ago')).toBeInTheDocument()
  })

  it('puts the absolute timestamp on hover', () => {
    render(<PlateGrid plate={plate(1, 1)} wells={wells(1, 1, [72])} />)

    const time = screen.getByText('2d ago')
    expect(time).toHaveAttribute('title')
    expect(time.getAttribute('title')).not.toBe('')
    expect(time).toHaveAttribute('datetime')
  })

  it('marks a never-measured well as no data rather than as a low reading', () => {
    render(<PlateGrid plate={plate(1, 1)} wells={wells(1, 1, [null])} />)

    const well = screen.getByLabelText(/^Well A1:/)
    expect(well.dataset.band).toBe('no-data')
    expect(within(well).getByText('no data')).toBeInTheDocument()
    expect(within(well).getByText('never measured')).toBeInTheDocument()
    expect(within(well).queryByText('%')).not.toBeInTheDocument()
  })

  it('does not treat a zero reading as missing', () => {
    render(<PlateGrid plate={plate(1, 1)} wells={wells(1, 1, [0])} />)

    const well = screen.getByLabelText(/^Well A1:/)
    expect(well.dataset.band).toBe('very-low')
    expect(within(well).getByText('0')).toBeInTheDocument()
  })

  it('tags each well with its band so colour is never the only signal', () => {
    render(<PlateGrid plate={plate(1, 5)} wells={wells(1, 5, [5, 45, 75, 99, null])} />)

    const bands = [...document.querySelectorAll('.well')].map(
      (el) => (el as HTMLElement).dataset.band,
    )
    expect(bands).toEqual(['very-low', 'growing', 'optimal', 'over-confluent', 'no-data'])
  })

  it('seats each well by its indices, not by document order', () => {
    const shuffled = [...wells(2, 3, [10, 20, 30, 40, 50, 60])].reverse()
    render(<PlateGrid plate={plate(2, 3)} wells={shuffled} />)

    const last = screen.getByLabelText(/^Well B3:/)
    expect(last.style.gridRow).toBe('3')
    expect(last.style.gridColumn).toBe('4')
  })
})
