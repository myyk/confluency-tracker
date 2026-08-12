import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, fieldErrorsFrom } from './errors'
import type { Measurement, PlateListItem, Well } from './types'

/*
 * Keys are declared here rather than inline at each call site so a mutation
 * cannot invalidate a key that no query actually uses -- the failure mode
 * there is silent: the request succeeds and the grid just does not update.
 */
export const platesKey = ['plates']
export const plateWellsKey = (plateId: number) => ['plates', plateId, 'wells']
export const wellHistoryKey = (plateId: number, wellId: number) => [
  'plates',
  plateId,
  'wells',
  wellId,
  'measurements',
]

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new ApiError(response.status, `${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

async function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      `${response.status} ${response.statusText}`,
      fieldErrorsFrom(payload),
    )
  }
  return (await response.json()) as T
}

/**
 * DELETE answers 204 with no body, so there is nothing to parse on the way out.
 *
 * A 404 is treated as success rather than as a failure. It means the reading
 * was already gone -- deleted in another tab, or by someone else on the same
 * plate -- and the user's intent is satisfied either way. Reporting it would
 * ask them to retry for an outcome they already have; the invalidation that
 * follows brings the list into line with what the server actually holds.
 */
async function sendDelete(path: string): Promise<void> {
  const response = await fetch(path, { method: 'DELETE' })
  if (response.status === 404) return

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      `${response.status} ${response.statusText}`,
      fieldErrorsFrom(payload),
    )
  }
}

export function usePlates() {
  return useQuery({
    queryKey: platesKey,
    queryFn: () => getJson<PlateListItem[]>('/api/plates'),
  })
}

export function usePlateWells(plateId: number | null) {
  return useQuery({
    queryKey: plateWellsKey(plateId as number),
    queryFn: () => getJson<Well[]>(`/api/plates/${plateId}/wells`),
    // Nothing to fetch until the picker has resolved to a plate.
    enabled: plateId !== null,
  })
}

export function useWellHistory(plateId: number, wellId: number) {
  return useQuery({
    queryKey: wellHistoryKey(plateId, wellId),
    queryFn: () =>
      getJson<Measurement[]>(`/api/plates/${plateId}/wells/${wellId}/measurements`),
  })
}

/**
 * Recording and correcting both change what the grid shows, what the well's
 * history shows, and the plate's last_reading_at, so all three are refetched.
 */
function useInvalidateAfterWrite(plateId: number, wellId: number) {
  const queryClient = useQueryClient()

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: plateWellsKey(plateId) }),
      queryClient.invalidateQueries({ queryKey: wellHistoryKey(plateId, wellId) }),
      queryClient.invalidateQueries({ queryKey: platesKey, exact: true }),
    ])
}

/** recorded_at is deliberately omitted: the server stamps it now. */
export function useCreateMeasurement(plateId: number, wellId: number) {
  const invalidate = useInvalidateAfterWrite(plateId, wellId)

  return useMutation({
    mutationFn: (value: number | null) =>
      sendJson<Measurement>(
        `/api/plates/${plateId}/wells/${wellId}/measurements`,
        'POST',
        { value },
      ),
    onSuccess: invalidate,
  })
}

/**
 * A correction carries no recorded_at either, so the new row inherits the
 * reading time of the row it corrects and stays put in the timeline.
 */
export function useCorrectMeasurement(plateId: number, wellId: number) {
  const invalidate = useInvalidateAfterWrite(plateId, wellId)

  return useMutation({
    mutationFn: (input: { measurementId: number; value: number | null }) =>
      sendJson<Measurement>(`/api/measurements/${input.measurementId}`, 'PATCH', {
        value: input.value,
      }),
    onSuccess: invalidate,
  })
}

/**
 * A delete moves the grid as well as the history: removing a well's only
 * reading has to return it to the no-data treatment without a reload, which is
 * the plate-wells key. Same three keys as the other writes, for the same
 * reason -- last_reading_at moves too.
 */
export function useDeleteMeasurement(plateId: number, wellId: number) {
  const invalidate = useInvalidateAfterWrite(plateId, wellId)

  return useMutation({
    mutationFn: (measurementId: number) =>
      sendDelete(`/api/measurements/${measurementId}`),
    onSuccess: invalidate,
  })
}
