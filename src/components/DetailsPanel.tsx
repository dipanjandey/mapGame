import { X, CheckCircle, ArrowUpRight } from '@phosphor-icons/react'
import type { Country } from '../lib/types'
import { regionPalette } from '../lib/countries'

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US')

export default function DetailsPanel({
  country,
  cvdPalette = false,
  tracking = false,
  reviewed = false,
  onToggleReviewed,
  onClose,
}: {
  country: Country
  cvdPalette?: boolean
  /** Reviewed-tracking mode is on: show the mark-reviewed toggle. */
  tracking?: boolean
  reviewed?: boolean
  onToggleReviewed?: () => void
  onClose: () => void
}) {
  return (
    <div className="details">
      <button className="details-close" onClick={onClose} aria-label="Close">
        <X size={18} weight="bold" />
      </button>

      <div className="details-head">
        <img
          className="flag"
          src={country.flagSvg}
          alt={`Flag of ${country.name}`}
          loading="lazy"
        />
        <div>
          <h2>
            {country.name}
            {country.disputed && <span className="badge">disputed</span>}
          </h2>
          <p className="official">{country.officialName}</p>
          <span
            className="region-chip"
            style={{ background: regionPalette(cvdPalette)[country.region] }}
          >
            {country.region} · {country.subregion}
          </span>
        </div>
      </div>

      {tracking && (
        <button
          className={`review-toggle${reviewed ? ' on' : ''}`}
          onClick={onToggleReviewed}
        >
          {reviewed ? (
            <>
              <CheckCircle size={16} weight="fill" />
              Reviewed — tap to unmark
            </>
          ) : (
            'Mark as reviewed'
          )}
        </button>
      )}

      <section>
        <h3>Capital{country.capital.length > 1 ? 's' : ''}</h3>
        <ul className="kv-list">
          {country.capital.map((cap) => (
            <li key={cap.name}>
              <span>
                {cap.name}
                {cap.type && <em className="cap-type"> · {cap.type}</em>}
              </span>
              <span className="num">{fmt(cap.population)}</span>
            </li>
          ))}
          {country.capital.length === 0 && <li className="muted">No capital listed</li>}
        </ul>
      </section>

      {country.majorCities.length > 0 && (
        <section>
          <h3>Major cities</h3>
          <ul className="kv-list">
            {country.majorCities.map((city) => (
              <li key={city.name}>
                <span>{city.name}</span>
                <span className="num">{fmt(city.population)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Facts</h3>
        <ul className="kv-list">
          <li>
            <span>Population</span>
            <span className="num">{fmt(country.population)}</span>
          </li>
          <li>
            <span>Area</span>
            <span className="num">{fmt(country.area)} km²</span>
          </li>
        </ul>
      </section>

      <section>
        <h3>Trivia</h3>
        <ul className="trivia">
          {country.trivia.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      {country.wikipedia && (
        <a
          className="wiki-link"
          href={country.wikipedia}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read more on Wikipedia
          <ArrowUpRight size={15} weight="bold" />
        </a>
      )}
    </div>
  )
}
