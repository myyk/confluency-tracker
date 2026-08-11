import { useId, useState } from 'react'
import type { FieldErrors } from '../api/errors'

interface MeasurementFormProps {
  initialValue?: number
  submitLabel: string
  pending: boolean
  fieldErrors: FieldErrors
  formError: string | null
  /** Resolves on success; rejects on failure, which leaves the input intact. */
  onSubmit: (value: number | null) => Promise<unknown>
  onCancel?: () => void
}

export function MeasurementForm({
  initialValue,
  submitLabel,
  pending,
  fieldErrors,
  formError,
  onSubmit,
  onCancel,
}: MeasurementFormProps) {
  const [raw, setRaw] = useState(initialValue === undefined ? '' : String(initialValue))
  const inputId = useId()
  const errorId = useId()
  const valueError = fieldErrors.value

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = raw.trim()
    // Let the server be the authority on the range. Sending null for a blank
    // field gets its "not a valid integer" message rather than inventing one.
    const value = trimmed === '' ? null : Number(trimmed)

    try {
      await onSubmit(Number.isNaN(value as number) ? null : value)
      if (initialValue === undefined) setRaw('')
    } catch {
      // Surfaced through fieldErrors / formError on the next render.
    }
  }

  return (
    // noValidate so an out-of-range value reaches the server and comes back as
    // a real 422 rather than being swallowed by the browser's own bubble.
    <form className="measure" onSubmit={handleSubmit} noValidate>
      <div className="measure__row">
        <label className="measure__label" htmlFor={inputId}>
          Confluency
        </label>
        <input
          id={inputId}
          className="measure__input"
          type="number"
          min={0}
          max={100}
          inputMode="numeric"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          disabled={pending}
          aria-invalid={valueError ? true : undefined}
          aria-describedby={valueError || formError ? errorId : undefined}
        />
        <span className="measure__unit">%</span>

        <button type="submit" className="measure__submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="measure__cancel"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
        )}
      </div>

      {(valueError || formError) && (
        <p className="measure__error" id={errorId} role="alert">
          {valueError ?? formError}
        </p>
      )}
    </form>
  )
}
