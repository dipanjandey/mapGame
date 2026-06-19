import type {
  Difficulty,
  GameMode,
  ModeSettings,
  OptionCount,
  Region,
} from '../lib/types'
import { REGIONS, subregionsByRegion } from '../lib/countries'

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

export default function SettingsPanel({
  mode,
  settings,
  onChangeMode,
  onChange,
  playableCount,
  onClose,
}: {
  mode: GameMode
  settings: ModeSettings
  onChangeMode: (m: GameMode) => void
  onChange: (patch: Partial<ModeSettings>) => void
  playableCount: number
  onClose: () => void
}) {
  const isGuess = mode !== 'explore'

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

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-top">
          <h2>Settings</h2>
          <button className="details-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <section className="set-group">
          <label className="set-label">Mode</label>
          <div className="seg vert">
            {(['guess-prompted', 'guess-pick', 'explore'] as GameMode[]).map((m) => (
              <button
                key={m}
                className={`seg-btn ${mode === m ? 'on' : ''}`}
                onClick={() => onChangeMode(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
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
              <label className="set-label"># options — country</label>
              <div className="seg">
                {OPTION_VALUES.map((v) => (
                  <button
                    key={v}
                    className={`seg-btn ${settings.countryOptions === v ? 'on' : ''}`}
                    onClick={() => onChange({ countryOptions: v })}
                  >
                    {v === 0 ? 'Spell' : v}
                  </button>
                ))}
              </div>
            </section>

            <section className="set-group">
              <label className="set-label"># options — capital</label>
              <div className="seg">
                {OPTION_VALUES.map((v) => (
                  <button
                    key={v}
                    className={`seg-btn ${settings.capitalOptions === v ? 'on' : ''}`}
                    onClick={() => onChange({ capitalOptions: v })}
                  >
                    {v === 0 ? 'Spell' : v}
                  </button>
                ))}
              </div>
            </section>

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

        {/* Shared: the filters that define the active country set */}
        <section className="set-group">
          <label className="set-label">
            Regions{' '}
            <span className="muted small">
              {isGuess ? '(scopes the quiz)' : '(highlights the map)'}
            </span>
          </label>
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

        <div className="playable-count">
          {playableCount} countries active{isGuess ? ' in this quiz' : ' on the map'}
        </div>
      </div>
    </div>
  )
}
