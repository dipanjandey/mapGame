import { useCallback, useEffect, useMemo, useState } from 'react'
import WorldMap from './components/WorldMap'
import DetailsPanel from './components/DetailsPanel'
import GuessPanel from './components/GuessPanel'
import SettingsPanel from './components/SettingsPanel'
import { usePersisted } from './lib/usePersisted'
import { playableSet } from './lib/playable'
import { pickRandom } from './lib/distractors'
import { HOME_CENTER } from './lib/mapProjection'
import type { AppSettings, Country, GameMode, ModeSettings, Stats } from './lib/types'

const baseMode: ModeSettings = {
  countryOptions: 4,
  capitalOptions: 4,
  difficulty: 'medium',
  regions: [],
  subregion: null,
  includeDisputed: true,
  tier1Only: false,
  hoverName: true,
  hoverCapital: true,
  markReviewed: false,
}

const DEFAULT_SETTINGS: AppSettings = {
  mode: 'explore',
  perMode: {
    explore: { ...baseMode },
    'guess-prompted': { ...baseMode },
    'guess-pick': { ...baseMode },
  },
}

const DEFAULT_STATS: Stats = {
  score: 0,
  streak: 0,
  bestStreak: 0,
  totalAnswered: 0,
  totalCorrect: 0,
}

const HOME = { coordinates: HOME_CENTER, zoom: 1 }

