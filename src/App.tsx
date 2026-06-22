import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GlobeHemisphereWest,
  Plus,
  Minus,
  ArrowsCounterClockwise,
  GearSix,
  Fire,
} from '@phosphor-icons/react'
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
  hideReviewed: false,
  fillBlanks: false,
  revealPercent: 40,
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

const ROUND_SIZE = 10 // questions per "round" before the summary pops

const MODE_TABS: { id: GameMode; label: string; title: string }[] = [
  { id: 'explore', label: 'Explore', title: 'Explore — study countries on the map' },
  { id: 'guess-pick', label: 'Pick', title: 'Guess · pick a country on the map, then name it' },
  {
    id: 'guess-prompted',
    label: 'Prompted',
    title: 'Guess · a country is highlighted — name it and its capital',
  },
]

// Narrow viewports letterbox the wide map into a thin strip; start a touch more
// zoomed-in there so countries are big enough to read and tap (see "Reset view").
const isNarrowViewport = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(max-width: 820px)').matches

const homeFor = (narrow: boolean) => ({
  coordinates: HOME_CENTER,
  zoom: narrow ? 1.6 : 1,
})

// Approximate a ZoomableGroup position that frames a set of countries (from
// their centroids) — used to auto-fit Explore to a region/subregion filter.
// "Reset view" returns to the world home.
function fitToCountries(list: Country[]) {
  if (list.length === 0) return null
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180
  for (const c of list) {
    const [lat, lng] = c.latlng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  const spanLng = Math.max(maxLng - minLng, 1)
  const spanLat = Math.max(maxLat - minLat, 1)
  const zoom = Math.min(7, Math.max(1.3, Math.min(360 / spanLng, 145 / spanLat) * 0.85))
  return {
    coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number],
    zoom: +zoom.toFixed(2),
  }
}

