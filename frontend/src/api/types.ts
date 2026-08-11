/**
 * Hand-written mirrors of the Ninja response schemas in
 * `backend/plates/schemas.py`. No codegen: the API is seven endpoints, and
 * writing these by hand keeps the field names snake_case exactly as the
 * wire sends them rather than papering over the boundary.
 */

/** ISO 8601, UTC, as Django Ninja serialises datetimes. */
export type IsoDateTime = string

export interface Plate {
  id: number
  name: string
  row_count: number
  col_count: number
  created_at: IsoDateTime
}

/** GET /api/plates adds the two aggregates the picker shows. */
export interface PlateListItem extends Plate {
  well_count: number
  last_reading_at: IsoDateTime | null
}

export interface Measurement {
  id: number
  /** Confluency percentage. The API guarantees 0..100 inclusive. */
  value: number
  recorded_at: IsoDateTime
  created_at: IsoDateTime
  updated_at: IsoDateTime
}

export interface Well {
  id: number
  row_index: number
  col_index: number
  /** null when the well has never been measured, or every reading was deleted. */
  latest: Measurement | null
}
