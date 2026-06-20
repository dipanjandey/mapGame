export interface Capital {
  name: string
  type?: string
  population: number | null
}

export interface City {
  name: string
  population: number
}

export interface Country {
  id: string | null // ISO 3166-1 numeric / ccn3 — join key to the map
  cca2: string
  cca3: string
  name: string
  officialName: string
  capital: Capital[]
  primaryCapital: string | null
  majorCities: City[]
  population: number
  region: Region
  subregion: string
  latlng: [number, number]
  area: number
  flagEmoji: string
  flagSvg: string
  trivia: string[] // durable facts (5 in the current dataset)
  wikipedia: string | null // URL to the Wikipedia article
  nameAliases: string[]
  capitalAliases: string[]
  tier: 1 | 2 | 3
  disputed: boolean
  microstate: boolean
  needsMarker: boolean
}

export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type OptionCount = 0 | 2 | 3 | 4

export type GameMode = 'guess-prompted' | 'guess-pick' | 'explore'

/**
 * Settings that belong to a single mode. Every mode has its own copy, so
 * switching modes never carries over irrelevant config. `countryOptions`,
 * `capitalOptions` and `difficulty` only apply to the guess modes; explore
 * ignores them. The four filter fields define the *active country set* and
 * apply (and are reflected on the map) in every mode.
 */
export interface ModeSettings {
  countryOptions: OptionCount
  capitalOptions: OptionCount
  difficulty: Difficulty
  regions: Region[] // empty = all regions
  subregion: string | null // when set, restricts within a region
  includeDisputed: boolean
  tier1Only: boolean
  // Explore-only: what the hover tooltip reveals. Both default on.
  hoverName: boolean
  hoverCapital: boolean
  // Explore-only: turn on "reviewed" tracking. Clicking a country opens it; the
  // details panel then has a "Mark reviewed" toggle. Reviewed countries fade
  // with a ✓ and a progress counter shows. The reviewed set is persisted.
  markReviewed: boolean
  // Explore-only (with tracking on): hide reviewed countries so only the ones
  // left to study stay interactive/visible.
  hideReviewed: boolean
  // Guess-only: use fill-in-the-blanks for both country & capital instead of
  // multiple choice / spelling. revealPercent (0=hard .. 80=very easy) sets
  // how many letters are pre-filled.
  fillBlanks: boolean
  revealPercent: number
}

export interface AppSettings {
  mode: GameMode
  perMode: Record<GameMode, ModeSettings>
}

export interface Stats {
  score: number
  streak: number
  bestStreak: number
  totalAnswered: number
  totalCorrect: number
}
