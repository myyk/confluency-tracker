import { BAND_ORDER, BANDS } from '../lib/confluency'

/**
 * Always present: the bands are a colour encoding, so the mapping has to be
 * written down somewhere the reader can see it without hovering anything.
 */
export function BandLegend() {
  return (
    <ul className="legend" aria-label="Confluency bands">
      {BAND_ORDER.map((id) => {
        const band = BANDS[id]
        return (
          <li key={id} className="legend__item" data-band={id}>
            <span className="legend__swatch" aria-hidden="true">
              {band.symbol}
            </span>
            <span className="legend__label">{band.label}</span>
            <span className="legend__range">{band.description}</span>
          </li>
        )
      })}
    </ul>
  )
}
