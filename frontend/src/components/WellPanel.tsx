import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useCorrectMeasurement,
  useCreateMeasurement,
  useDeleteMeasurement,
  useWellHistory,
} from '../api/plates'
import { fieldErrorsOf, formErrorFrom } from '../api/errors'
import type { Measurement, Well } from '../api/types'
import { bandInfoFor } from '../lib/confluency'
import { absoluteTime, readingDate, relativeTime } from '../lib/relativeTime'
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
  const remove = useDeleteMeasurement(plateId, well.id)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  /*
   * Deleting a row destroys the element focus was sitting on, which would drop
   * a keyboard user back to the top of the document. The row that takes its
   * place gets focus instead; the list itself takes it when nothing is left.
   * Recorded before the request goes out, applied once the refetched list has
   * rendered -- the button to move to does not exist until then.
   */
  const listRef = useRef<HTMLOListElement>(null)
  const deleteButtons = useRef(new Map<number, HTMLButtonElement | null>())
  const focusAfterDelete = useRef<number | 'list' | null>(null)

  useEffect(() => {
    const target = focusAfterDelete.current
    if (target === null) return

    focusAfterDelete.current = null
    if (target === 'list') listRef.current?.focus()
    else deleteButtons.current.get(target)?.focus()
  }, [history.data])

  const focusConfirm = useCallback((node: HTMLDivElement | null) => {
    node?.focus()
  }, [])

  function openConfirm(measurementId: number) {
    remove.reset()
    setEditingId(null)
    setConfirmingId(measurementId)
  }

  async function confirmDelete(measurement: Measurement) {
    const rows = history.data ?? []
    const index = rows.findIndex((row) => row.id === measurement.id)
    // The row below, or the one above when the last row goes, or the list.
    const neighbour = rows[index + 1] ?? rows[index - 1]
    focusAfterDelete.current = neighbour ? neighbour.id : 'list'

    try {
      await remove.mutateAsync(measurement.id)
      setConfirmingId(null)
    } catch {
      // The row stays where it is with its message, so focus stays with it.
      focusAfterDelete.current = null
    }
  }

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
          /*
           * Reseeded whenever a new reading lands: the id changes, the form
           * remounts, and the next reading starts from the one just taken
           * rather than from a stale number or a blank field.
           */
          key={well.latest?.id ?? 'none'}
          initialValue={well.latest?.value}
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

        <ol
          className="history"
          ref={listRef}
          tabIndex={-1}
          aria-label={`Measurement history for well ${label}`}
        >
          {history.data?.map((measurement) => {
            const band = bandInfoFor(measurement.value)
            const isEditing = editingId === measurement.id
            const isConfirming = confirmingId === measurement.id
            const isDeleting = remove.isPending && remove.variables === measurement.id
            const deleteError =
              remove.variables === measurement.id ? formErrorFrom(remove.error) : null
            const prompt = `Delete ${measurement.value}% from ${readingDate(
              measurement.recorded_at,
            )}?`

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
                    {isConfirming ? (
                      /*
                       * Inline rather than window.confirm, and it names the
                       * reading: the rows differ only by two numbers, so a
                       * prompt that just said "are you sure?" would be asking
                       * about a row the user can no longer point to.
                       */
                      <div
                        className="confirm"
                        role="alertdialog"
                        aria-label={prompt}
                        tabIndex={-1}
                        ref={focusConfirm}
                        onKeyDown={(event) => {
                          if (event.key !== 'Escape' || isDeleting) return
                          // The innermost dismissible thing answers Escape.
                          event.stopPropagation()
                          setConfirmingId(null)
                        }}
                      >
                        <span className="confirm__prompt">{prompt}</span>
                        <button
                          type="button"
                          className="confirm__delete"
                          disabled={isDeleting}
                          onClick={() => confirmDelete(measurement)}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          className="confirm__cancel"
                          disabled={isDeleting}
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="history__edit"
                          onClick={() => {
                            correct.reset()
                            setConfirmingId(null)
                            setEditingId(measurement.id)
                          }}
                        >
                          Edit
                          <span className="visually-hidden">
                            {' '}
                            the {measurement.value}% reading
                          </span>
                        </button>
                        <button
                          type="button"
                          className="history__delete"
                          ref={(node) => {
                            if (node) deleteButtons.current.set(measurement.id, node)
                            else deleteButtons.current.delete(measurement.id)
                          }}
                          aria-label={`Delete reading ${measurement.value}% recorded ${readingDate(
                            measurement.recorded_at,
                            'long',
                          )}`}
                          onClick={() => openConfirm(measurement.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {deleteError && (
                      <p className="measure__error confirm__error" role="alert">
                        {deleteError}
                      </p>
                    )}
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
