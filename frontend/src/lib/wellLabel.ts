/**
 * Well labels are derived from indices, never stored -- which is what makes a
 * 96-well plate a data change rather than a code change. The backend keeps
 * only row_index/col_index; formatting them is presentation and lives here.
 */

const LETTERS = 26
const A = 'A'.charCodeAt(0)

/**
 * Row index to its letter, in bijective base-26: A..Z, then AA..AZ, BA..,
 * ZZ, AAA. Not plain base-26 -- there is no zero digit, so the carry
 * subtracts one on each step. Row 54 is BC, not BD.
 */
export function rowLabel(rowIndex: number): string {
  if (!Number.isInteger(rowIndex) || rowIndex < 0) {
    throw new RangeError(`row index must be a non-negative integer, got ${rowIndex}`)
  }

  let label = ''
  for (let n = rowIndex; n >= 0; n = Math.floor(n / LETTERS) - 1) {
    label = String.fromCharCode(A + (n % LETTERS)) + label
  }
  return label
}

/** Column index to its 1-based number: column 0 is 1. */
export function columnLabel(colIndex: number): string {
  if (!Number.isInteger(colIndex) || colIndex < 0) {
    throw new RangeError(`column index must be a non-negative integer, got ${colIndex}`)
  }
  return String(colIndex + 1)
}

/** The well's address as a human writes it on a plate: A1, B2, H12, BC42. */
export function wellLabel(rowIndex: number, colIndex: number): string {
  return rowLabel(rowIndex) + columnLabel(colIndex)
}
