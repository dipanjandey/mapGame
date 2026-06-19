import type { Country, Difficulty } from './types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Build a distractor pool scoped by difficulty, falling back up a level
 * (subregion -> region -> global) when the pool is too small.
 *
 *  easy   -> any country
 *  medium -> same region
 *  hard   -> same subregion
 */
function scopedPool(
  target: Country,
  all: Country[],
  difficulty: Difficulty,
  needed: number,
): Country[] {
  const others = all.filter((c) => c.cca3 !== target.cca3)

  const levels: Country[][] =
    difficulty === 'hard'
      ? [
          others.filter((c) => c.subregion === target.subregion),
          others.filter((c) => c.region === target.region),
          others,
        ]
      : difficulty === 'medium'
        ? [others.filter((c) => c.region === target.region), others]
        : [others]

  for (const level of levels) {
    if (level.length >= needed) return level
  }
  return others // last resort: everything we have
}

/** Country-name multiple-choice options (target + distractors), shuffled. */
export function buildCountryOptions(
  target: Country,
  pool: Country[],
  difficulty: Difficulty,
  optionCount: number,
): Country[] {
  const needed = optionCount - 1
  const source = scopedPool(target, pool, difficulty, needed)
  const distractors = shuffle(source).slice(0, needed)
  return shuffle([target, ...distractors])
}

/**
 * Capital-name multiple-choice options. Pulls other countries' primaryCapital,
 * deduped, with the same difficulty-scoped fallback logic.
 */
export function buildCapitalOptions(
  target: Country,
  pool: Country[],
  difficulty: Difficulty,
  optionCount: number,
): string[] {
  const answer = target.primaryCapital
  if (!answer) return []
  const needed = optionCount - 1
  const source = scopedPool(target, pool, difficulty, needed)

  const seen = new Set([answer.toLowerCase()])
  const distractors: string[] = []
  for (const c of shuffle(source)) {
    const cap = c.primaryCapital
    if (!cap) continue
    const key = cap.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    distractors.push(cap)
    if (distractors.length >= needed) break
  }

  return shuffle([answer, ...distractors])
}
