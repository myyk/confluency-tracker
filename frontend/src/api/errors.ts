/**
 * Django Ninja rejects a bad payload with 422 and a pydantic error list:
 *
 *   { "detail": [ { "type": "less_than_equal",
 *                   "loc": ["body", "payload", "value"],
 *                   "msg": "Input should be less than or equal to 100" } ] }
 *
 * The last element of `loc` is the field, which is what lets the message land
 * on the input that caused it instead of in a banner.
 */

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Field name to first message. First wins: one message per input. */
export function fieldErrorsFrom(body: unknown): FieldErrors {
  if (!isRecord(body) || !Array.isArray(body.detail)) return {}

  const errors: FieldErrors = {}
  for (const item of body.detail) {
    if (!isRecord(item) || typeof item.msg !== 'string') continue
    if (!Array.isArray(item.loc) || item.loc.length === 0) continue

    const field = String(item.loc[item.loc.length - 1])
    if (!(field in errors)) errors[field] = item.msg
  }
  return errors
}

/** Field errors carried by a failed mutation, or none for other failures. */
export function fieldErrorsOf(error: unknown): FieldErrors {
  return error instanceof ApiError ? error.fieldErrors : {}
}

/**
 * What to show when the failure was not a field-level one -- a 404 on a
 * measurement someone else deleted, or the server being unreachable.
 */
export function formErrorFrom(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
    return null
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'That measurement no longer exists. Reopen the well to refresh.'
  }
  return error.message
}
