import { describe, expect, it } from 'vitest'
import { ApiError, fieldErrorsFrom, fieldErrorsOf, formErrorFrom } from './errors'

/** The exact body Django Ninja returns for value=101. */
const NINJA_422 = {
  detail: [
    {
      type: 'less_than_equal',
      loc: ['body', 'payload', 'value'],
      msg: 'Input should be less than or equal to 100',
      ctx: { le: 100 },
    },
  ],
}

describe('fieldErrorsFrom', () => {
  it('maps a real Ninja 422 onto the field that caused it', () => {
    expect(fieldErrorsFrom(NINJA_422)).toEqual({
      value: 'Input should be less than or equal to 100',
    })
  })

  it('uses the last path segment, not the whole loc', () => {
    const errors = fieldErrorsFrom({
      detail: [{ loc: ['body', 'payload', 'recorded_at'], msg: 'bad date' }],
    })

    expect(errors).toEqual({ recorded_at: 'bad date' })
  })

  it('keeps the first message when a field fails twice', () => {
    const errors = fieldErrorsFrom({
      detail: [
        { loc: ['body', 'payload', 'value'], msg: 'first' },
        { loc: ['body', 'payload', 'value'], msg: 'second' },
      ],
    })

    expect(errors.value).toBe('first')
  })

  it('collects errors for several fields at once', () => {
    const errors = fieldErrorsFrom({
      detail: [
        { loc: ['body', 'payload', 'value'], msg: 'bad value' },
        { loc: ['body', 'payload', 'recorded_at'], msg: 'bad date' },
      ],
    })

    expect(errors).toEqual({ value: 'bad value', recorded_at: 'bad date' })
  })

  it.each([
    ['null', null],
    ['a string body', 'oops'],
    ['an object with no detail', { message: 'oops' }],
    ['a string detail', { detail: 'Not Found' }],
    ['entries with no loc', { detail: [{ msg: 'orphan' }] }],
    ['entries with an empty loc', { detail: [{ loc: [], msg: 'orphan' }] }],
    ['entries with no msg', { detail: [{ loc: ['body', 'value'] }] }],
  ])('returns nothing for %s', (_label, body) => {
    expect(fieldErrorsFrom(body)).toEqual({})
  })
})

describe('fieldErrorsOf', () => {
  it('pulls the errors off an ApiError', () => {
    const error = new ApiError(422, '422', { value: 'too big' })

    expect(fieldErrorsOf(error)).toEqual({ value: 'too big' })
  })

  it.each([[new Error('network down')], [null], [undefined]])(
    'returns nothing for a non-API failure',
    (error) => {
      expect(fieldErrorsOf(error)).toEqual({})
    },
  )
})

describe('formErrorFrom', () => {
  it('stays quiet when the failure already landed on a field', () => {
    const error = new ApiError(422, '422', { value: 'too big' })

    expect(formErrorFrom(error)).toBeNull()
  })

  it('explains a 404 in terms of what the user should do', () => {
    const error = new ApiError(404, '404 Not Found')

    expect(formErrorFrom(error)).toMatch(/no longer exists/)
  })

  it('falls back to the message for anything else', () => {
    expect(formErrorFrom(new Error('Failed to fetch'))).toBe('Failed to fetch')
  })

  it('is null when there is no error', () => {
    expect(formErrorFrom(null)).toBeNull()
  })
})
