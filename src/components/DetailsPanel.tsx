import type { Country } from '../lib/types'
import { REGION_COLORS } from '../lib/countries'

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US')

export default function DetailsPanel({
  country,
  onClose,
}: {
  country: Country
  onClose: () => void
}) {
  return (
    <div className="details">
      <button className="details-close" onClick={onClose} aria-label="Close">
        ×
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
            style={{ background: REGION_COLORS[country.region] }}
          >
            {country.region} · {country.subregion}
          </span>
        </div>
      </div>

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
          Read more on Wikipedia ↗
        </a>
      )}
    </div>
  )
}
