import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Measurement, Well } from '../api/types'
import { WellPanel } from './WellPanel'

const PLATE_ID = 1

const WELL: Well = { id: 7, row_index: 1, col_index: 1, latest: null }

function measurement(id: number, value: number, daysAgo = 0): Measurement {
  const at = new Date(Date.now() - daysAgo * 86400 * 1000).toISOString()
  return { id, value, recorded_at: at, created_at: at, updated_at: at }
}

/** Records every request so the tests can assert on method, path and body. */
interface Call {
  url: string
  method: string
  body: unknown
}

let calls: Call[]
let history: Measurement[]
let nextResponse: { status: number; body: unknown } | null

beforeEach(() => {
  calls = []
  history = [measurement(1, 80), measurement(2, 45, 1)]
  nextResponse = null

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })

    if (method === 'GET') {
      return new Response(JSON.stringify(history), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const response = nextResponse ?? { status: 201, body: measurement(99, 55) }
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPanel(well: Well = WELL) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Spied rather than replaced, so invalidation still really happens.
  const invalidated: unknown[][] = []
  const original = queryClient.invalidateQueries.bind(queryClient)
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
    if (filters?.queryKey) invalidated.push([...filters.queryKey])
    return original(filters)
  })

  render(
    <QueryClientProvider client={queryClient}>
      <WellPanel plateId={PLATE_ID} well={well} onClose={() => {}} />
    </QueryClientProvider>,
  )
  return { invalidated }
}

/** Same as renderPanel, but lets a test push a fresh `well` prop through. */
function renderPanelForRerender(well: Well) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const ui = (w: Well) => (
    <QueryClientProvider client={queryClient}>
      <WellPanel plateId={PLATE_ID} well={w} onClose={() => {}} />
    </QueryClientProvider>
  )
  const view = render(ui(well))
  return { rerender: (next: Well) => view.rerender(ui(next)) }
}

describe('WellPanel — history', () => {
  it('lists the well history newest first, as the API ordered it', async () => {
    renderPanel()

    await screen.findByText('80')
    const values = [...document.querySelectorAll('.history__value')].map(
      (el) => el.textContent,
    )
    expect(values).toEqual(['80%', '45%'])
  })

  it('says so when the well has never been measured', async () => {
    history = []
    renderPanel()

    expect(await screen.findByText(/No measurements recorded/)).toBeInTheDocument()
  })
})

describe('WellPanel — recording a measurement', () => {
  it('posts only the value, leaving recorded_at to the server', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('80')

    await user.type(screen.getAllByLabelText('Confluency')[0], '65')
    await user.click(screen.getByRole('button', { name: 'Record' }))

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST')
      expect(post).toBeDefined()
      expect(post?.url).toBe(`/api/plates/${PLATE_ID}/wells/${WELL.id}/measurements`)
      expect(post?.body).toEqual({ value: 65 })
    })
  })

  it('invalidates the plate wells and the well history', async () => {
    const user = userEvent.setup()
    const { invalidated } = renderPanel()
    await screen.findByText('80')

    await user.type(screen.getAllByLabelText('Confluency')[0], '65')
    await user.click(screen.getByRole('button', { name: 'Record' }))

    await waitFor(() => {
      expect(invalidated).toContainEqual(['plates', PLATE_ID, 'wells'])
      expect(invalidated).toContainEqual([
        'plates',
        PLATE_ID,
        'wells',
        WELL.id,
        'measurements',
      ])
    })
  })

  it('shows the 422 message on the field instead of an alert', async () => {
    const user = userEvent.setup()
    nextResponse = {
      status: 422,
      body: {
        detail: [
          {
            type: 'less_than_equal',
            loc: ['body', 'payload', 'value'],
            msg: 'Input should be less than or equal to 100',
          },
        ],
      },
    }
    renderPanel()
    await screen.findByText('80')

    const input = screen.getAllByLabelText('Confluency')[0]
    await user.type(input, '101')
    await user.click(screen.getByRole('button', { name: 'Record' }))

    expect(
      await screen.findByText('Input should be less than or equal to 100'),
    ).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps what was typed when the server rejects it', async () => {
    const user = userEvent.setup()
    nextResponse = {
      status: 422,
      body: { detail: [{ loc: ['body', 'payload', 'value'], msg: 'too big' }] },
    }
    renderPanel()
    await screen.findByText('80')

    const input = screen.getAllByLabelText('Confluency')[0]
    await user.type(input, '101')
    await user.click(screen.getByRole('button', { name: 'Record' }))

    await screen.findByText('too big')
    expect(input).toHaveValue(101)
  })

  it("seeds the record form with the well's last reading", async () => {
    const measured: Well = { ...WELL, latest: measurement(1, 80) }
    renderPanel(measured)

    await screen.findByText('80')
    expect(screen.getAllByLabelText('Confluency')[0]).toHaveValue(80)
  })

  it('leaves the record form blank for a well never measured', async () => {
    history = []
    renderPanel()

    await screen.findByText(/No measurements recorded/)
    expect(screen.getAllByLabelText('Confluency')[0]).toHaveValue(null)
  })

  it('reseeds the record form when a new reading lands', async () => {
    const { rerender } = renderPanelForRerender({ ...WELL, latest: measurement(1, 80) })
    await screen.findByText('80')
    expect(screen.getAllByLabelText('Confluency')[0]).toHaveValue(80)

    // What the refetch after a write does: the well arrives with a new latest.
    rerender({ ...WELL, latest: measurement(2, 88) })

    await waitFor(() =>
      expect(screen.getAllByLabelText('Confluency')[0]).toHaveValue(88),
    )
  })

  it('clears the field after a successful record', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('80')

    const input = screen.getAllByLabelText('Confluency')[0]
    await user.type(input, '65')
    await user.click(screen.getByRole('button', { name: 'Record' }))

    await waitFor(() => expect(input).toHaveValue(null))
  })
})

