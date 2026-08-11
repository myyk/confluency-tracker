import { useQuery } from '@tanstack/react-query'

type Health = { status: string }

export default function App() {
  const { data, isPending, error } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
  })

  return (
    <main>
      <h1>Confluency Tracker</h1>
      <p>
        API:{' '}
        {isPending ? 'checking…' : error ? `unreachable (${error.message})` : data?.status}
      </p>
    </main>
  )
}