export default function App() {
  const [settings, setSettings] = usePersisted<AppSettings>(
    'wgt.settings.v2',
    DEFAULT_SETTINGS,
  )
  const [stats, setStats] = usePersisted<Stats>('wgt.stats', DEFAULT_STATS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [position, setPosition] = useState(HOME)

  const [selected, setSelected] = useState<Country | null>(null) // explore details
  const [target, setTarget] = useState<Country | null>(null) // active guess target
  // Reviewed countries (explore "mark reviewed" mode). In-memory only — by
  // design this does not persist across sessions.
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())

  const mode = settings.mode
  // Spread over baseMode so settings persisted before a field existed (e.g.
  // hoverName/hoverCapital) fall back to their defaults instead of undefined.
  const active = useMemo(
    () => ({ ...baseMode, ...settings.perMode[mode] }),
    [settings.perMode, mode],
  )

  const pool = useMemo(() => playableSet(active), [active])
  const playableIds = useMemo(() => new Set(pool.map((c) => c.cca3)), [pool])

  const setMode = useCallback(
    (m: GameMode) => setSettings((s) => ({ ...s, mode: m })),
    [setSettings],
  )

  const patchActive = useCallback(
    (patch: Partial<ModeSettings>) =>
      setSettings((s) => ({
        ...s,
        perMode: { ...s.perMode, [s.mode]: { ...s.perMode[s.mode], ...patch } },
      })),
    [setSettings],
  )

  const zoomBy = useCallback((factor: number) => {
    setPosition((p) => ({
      ...p,
      zoom: Math.min(20, Math.max(1, +(p.zoom * factor).toFixed(3))),
    }))
  }, [])

  const zoomToCountry = useCallback((c: Country) => {
    setPosition({
      coordinates: [c.latlng[1], c.latlng[0]],
      zoom: c.microstate || c.needsMarker ? 8 : c.area < 60000 ? 5 : 3,
    })
  }, [])

  const nextPrompted = useCallback(() => {
    if (pool.length === 0) {
      setTarget(null)
      return
    }
    const next = pickRandom(pool)
    setTarget(next)
    zoomToCountry(next)
  }, [pool, zoomToCountry])

  // Reset transient selection/target whenever mode or the active pool changes.
  useEffect(() => {
    setSelected(null)
    setTarget(null)
    setPosition(HOME)
    if (mode === 'guess-prompted' && pool.length > 0) {
      const next = pickRandom(pool)
      setTarget(next)
      zoomToCountry(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pool])

  const handlePick = useCallback(
    (c: Country) => {
      // WorldMap only fires onPick for in-set, clickable countries.
      if (mode === 'explore') {
        if (active.markReviewed) {
          // Toggle reviewed (white). Mark + open details; un-mark + close.
          const isReviewed = reviewed.has(c.cca3)
          setReviewed((prev) => {
            const next = new Set(prev)
            if (isReviewed) next.delete(c.cca3)
            else next.add(c.cca3)
            return next
          })
          setSelected(isReviewed ? null : c)
        } else {
          // Keep the current map view; selecting only changes the highlight.
          setSelected(c)
        }
      } else if (mode === 'guess-pick') {
        setTarget(c)
      }
    },
    [mode, active.markReviewed, reviewed],
  )

  const clearReviewed = useCallback(() => setReviewed(new Set()), [])

  const onRoundComplete = useCallback(
    (correct: boolean) => {
      setStats((s) => {
        const streak = correct ? s.streak + 1 : 0
        return {
          score: s.score + (correct ? 10 + Math.min(s.streak, 10) : 0),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          totalAnswered: s.totalAnswered + 1,
          totalCorrect: s.totalCorrect + (correct ? 1 : 0),
        }
      })
    },
    [setStats],
  )

  const onNext = useCallback(() => {
    if (mode === 'guess-prompted') nextPrompted()
    else {
      setTarget(null)
      setPosition(HOME)
    }
  }, [mode, nextPrompted])

  const accuracy =
    stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0

  const showSidePanel = mode === 'explore' ? !!selected : !!target

  const modePill =
    mode === 'explore'
      ? 'Explore'
      : mode === 'guess-pick'
        ? 'Guess · pick'
        : 'Guess · prompted'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="globe" aria-hidden>
            🌍
          </span>
          <span className="brand-name">World Geography Trainer</span>
        </div>

        {mode !== 'explore' && (
          <div className="scoreboard">
            <div className="stat">
              <span className="stat-val">{stats.score}</span>
              <span className="stat-lab">score</span>
            </div>
            <div className="stat">
              <span className="stat-val">
                {stats.streak}
                {stats.streak >= 3 && ' 🔥'}
              </span>
              <span className="stat-lab">streak</span>
            </div>
            <div className="stat">
              <span className="stat-val">{accuracy}%</span>
              <span className="stat-lab">accuracy</span>
            </div>
          </div>
        )}

        <div className="topbar-actions">
          <span className="mode-pill">{modePill}</span>
          <div className="zoom-group" role="group" aria-label="Zoom">
            <button
              className="icon-btn"
              onClick={() => zoomBy(1 / 1.5)}
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <button
              className="icon-btn"
              onClick={() => zoomBy(1.5)}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
          </div>
          <button className="btn" onClick={() => setPosition(HOME)}>
            Reset view
          </button>
          <button className="btn primary" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </button>
        </div>
      </header>

      <main className="layout">
        <div className={`map-col${showSidePanel ? ' panel-open' : ''}`}>
          <WorldMap
            mode={mode}
            onPick={handlePick}
            playableIds={playableIds}
            highlightCca3={mode === 'guess-prompted' ? target?.cca3 : null}
            selectedCca3={
              mode === 'explore' ? selected?.cca3 : mode === 'guess-pick' ? target?.cca3 : null
            }
            hoverName={active.hoverName}
            hoverCapital={active.hoverCapital}
            reviewMode={mode === 'explore' && active.markReviewed}
            reviewedIds={reviewed}
            position={position}
            onPositionChange={setPosition}
          />

          <div className="map-hint">
            {mode === 'explore'
              ? active.regions.length || active.subregion
                ? 'Highlighted countries match your filter — click any to study it.'
                : 'Click any country or dot to study it.'
              : mode === 'guess-prompted'
                ? 'The white-outlined country is the target — name it and its capital.'
                : 'Click any highlighted country or dot, then name it and its capital.'}
          </div>
        </div>

        {showSidePanel && (
          <aside className="side">
            {mode === 'explore' && selected && (
              <DetailsPanel country={selected} onClose={() => setSelected(null)} />
            )}
            {mode !== 'explore' && target && (
              <GuessPanel
                key={target.cca3 + mode}
                target={target}
                pool={pool}
                settings={active}
                prompted={mode === 'guess-prompted'}
                onRoundComplete={onRoundComplete}
                onNext={onNext}
              />
            )}
          </aside>
        )}
      </main>

      {mode === 'guess-prompted' && pool.length === 0 && (
        <div className="empty-banner">
          No countries match your filters. Open Settings to widen the set.
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          mode={mode}
          settings={active}
          onChangeMode={setMode}
          onChange={patchActive}
          playableCount={pool.length}
          reviewedCount={reviewed.size}
          onClearReviewed={clearReviewed}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
