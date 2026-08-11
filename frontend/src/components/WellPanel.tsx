import { useState } from 'react'
import { useCorrectMeasurement, useCreateMeasurement, useWellHistory } from '../api/plates'
import { fieldErrorsOf, formErrorFrom } from '../api/errors'
import type { Well } from '../api/types'
import { bandInfoFor } from '../lib/confluency'
import { absoluteTime, relativeTime } from '../lib/relativeTime'
import { wellLabel } from '../lib/wellLabel'
import { MeasurementForm } from './MeasurementForm'

interface WellPanelProps {
  plateId: number
  well: Well
  onClose: () => void
}

export function WellPanel({ plateId, well, onClose }: WellPanelProps) {
  const label = wellLabel(well.row_index, well.col_index)
  const history = useWellHistory(plateId, well.id)
  const create = useCreateMeasurement(plateId, well.id)
  const correct = useCorrectMeasurement(plateId, well.id)
  const [editingId, setEditingId] = useState<number | null>(null)

  return (
    <aside className="panel" aria-label={`Well ${label}`}>
      <header className="panel__header">
        <h2 className="panel__title">Well {label}</h2>
        <button type="button" className="panel__close" onClick={onClose}>
          Close
        </button>
      </header>

      <section className="panel__section">
        <h3 className="panel__heading">Record a measurement</h3>
        <MeasurementForm
          submitLabel="Record"
          pending={create.isPending}
          fieldErrors={fieldErrorsOf(create.error)}
          formError={formErrorFrom(create.error)}
          onSubmit={(value) => create.mutateAsync(value)}
        />
      </section>

      <section className="panel__section">
        <h3 className="panel__heading">History</h3>

        {history.isPending && <p className="notice">Loading history…</p>}
        {history.error && (
          <p className="notice notice--error" role="alert">
            Could not load history: {history.error.message}
          </p>
        )}
        {history.data?.length === 0 && (
          <p className="notice">No measurements recorded for this well yet.</p>
        )}

        <ol className="history">
          {history.data?.map((measurement) => {
            const band = bandInfoFor(measurement.value)
            const isEditing = editingId === measurement.id

            return (
              <li className="history__row" key={measurement.id} data-band={band.id}>
                {isEditing ? (
                  <MeasurementForm
                    initialValue={measurement.value}
                    submitLabel="Save"
                    pending={correct.isPending}
                    fieldErrors={fieldErrorsOf(correct.error)}
                    formError={formErrorFrom(correct.error)}
                    onCancel={() => {
                      correct.reset()
                      setEditingId(null)
                    }}
                    onSubmit={async (value) => {
                      await correct.mutateAsync({ measurementId: measurement.id, value })
                      setEditingId(null)
                    }}
                  />
                ) : (
                  <>
                    <span className="history__value">
                      {measurement.value}
                      <span className="history__unit">%</span>
                    </span>
                    <span className="history__band">
                      <span aria-hidden="true">{band.symbol}</span> {band.label}
                    </span>
                    <time
                      className="history__time"
                      dateTime={measurement.recorded_at}
                      title={absoluteTime(measurement.recorded_at)}
                    >
                      {relativeTime(measurement.recorded_at)}
                    </time>
                    <button
                      type="button"
                      className="history__edit"
                      onClick={() => {
                        correct.reset()
                        setEditingId(measurement.id)
                      }}
                    >
                      Edit
                      <span className="visually-hidden">
                        {' '}
                        the {measurement.value}% reading
                      </span>
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </aside>
  )
}
