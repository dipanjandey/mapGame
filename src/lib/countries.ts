import raw from '../data/countries.json'
import type { Country, Region } from './types'

export const countries = raw as unknown as Country[]

/** The join: map numeric id (ccn3) -> country record. Kosovo (id null) excluded. */
export const byId: Record<string, Country> = Object.fromEntries(
  countries.filter((c) => c.id != null).map((c) => [c.id as string, c]),
)

export const byCca3: Record<string, Country> = Object.fromEntries(
  countries.map((c) => [c.cca3, c]),
)

export const REGIONS: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']

export const REGION_COLORS: Record<Region, string> = {
  Africa: '#f59e0b',
  Americas: '#ef4444',
  Asia: '#8b5cf6',
  Europe: '#3b82f6',
  Oceania: '#10b981',
}

/**
 * Colour-blind-friendly region palette (Okabe–Ito), opt-in via Settings. Chosen
 * so the five regions stay distinguishable under deuteranopia/protanopia, where
 * the default red (Americas) vs orange (Africa) collapse together.
 */
export const REGION_COLORS_CVD: Record<Region, string> = {
  Africa: '#e69f00', // orange
  Americas: '#d55e00', // vermillion
  Asia: '#cc79a7', // reddish purple
  Europe: '#0072b2', // blue
  Oceania: '#009e73', // bluish green
}

export const regionPalette = (cvd: boolean) =>
  cvd ? REGION_COLORS_CVD : REGION_COLORS

/**
 * Small polygon countries (not already marker dots) that are fiddly to tap at
 * low zoom — used to render optional click-helper dots in the interactive modes.
 */
export const smallCountries = countries.filter(
  (c) => !c.needsMarker && c.id != null && c.area > 0 && c.area < 30000,
)

/** Subregions grouped by region, for the settings drill-down. */
export const subregionsByRegion: Record<Region, string[]> = (() => {
  const map: Record<string, Set<string>> = {}
  for (const c of countries) {
    ;(map[c.region] ??= new Set()).add(c.subregion)
  }
  return Object.fromEntries(
    REGIONS.map((r) => [r, [...(map[r] ?? [])].sort()]),
  ) as Record<Region, string[]>
})()

/** Countries rendered as clickable marker dots rather than polygons. */
export const markerCountries = countries.filter((c) => c.needsMarker)
