import { useQuery } from '@tanstack/react-query'
import type { PlateListItem, Well } from './types'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${path}`)
  }
  return (await response.json()) as T
}

export function usePlates() {
  return useQuery({
    queryKey: ['plates'],
    queryFn: () => getJson<PlateListItem[]>('/api/plates'),
  })
}

export function usePlateWells(plateId: number | null) {
  return useQuery({
    queryKey: ['plates', plateId, 'wells'],
    queryFn: () => getJson<Well[]>(`/api/plates/${plateId}/wells`),
    // Nothing to fetch until the picker has resolved to a plate.
    enabled: plateId !== null,
  })
}
