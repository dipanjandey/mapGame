import { useMemo, useState, useEffect } from 'react'
import type { Country, ModeSettings } from '../lib/types'
import { buildCountryOptions, buildCapitalOptions } from '../lib/distractors'
import QuestionBlock, { type AnswerFormat, type QuestionResult } from './QuestionBlock'

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
  // Answer format per question: blanks overrides everything; else 0 -> spell,
  // 2..4 -> multiple choice.
  const countryFormat: AnswerFormat = settings.fillBlanks
    ? 'blanks'
    : settings.countryOptions === 0
      ? 'spell'
      : 'mc'
  const capitalFormat: AnswerFormat = settings.fillBlanks
    ? 'blanks'
    : settings.capitalOptions === 0
      ? 'spell'
      : 'mc'

  // Build multiple-choice options only when that format is actually used.
  const countryOptions = useMemo(
    () =>
      countryFormat !== 'mc'
        ? []
        : buildCountryOptions(
            target,
            pool,
            settings.difficulty,
            settings.countryOptions,
          ).map((c) => c.name),
    [countryFormat, target, pool, settings.countryOptions, settings.difficulty],
  )

  const capitalOptions = useMemo(
    () =>
      capitalFormat !== 'mc'
        ? []
        : buildCapitalOptions(
            target,
            pool,
            settings.difficulty,
            settings.capitalOptions,
          ),
    [capitalFormat, target, pool, settings.capitalOptions, settings.difficulty],
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
        key={`name-${target.cca3}-${countryFormat}-${settings.revealPercent}`}
        label="Country name"
        answer={target.name}
        aliases={target.nameAliases}
        format={countryFormat}
        options={countryOptions}
        revealPercent={settings.revealPercent}
        onCommit={setNameRes}
        autoFocus
      />

      <QuestionBlock
        key={`cap-${target.cca3}-${capitalFormat}-${settings.revealPercent}`}
        label={`Capital of ${prompted && !nameRes ? '…' : target.name}`}
        answer={target.primaryCapital ?? ''}
        aliases={target.capitalAliases}
        format={capitalFormat}
        options={capitalOptions}
        revealPercent={settings.revealPercent}
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
