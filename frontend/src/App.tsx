import { useState } from 'react'
import { usePlates, usePlateWells } from './api/plates'
import type { Well } from './api/types'
import { BandLegend } from './components/BandLegend'
import { PlateGrid } from './components/PlateGrid'
import { PlatePicker } from './components/PlatePicker'
import { WellPanel } from './components/WellPanel'

export default function App() {
  const plates = usePlates()
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [selectedWellId, setSelectedWellId] = useState<number | null>(null)

  // Fall back to the first plate rather than seeding state from an effect --
  // the list is the source of truth, so derive from it until the user picks.
  const selectedId = pickedId ?? plates.data?.[0]?.id ?? null
  const selectedPlate = plates.data?.find((plate) => plate.id === selectedId) ?? null

  const wells = usePlateWells(selectedId)
  // Read the well back out of the query rather than storing it, so the panel
  // shows the refetched reading after a write instead of a stale snapshot.
  const selectedWell = wells.data?.find((well) => well.id === selectedWellId) ?? null

  function pickPlate(plateId: number) {
    setPickedId(plateId)
    setSelectedWellId(null)
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Confluency Tracker</h1>
        {plates.data && plates.data.length > 0 && (
          <PlatePicker
            plates={plates.data}
            selectedId={selectedId}
            onSelect={pickPlate}
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
        <div className="app__body">
          <section className="app__plate">
            <BandLegend />

            {wells.isPending && <p className="notice">Loading wells…</p>}
            {wells.error && (
              <p className="notice notice--error" role="alert">
                Could not load wells: {wells.error.message}
              </p>
            )}
            {wells.data && (
              <PlateGrid
                plate={selectedPlate}
                wells={wells.data}
                selectedWellId={selectedWellId}
                onSelectWell={(well: Well) => setSelectedWellId(well.id)}
              />
            )}
          </section>

          {selectedWell && (
            <WellPanel
              // Remount on a different well so no edit stays open across wells.
              key={selectedWell.id}
              plateId={selectedPlate.id}
              well={selectedWell}
              onClose={() => setSelectedWellId(null)}
            />
          )}
        </div>
      )}
    </main>
  )
}
