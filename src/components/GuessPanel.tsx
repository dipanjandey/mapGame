import { useMemo, useState, useEffect } from 'react'
import type { Country, ModeSettings } from '../lib/types'
import { buildCountryOptions, buildCapitalOptions } from '../lib/distractors'
import QuestionBlock, { type QuestionResult } from './QuestionBlock'

interface GuessPanelProps {
  target: Country
  pool: Country[]
  settings: ModeSettings
  /** prompted = country hidden, ask name; pick = user already clicked it. */
  prompted: boolean
  onRoundComplete: (correct: boolean) => void
  onNext: () => void
}

export default function GuessPanel({
  target,
  pool,
  settings,
  prompted,
  onRoundComplete,
  onNext,
}: GuessPanelProps) {
  // Build options once per target.
  const countryOptions = useMemo(
    () =>
      settings.countryOptions === 0
        ? []
        : buildCountryOptions(
            target,
            pool,
            settings.difficulty,
            settings.countryOptions,
          ).map((c) => c.name),
    [target, pool, settings.countryOptions, settings.difficulty],
  )

  const capitalOptions = useMemo(
    () =>
      settings.capitalOptions === 0
        ? []
        : buildCapitalOptions(
            target,
            pool,
            settings.difficulty,
            settings.capitalOptions,
          ),
    [target, pool, settings.capitalOptions, settings.difficulty],
  )

  const [nameRes, setNameRes] = useState<QuestionResult | null>(null)
  const [capRes, setCapRes] = useState<QuestionResult | null>(null)
  const [scored, setScored] = useState(false)

  useEffect(() => {
    setNameRes(null)
    setCapRes(null)
    setScored(false)
  }, [target])

  const bothDone = nameRes != null && capRes != null

  useEffect(() => {
    if (bothDone && !scored) {
      setScored(true)
      onRoundComplete(!!nameRes?.correct && !!capRes?.correct)
    }
  }, [bothDone, scored, nameRes, capRes, onRoundComplete])

  return (
    <div className="guess">
      <div className="guess-head">
        <span className="guess-mode-tag">{prompted ? 'Identify this country' : 'You picked'}</span>
        {!prompted && (
          <span className="guess-picked-flag" aria-hidden>
            {target.flagEmoji}
          </span>
        )}
      </div>

      <QuestionBlock
        key={`name-${target.cca3}`}
        label="Country name"
        answer={target.name}
        aliases={target.nameAliases}
        options={countryOptions}
        onCommit={setNameRes}
        autoFocus
      />

      <QuestionBlock
        key={`cap-${target.cca3}`}
        label={`Capital of ${prompted && !nameRes ? '…' : target.name}`}
        answer={target.primaryCapital ?? ''}
        aliases={target.capitalAliases}
        options={capitalOptions}
        onCommit={setCapRes}
      />

      {bothDone && (
        <div className="reveal">
          <div className="reveal-flag">
            <img src={target.flagSvg} alt="" className="flag-sm" />
            <div>
              <strong>{target.name}</strong>
              <div className="muted">{target.officialName}</div>
            </div>
          </div>
          {target.capital.length > 1 && (
            <div className="reveal-caps">
              Capitals:{' '}
              {target.capital.map((c) => `${c.name} (${c.type ?? '—'})`).join(', ')}
            </div>
          )}
          <button className="btn primary next-btn" onClick={onNext} autoFocus>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
