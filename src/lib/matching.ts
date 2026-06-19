import { distance } from 'fastest-levenshtein'

// Keep this conservative: words like "states"/"kingdom" are load-bearing
// (United States vs United Kingdom), so they must NOT be stripped.
const FILLER = new Set([
  'the',
  'of',
  'and',
  'republic',
  'democratic',
  'people',
  'peoples',
])

/** lowercase, strip diacritics, drop punctuation, drop filler words. */
export function normalize(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation
    .replace(/\s+/g, ' ')
    .trim()

  const kept = base
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .join(' ')

  // If filler-stripping nuked everything (e.g. answer literally "The"), keep base.
  return kept || base
}

export interface MatchResult {
  correct: boolean
  close: boolean // matched via Levenshtein tolerance, not exact
  canonical: string | null // the alias that matched (original form)
}

/** Levenshtein tolerance that scales with word length. */
function tolerance(len: number): number {
  if (len <= 4) return 1
  if (len <= 8) return 2
  return 3
}

/**
 * Check a free-text guess against a list of accepted aliases.
 * 1. Exact match on normalized alias.
 * 2. Else Levenshtein <= tolerance(length).
 */
export function checkAnswer(guess: string, aliases: string[]): MatchResult {
  const g = normalize(guess)
  if (!g) return { correct: false, close: false, canonical: null }

  let best: { d: number; alias: string } | null = null

  for (const alias of aliases) {
    const a = normalize(alias)
    if (!a) continue
    if (a === g) return { correct: true, close: false, canonical: alias }
    const d = distance(g, a)
    if (!best || d < best.d) best = { d, alias }
  }

  if (best) {
    const tol = tolerance(Math.max(g.length, normalize(best.alias).length))
    if (best.d <= tol) return { correct: true, close: true, canonical: best.alias }
  }

  return { correct: false, close: false, canonical: null }
}
