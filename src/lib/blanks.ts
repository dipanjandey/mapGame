export interface BlankToken {
  char: string // the original character at this position
  isLetter: boolean // letters/digits count toward the reveal %; others are separators
  revealed: boolean // shown pre-filled (separators are always revealed)
  blankIndex: number // index among the editable blanks, or -1 if not a blank
}

export interface BlankLayout {
  tokens: BlankToken[]
  blankCount: number
}

const isLetterChar = (ch: string) => /\p{L}|\p{N}/u.test(ch)

/**
 * Build the fill-in-the-blanks layout for an answer string. `revealPercent`
 * (0..80) of the letter positions are pre-revealed, spread evenly and
 * deterministically. At least one letter always stays blank.
 */
export function buildBlanks(answer: string, revealPercent: number): BlankLayout {
  const chars = [...answer]
  const letterPositions = chars
    .map((ch, i) => (isLetterChar(ch) ? i : -1))
    .filter((i) => i >= 0)
  const total = letterPositions.length

  const pct = Math.max(0, Math.min(80, revealPercent))
  let revealCount = Math.round((pct / 100) * total)
  if (total > 0) revealCount = Math.min(revealCount, total - 1) // always ≥1 blank

  const revealSet = new Set<number>()
  if (revealCount > 0) {
    const stride = total / revealCount
    for (let k = 0; k < revealCount; k++) {
      revealSet.add(letterPositions[Math.min(total - 1, Math.floor(k * stride))])
    }
  }

  let blankIndex = 0
  const tokens: BlankToken[] = chars.map((ch, i) => {
    const isLetter = isLetterChar(ch)
    const revealed = !isLetter || revealSet.has(i)
    return {
      char: ch,
      isLetter,
      revealed,
      blankIndex: isLetter && !revealed ? blankIndex++ : -1,
    }
  })

  return { tokens, blankCount: blankIndex }
}

/** Diacritic-insensitive, case-insensitive single-character compare. */
export function charMatches(a: string, b: string): boolean {
  const norm = (c: string) =>
    c.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  return norm(a) === norm(b)
}