describe('WellPanel — correcting a measurement', () => {
  it('patches the row that was edited, with no recorded_at', async () => {
    const user = userEvent.setup()
    nextResponse = { status: 200, body: measurement(3, 88) }
    renderPanel()
    await screen.findByText('80')

    await user.click(screen.getAllByRole('button', { name: /^Edit/ })[0])
    const input = screen.getByDisplayValue('80')
    await user.clear(input)
    await user.type(input, '88')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = calls.find((call) => call.method === 'PATCH')
      expect(patch?.url).toBe('/api/measurements/1')
      expect(patch?.body).toEqual({ value: 88 })
    })
  })

  it('seeds the inline edit with the current value', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('80')

    await user.click(screen.getAllByRole('button', { name: /^Edit/ })[1])

    expect(screen.getByDisplayValue('45')).toBeInTheDocument()
  })

  it('shows a 422 from a correction on the inline field', async () => {
    const user = userEvent.setup()
    nextResponse = {
      status: 422,
      body: { detail: [{ loc: ['body', 'payload', 'value'], msg: 'out of range' }] },
    }
    renderPanel()
    await screen.findByText('80')

    await user.click(screen.getAllByRole('button', { name: /^Edit/ })[0])
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('out of range')).toBeInTheDocument()
    // The row stays in edit mode so the value can be fixed.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('closes the inline edit on cancel without calling the API', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('80')

    await user.click(screen.getAllByRole('button', { name: /^Edit/ })[0])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  })
})

describe('WellPanel — pending state', () => {
  it('disables submit while the request is in flight', async () => {
    const user = userEvent.setup()
    const gate: { release: () => void } = { release: () => {} }
    const blocked = new Promise<void>((resolve) => {
      gate.release = resolve
    })

    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') !== 'GET') await blocked
      return realFetch(url, init)
    })

    renderPanel()
    await screen.findByText('80')

    await user.type(screen.getAllByLabelText('Confluency')[0], '65')
    const submit = screen.getByRole('button', { name: 'Record' })
    await user.click(submit)

    const saving = await screen.findByRole('button', { name: 'Saving…' })
    expect(saving).toBeDisabled()

    gate.release()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Record' })).toBeEnabled(),
    )
  })
})

describe('WellPanel — band colouring', () => {
  it('tags each history row with its band', async () => {
    renderPanel()
    await screen.findByText('80')

    const rows = document.querySelectorAll('.history__row')
    expect([...rows].map((row) => (row as HTMLElement).dataset.band)).toEqual([
      'optimal',
      'growing',
    ])
  })

  it('shows the absolute timestamp on hover', async () => {
    renderPanel()
    await screen.findByText('80')

    const time = within(document.querySelector('.history__row') as HTMLElement).getByText(
      /ago|just now/,
    )
    expect(time).toHaveAttribute('title')
  })
})
