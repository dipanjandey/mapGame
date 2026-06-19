import { useEffect, useRef, useState } from 'react'
import { checkAnswer } from '../lib/matching'

export interface QuestionResult {
  correct: boolean
  close: boolean
}

interface QuestionBlockProps {
  label: string
  /** The canonical correct answer (shown on reveal). */
  answer: string
  /** Accepted aliases for fuzzy / exact matching (spell mode). */
  aliases: string[]
  /** Multiple-choice options; empty => spell (free text) mode. */
  options: string[]
  /** Notify parent when this question is committed. */
  onCommit: (r: QuestionResult) => void
  autoFocus?: boolean
}

export default function QuestionBlock({
  label,
  answer,
  aliases,
  options,
  onCommit,
  autoFocus,
}: QuestionBlockProps) {
  const [committed, setCommitted] = useState<{
    value: string
    correct: boolean
    close: boolean
  } | null>(null)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // reset when the question identity changes
    setCommitted(null)
    setText('')
  }, [answer, label])

  useEffect(() => {
    if (autoFocus && options.length === 0) inputRef.current?.focus()
  }, [autoFocus, options.length, answer])

  const commit = (value: string, correct: boolean, close: boolean) => {
    if (committed) return
    setCommitted({ value, correct, close })
    onCommit({ correct, close })
  }

  const submitText = () => {
    if (committed || !text.trim()) return
    const r = checkAnswer(text, aliases)
    commit(text.trim(), r.correct, r.close)
  }

  const isSpell = options.length === 0

  return (
    <div className="qblock">
      <div className="qlabel">{label}</div>

      {isSpell ? (
        <div className="spell-row">
          <input
            ref={inputRef}
            className="spell-input"
            value={committed ? committed.value : text}
            disabled={!!committed}
            placeholder="Type your answer…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitText()}
          />
          {!committed && (
            <button className="btn" onClick={submitText} disabled={!text.trim()}>
              Check
            </button>
          )}
        </div>
      ) : (
        <div className="options">
          {options.map((opt) => {
            let cls = 'option'
            if (committed) {
              const isAnswer = opt === answer
              const isChosen = opt === committed.value
              if (isAnswer) cls += ' correct'
              else if (isChosen) cls += ' wrong'
              else cls += ' dim'
            }
            return (
              <button
                key={opt}
                className={cls}
                disabled={!!committed}
                onClick={() => commit(opt, opt === answer, false)}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {committed && (
        <div className={`verdict ${committed.correct ? 'ok' : 'no'}`}>
          {committed.correct
            ? committed.close
              ? `Close enough — it's "${answer}"`
              : 'Correct!'
            : `Answer: ${answer}`}
        </div>
      )}
    </div>
  )
}
