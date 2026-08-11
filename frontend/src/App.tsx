import { useState } from 'react'
import { usePlates, usePlateWells } from './api/plates'
import { BandLegend } from './components/BandLegend'
import { PlateGrid } from './components/PlateGrid'
import { PlatePicker } from './components/PlatePicker'

export default function App() {
  const plates = usePlates()
  const [pickedId, setPickedId] = useState<number | null>(null)

  // Fall back to the first plate rather than seeding state from an effect --
  // the list is the source of truth, so derive from it until the user picks.
  const selectedId = pickedId ?? plates.data?.[0]?.id ?? null
  const selectedPlate = plates.data?.find((plate) => plate.id === selectedId) ?? null

  const wells = usePlateWells(selectedId)

  return (
    <main className="app">
      <header className="app__header">
        <h1>Confluency Tracker</h1>
        {plates.data && plates.data.length > 0 && (
          <PlatePicker
            plates={plates.data}
            selectedId={selectedId}
            onSelect={setPickedId}
          />
        )}
      </header>

      {plates.isPending && <p className="notice">Loading plates…</p>}
      {plates.error && (
        <p className="notice notice--error" role="alert">
          Could not load plates: {plates.error.message}
        </p>
      )}
      {plates.data?.length === 0 && <p className="notice">No plates yet.</p>}

      {selectedPlate && (
        <section className="app__plate">
          <BandLegend />

          {wells.isPending && <p className="notice">Loading wells…</p>}
          {wells.error && (
            <p className="notice notice--error" role="alert">
              Could not load wells: {wells.error.message}
            </p>
          )}
          {wells.data && <PlateGrid plate={selectedPlate} wells={wells.data} />}
        </section>
      )}
    </main>
  )
}