export default function App() {
  const [settings, setSettings] = usePersisted<AppSettings>(
    'wgt.settings.v2',
    DEFAULT_SETTINGS,
  )
  const [stats, setStats] = usePersisted<Stats>('wgt.stats', DEFAULT_STATS)
  // Reviewed set is persisted (stored as an array; used as a Set).
  const [reviewedList, setReviewedList] = usePersisted<string[]>('wgt.reviewed', [])
  const [cvdPalette, setCvdPalette] = usePersisted<boolean>('wgt.cvd', false)
  const [onboarded, setOnboarded] = usePersisted<boolean>('wgt.onboarded', false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [narrow] = useState(isNarrowViewport)
  const HOME = useMemo(() => homeFor(narrow), [narrow])
  const [position, setPosition] = useState(HOME)

  const [selected, setSelected] = useState<Country | null>(null) // explore details
  const [target, setTarget] = useState<Country | null>(null) // active guess target
  const reviewed = useMemo(() => new Set(reviewedList), [reviewedList])

  // Guess "round" tracking → an end-of-round summary every ROUND_SIZE questions.
  const [round, setRound] = useState({ n: 0, correct: 0 })
  const [summary, setSummary] = useState<{ n: number; correct: number } | null>(null)

  const mode = settings.mode
  // Spread over baseMode so settings persisted before a field existed fall back
  // to their defaults instead of undefined.
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

  const resetMode = useCallback(
    () =>
      setSettings((s) => ({
        ...s,
        perMode: { ...s.perMode, [s.mode]: { ...baseMode } },
      })),
    [setSettings],
  )

  const resetStats = useCallback(() => {
    setStats(DEFAULT_STATS)
    setRound({ n: 0, correct: 0 })
    setSummary(null)
  }, [setStats])

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

  // Reset transient selection/target when mode or the active pool changes; in
  // Explore, auto-fit the map to a region/subregion filter.
  useEffect(() => {
    setSelected(null)
    setTarget(null)
    setRound({ n: 0, correct: 0 })
    setSummary(null)
    if (mode === 'guess-prompted' && pool.length > 0) {
      const next = pickRandom(pool)
      setTarget(next)
      zoomToCountry(next)
    } else if (mode === 'explore' && (active.regions.length > 0 || active.subregion)) {
      setPosition(fitToCountries(pool) ?? HOME)
    } else {
      setPosition(HOME)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pool])

  // Pop the end-of-round summary once a block of answers completes.
  useEffect(() => {
    if (round.n >= ROUND_SIZE) {
      setSummary({ n: round.n, correct: round.correct })
      setRound({ n: 0, correct: 0 })
    }
  }, [round])

  const toggleReviewed = useCallback(
    (cca3: string) =>
      setReviewedList((prev) =>
        prev.includes(cca3) ? prev.filter((x) => x !== cca3) : [...prev, cca3],
      ),
    [setReviewedList],
  )

  const handlePick = useCallback(
    (c: Country) => {
      // Selecting only opens details now; "reviewed" is an explicit toggle in
      // the details panel, so a reviewed country can be re-opened freely.
      if (mode === 'explore') setSelected(c)
      else if (mode === 'guess-pick') setTarget(c)
    },
    [mode],
  )

  const jumpToCountry = useCallback(
    (c: Country) => {
      setMode('explore')
      setSelected(c)
      zoomToCountry(c)
      setSettingsOpen(false)
    },
    [setMode, zoomToCountry],
  )

  const clearReviewed = useCallback(() => setReviewedList([]), [setReviewedList])

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
      setRound((r) => ({ n: r.n + 1, correct: r.correct + (correct ? 1 : 0) }))
    },
    [setStats],
  )

  const onNext = useCallback(() => {
    if (mode === 'guess-prompted') nextPrompted()
    else {
      setTarget(null)
      setPosition(HOME)
    }
  }, [mode, nextPrompted, HOME])

  const dismissSummary = useCallback(() => {
    setSummary(null)
    onNext()
  }, [onNext])

  const accuracy =
    stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0

  const showSidePanel = mode === 'explore' ? !!selected : !!target
  const reviewMode = mode === 'explore' && active.markReviewed

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="globe" aria-hidden>
            <GlobeHemisphereWest size={22} weight="duotone" />
          </span>
          <span className="brand-name">World Geography Trainer</span>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Mode">
          {MODE_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mode === t.id}
              className={`mode-switch-btn ${mode === t.id ? 'on' : ''}`}
              onClick={() => setMode(t.id)}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="topbar-right">
          {mode !== 'explore' && (
            <div className="scoreboard">
              <div className="stat">
                <span className="stat-val">{stats.score}</span>
                <span className="stat-lab">score</span>
              </div>
              <div className="stat">
                <span className="stat-val">
                  {stats.streak}
                  {stats.streak >= 3 && (
                    <Fire className="flame" size={16} weight="fill" aria-hidden />
                  )}
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
            <div className="zoom-group" role="group" aria-label="Zoom">
              <button
                className="icon-btn"
                onClick={() => zoomBy(1 / 1.5)}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <Minus size={18} weight="bold" />
              </button>
              <button
                className="icon-btn"
                onClick={() => zoomBy(1.5)}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <Plus size={18} weight="bold" />
              </button>
            </div>
            <button className="btn" onClick={() => setPosition(HOME)}>
              <ArrowsCounterClockwise size={15} weight="bold" />
              Reset view
            </button>
            <button className="btn primary" onClick={() => setSettingsOpen(true)}>
              <GearSix size={16} weight="fill" />
              Settings
            </button>
          </div>
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
            reviewMode={reviewMode}
            reviewedIds={reviewed}
            hideReviewed={reviewMode && active.hideReviewed}
            cvdPalette={cvdPalette}
            position={position}
            onPositionChange={setPosition}
          />

          {reviewMode && (
            <div className="review-progress">
              Reviewed <strong>{reviewed.size}</strong> / {pool.length}
            </div>
          )}

          <div className="map-hint">
            {mode === 'explore'
              ? active.regions.length || active.subregion
                ? 'Highlighted countries match your filter — click any to study it.'
                : 'Click any country or dot to study it.'
              : mode === 'guess-prompted'
                ? 'The cross-marked country is the target — name it and its capital.'
                : 'Click any highlighted country or dot, then name it and its capital.'}
          </div>
        </div>

        {showSidePanel && (
          <aside className="side">
            {mode === 'explore' && selected && (
              <DetailsPanel
                country={selected}
                cvdPalette={cvdPalette}
                tracking={reviewMode}
                reviewed={reviewed.has(selected.cca3)}
                onToggleReviewed={() => toggleReviewed(selected.cca3)}
                onClose={() => setSelected(null)}
              />
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
          cvdPalette={cvdPalette}
          onToggleCvd={() => setCvdPalette((v) => !v)}
          onResetMode={resetMode}
          onResetStats={resetStats}
          onJumpToCountry={jumpToCountry}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {summary && (
        <div className="modal-overlay" onClick={dismissSummary}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Round complete</h2>
            <p className="round-score">
              {summary.correct} <span>/ {summary.n}</span>
            </p>
            <p className="muted">
              Streak {stats.streak} · best {stats.bestStreak} · {accuracy}% all-time
              accuracy
            </p>
            <button className="btn primary" onClick={dismissSummary} autoFocus>
              Keep going →
            </button>
          </div>
        </div>
      )}

      {!onboarded && (
        <div className="modal-overlay" onClick={() => setOnboarded(true)}>
          <div className="modal onboard" onClick={(e) => e.stopPropagation()}>
            <h2>
              <GlobeHemisphereWest
                className="modal-globe"
                size={24}
                weight="duotone"
              />
              World Geography Trainer
            </h2>
            <p className="muted">Three ways to play — switch any time from the top bar:</p>
            <ul className="onboard-list">
              <li>
                <strong>Explore</strong> — tap a country to study its capital, cities,
                flag &amp; trivia.
              </li>
              <li>
                <strong>Pick</strong> — tap a country on the map, then name it and its
                capital.
              </li>
              <li>
                <strong>Prompted</strong> — a country lights up; name it and its capital.
              </li>
            </ul>
            <p className="muted small onboard-foot">
              <GearSix className="gear" size={15} weight="fill" aria-hidden />
              Settings lets you filter by region, change answer formats, track what
              you've reviewed, and more.
            </p>
            <button
              className="btn primary"
              onClick={() => setOnboarded(true)}
              autoFocus
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
