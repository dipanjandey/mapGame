import { useEffect, useMemo, useRef, useState } from 'react'
import { checkAnswer } from '../lib/matching'
import { buildBlanks, charMatches } from '../lib/blanks'

export interface QuestionResult {
  correct: boolean
  close: boolean
}

export type AnswerFormat = 'mc' | 'spell' | 'blanks'

interface QuestionBlockProps {
  label: string
  /** The canonical correct answer (shown on reveal). */
  answer: string
  /** Accepted aliases for fuzzy / exact matching (spell / blanks). */
  aliases: string[]
  /** Answer input format. */
  format: AnswerFormat
  /** Multiple-choice options (format='mc' only). */
  options: string[]
  /** % of letters pre-revealed (format='blanks' only). */
  revealPercent?: number
  /** Notify parent when this question is committed. */
  onCommit: (r: QuestionResult) => void
  autoFocus?: boolean
}

export default function QuestionBlock({
  label,
  answer,
  aliases,
  format,
  options,
  revealPercent = 0,
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

  // Fill-in-the-blanks layout + per-blank typed characters.
  const layout = useMemo(
    () => (format === 'blanks' ? buildBlanks(answer, revealPercent) : null),
    [format, answer, revealPercent],
  )
  const [typed, setTyped] = useState<string[]>([])
  const blankRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // reset when the question identity / format changes
    setCommitted(null)
    setText('')
    setTyped(layout ? Array(layout.blankCount).fill('') : [])
  }, [answer, label, layout])

  useEffect(() => {
    if (!autoFocus) return
    if (format === 'spell') inputRef.current?.focus()
    if (format === 'blanks') blankRefs.current[0]?.focus()
  }, [autoFocus, format, answer])

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

  const allFilled =
    !!layout && typed.length === layout.blankCount && typed.every((c) => c !== '')

  const submitBlanks = () => {
    if (committed || !layout || !allFilled) return
    const assembled = layout.tokens
      .map((t) => (t.revealed ? t.char : typed[t.blankIndex] || ''))
      .join('')
    const r = checkAnswer(assembled, aliases)
    commit(assembled, r.correct, r.close)
  }

  const onBlankChange = (bi: number, val: string) => {
    const ch = val.slice(-1)
    setTyped((prev) => {
      const next = [...prev]
      next[bi] = ch
      return next
    })
    if (ch) blankRefs.current[bi + 1]?.focus()
  }

  const onBlankKey = (bi: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitBlanks()
    } else if (e.key === 'Backspace' && !typed[bi]) {
      e.preventDefault()
      const prev = blankRefs.current[bi - 1]
      if (prev) {
        prev.focus()
        setTyped((p) => {
          const n = [...p]
          n[bi - 1] = ''
          return n
        })
      }
    }
  }

  return (
    <div className="qblock">
      <div className="qlabel">{label}</div>

      {format === 'spell' && (
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
      )}

      {format === 'blanks' && layout && (
        <div className="blanks">
          <div className="blank-word">
            {layout.tokens.map((t, i) => {
              if (!t.isLetter && t.char === ' ')
                return <span key={i} className="blank-space" aria-hidden />
              if (t.revealed)
                return (
                  <span key={i} className="blank-fixed">
                    {t.char}
                  </span>
                )
              const bi = t.blankIndex
              let cls = 'blank-box'
              if (committed)
                cls += charMatches(typed[bi] || '', t.char) ? ' ok' : ' no'
              return (
                <input
                  key={i}
                  ref={(el) => {
                    blankRefs.current[bi] = el
                  }}
                  className={cls}
                  maxLength={1}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={typed[bi] ?? ''}
                  disabled={!!committed}
                  onChange={(e) => onBlankChange(bi, e.target.value)}
                  onKeyDown={(e) => onBlankKey(bi, e)}
                />
              )
            })}
          </div>
          {!committed && (
            <button className="btn" onClick={submitBlanks} disabled={!allFilled}>
              Check
            </button>
          )}
        </div>
      )}

      {format === 'mc' && (
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
