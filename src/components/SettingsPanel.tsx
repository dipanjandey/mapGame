import { useMemo, useState } from 'react'
import {
  X,
  Compass,
  MapPin,
  ChatCircleText,
  CheckCircle,
  Funnel,
  GlobeHemisphereWest,
  ArrowCounterClockwise,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import type {
  Country,
  Difficulty,
  GameMode,
  ModeSettings,
  OptionCount,
  Region,
} from '../lib/types'
import { countries, REGIONS, subregionsByRegion } from '../lib/countries'

const OPTION_VALUES: OptionCount[] = [0, 2, 3, 4]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const MODE_LABEL: Record<GameMode, string> = {
  explore: 'Explore',
  'guess-prompted': 'Guess · prompted',
  'guess-pick': 'Guess · pick on map',
}

const MODE_BLURB: Record<GameMode, string> = {
  explore: 'Click any active country to study it. Filters highlight the map.',
  'guess-prompted': 'A random active country is highlighted — name it & its capital.',
  'guess-pick': 'Click an active country, then name it & its capital.',
}

const MODE_ICON: Record<GameMode, Icon> = {
  explore: Compass,
  'guess-prompted': ChatCircleText,
  'guess-pick': MapPin,
}

// Order mirrors the top-bar switcher: simplest/landing mode first.
const MODE_ORDER: GameMode[] = ['explore', 'guess-pick', 'guess-prompted']

export default function SettingsPanel({
  mode,
  settings,
  onChangeMode,
  onChange,
  playableCount,
  reviewedCount,
  onClearReviewed,
  cvdPalette,
  onToggleCvd,
  onResetMode,
  onResetStats,
  onJumpToCountry,
  onClose,
}: {
  mode: GameMode
  settings: ModeSettings
  onChangeMode: (m: GameMode) => void
  onChange: (patch: Partial<ModeSettings>) => void
  playableCount: number
  reviewedCount: number
  onClearReviewed: () => void
  cvdPalette: boolean
  onToggleCvd: () => void
  onResetMode: () => void
  onResetStats: () => void
  onJumpToCountry: (c: Country) => void
  onClose: () => void
}) {
  const isGuess = mode !== 'explore'

  // Hover-info controls do nothing on touch (there is no hover), so hide them.
  const canHover = useMemo(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia ||
      window.matchMedia('(hover: hover)').matches,
    [],
  )

  const [search, setSearch] = useState('')

  const toggleRegion = (r: Region) => {
    const has = settings.regions.includes(r)
    const regions = has
      ? settings.regions.filter((x) => x !== r)
      : [...settings.regions, r]
    onChange({ regions, subregion: null })
  }

  const allSubregions: { region: Region; sub: string }[] = REGIONS.flatMap((r) =>
    subregionsByRegion[r].map((sub) => ({ region: r, sub })),
  )

  const tryJump = (value: string) => {
    const match = countries.find(
      (c) => c.name.toLowerCase() === value.trim().toLowerCase(),
    )
    if (match) {
      onJumpToCountry(match)
      setSearch('')
    }
  }

  const filterSummary =
    (settings.subregion
      ? settings.subregion
      : settings.regions.length
        ? settings.regions.join(', ')
        : 'All regions') +
    (settings.tier1Only ? ' · common only' : '') +
    (settings.includeDisputed ? '' : ' · no disputed')

  const filtersActive =
    settings.regions.length > 0 ||
    !!settings.subregion ||
    settings.tier1Only ||
    !settings.includeDisputed

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-top">
          <h2>Settings</h2>
          <button className="details-close" onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <section className="set-group">
          <label className="set-label">Mode</label>
          <div className="seg vert">
            {MODE_ORDER.map((m) => {
              const ModeIcon = MODE_ICON[m]
              return (
                <button
                  key={m}
                  className={`seg-btn ${mode === m ? 'on' : ''}`}
                  onClick={() => onChangeMode(m)}
                >
                  <ModeIcon className="seg-icon" size={18} weight="bold" />
                  {MODE_LABEL[m]}
                  <CheckCircle className="seg-check" size={18} weight="fill" />
                </button>
              )
            })}
          </div>
          <p className="mode-blurb">{MODE_BLURB[mode]}</p>
        </section>

        <div className="set-section-title">
          {MODE_LABEL[mode]} settings
          <span className="per-mode-note">each mode remembers its own</span>
        </div>

        {/* Guess-only: answer format + distractor difficulty */}
        {isGuess && (
          <>
            <section className="set-group">
              <label className="set-label">Answer format</label>
              <div className="seg">
                <button
                  className={`seg-btn ${!settings.fillBlanks ? 'on' : ''}`}
                  onClick={() => onChange({ fillBlanks: false })}
                >
                  Multiple choice
                </button>
                <button
                  className={`seg-btn ${settings.fillBlanks ? 'on' : ''}`}
                  onClick={() => onChange({ fillBlanks: true })}
                >
                  Fill in the blanks
                </button>
              </div>
            </section>

            {settings.fillBlanks ? (
              <section className="set-group">
                <label className="set-label">
                  Letters revealed — {settings.revealPercent}%
                </label>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={80}
                  step={5}
                  value={settings.revealPercent}
                  onChange={(e) =>
                    onChange({ revealPercent: Number(e.target.value) })
                  }
                />
                <div className="slider-ends">
                  <span>0% · hard</span>
                  <span>80% · very easy</span>
                </div>
              </section>
            ) : (
              <>
                <section className="set-group">
                  <label className="set-label">Country name — answer style</label>
                  <div className="seg">
                    {OPTION_VALUES.map((v) => (
                      <button
                        key={v}
                        className={`seg-btn ${v === 0 ? '' : 'mono'} ${settings.countryOptions === v ? 'on' : ''}`}
                        onClick={() => onChange({ countryOptions: v })}
                      >
                        {v === 0 ? 'Type' : v}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="set-group">
                  <label className="set-label">Capital — answer style</label>
                  <div className="seg">
                    {OPTION_VALUES.map((v) => (
                      <button
                        key={v}
                        className={`seg-btn ${v === 0 ? '' : 'mono'} ${settings.capitalOptions === v ? 'on' : ''}`}
                        onClick={() => onChange({ capitalOptions: v })}
                      >
                        {v === 0 ? 'Type' : v}
                      </button>
                    ))}
                  </div>
                </section>

                <p className="muted small" style={{ marginTop: -8 }}>
                  Type = free-text answer · 2–4 = that many multiple-choice options.
                </p>

                <section className="set-group">
                  <label className="set-label">Difficulty (distractor pool)</label>
                  <div className="seg">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        className={`seg-btn ${settings.difficulty === d ? 'on' : ''}`}
                        onClick={() => onChange({ difficulty: d })}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* Explore-only: what the hover tooltip reveals (hidden on touch) */}
        {!isGuess && canHover && (
          <section className="set-group">
            <label className="set-label">Show on hover</label>
            <div className="switch-col">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.hoverName}
                  onChange={(e) => onChange({ hoverName: e.target.checked })}
                />
                Country name
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.hoverCapital}
                  onChange={(e) => onChange({ hoverCapital: e.target.checked })}
                />
                Capital
              </label>
            </div>
            {!settings.hoverName && !settings.hoverCapital && (
              <p className="muted small" style={{ marginTop: 8 }}>
                Hovering shows nothing — enable one to see a tooltip.
              </p>
            )}
          </section>
        )}

        {/* Explore-only: reviewed tracking */}
        {!isGuess && (
          <section className="set-group">
            <label className="set-label">Track reviewed</label>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.markReviewed}
                onChange={(e) => onChange({ markReviewed: e.target.checked })}
              />
              Track which countries you've reviewed
            </label>
            {settings.markReviewed && (
              <>
                <p className="muted small" style={{ marginTop: 8 }}>
                  Open a country and use “Mark as reviewed” in its panel. Reviewed
                  countries fade with a ✓; progress is saved.
                </p>
                <label className="switch" style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={settings.hideReviewed}
                    onChange={(e) => onChange({ hideReviewed: e.target.checked })}
                  />
                  Hide reviewed (show only what's left)
                </label>
                {reviewedCount > 0 && (
                  <button
                    className="btn"
                    style={{ marginTop: 10 }}
                    onClick={onClearReviewed}
                  >
                    Clear reviewed ({reviewedCount})
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* Explore-only: jump straight to a country */}
        {!isGuess && (
          <section className="set-group">
            <label className="set-label">Jump to a country</label>
            <input
              className="select"
              list="wgt-country-search"
              placeholder="Type a country name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                tryJump(e.target.value)
              }}
              onKeyDown={(e) => e.key === 'Enter' && tryJump(search)}
            />
            <datalist id="wgt-country-search">
              {countries.map((c) => (
                <option key={c.cca3} value={c.name} />
              ))}
            </datalist>
          </section>
        )}

        {/* Shared: the filters that define the active country set (collapsible) */}
        <details className="filters" open={filtersActive}>
          <summary className="filters-summary">
            <Funnel size={16} weight="fill" style={{ color: 'var(--accent-bright)' }} />
            <span>Filters {isGuess ? '(scope the quiz)' : '(highlight the map)'}</span>
            <span className="muted small">{filterSummary}</span>
          </summary>

          <section className="set-group">
            <label className="set-label">Regions</label>
            <div className="chips">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  className={`chip ${settings.regions.includes(r) ? 'on' : ''}`}
                  disabled={!!settings.subregion}
                  onClick={() => toggleRegion(r)}
                >
                  {r}
                </button>
              ))}
              {settings.regions.length === 0 && !settings.subregion && (
                <span className="muted small">All regions</span>
              )}
            </div>
          </section>

          <section className="set-group">
            <label className="set-label">Drill to subregion</label>
            <select
              className="select"
              value={settings.subregion ?? ''}
              onChange={(e) => onChange({ subregion: e.target.value || null })}
            >
              <option value="">— none —</option>
              {allSubregions.map(({ region, sub }) => (
                <option key={sub} value={sub}>
                  {region} · {sub}
                </option>
              ))}
            </select>
            <p className="muted small" style={{ marginTop: 6 }}>
              Picking a subregion overrides the region chips above.
            </p>
          </section>

          <section className="set-group row">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.includeDisputed}
                onChange={(e) => onChange({ includeDisputed: e.target.checked })}
              />
              Include disputed territories
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.tier1Only}
                onChange={(e) => onChange({ tier1Only: e.target.checked })}
              />
              Common countries only (tier 1)
            </label>
          </section>
        </details>

        {/* Shared display preference */}
        <section className="set-group">
          <label className="set-label">Display</label>
          <label className="switch">
            <input type="checkbox" checked={cvdPalette} onChange={onToggleCvd} />
            Colour-blind-friendly map colours
          </label>
        </section>

        <div className="playable-count">
          <GlobeHemisphereWest className="count-icon" size={20} weight="duotone" />
          <strong>{playableCount}</strong>
          <span>countries active{isGuess ? ' in this quiz' : ' on the map'}</span>
        </div>

        <div className="set-footer">
          <button className="btn" onClick={onResetMode}>
            <ArrowCounterClockwise size={15} weight="bold" />
            Reset {MODE_LABEL[mode]} settings
          </button>
          {isGuess && (
            <button className="btn" onClick={onResetStats}>
              <Trash size={15} weight="bold" />
              Reset score &amp; stats
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
