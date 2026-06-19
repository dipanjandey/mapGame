import { countries } from './countries'
import type { Country, ModeSettings } from './types'

/** The set of countries playable / quizzable under the current settings. */
export function playableSet(settings: ModeSettings): Country[] {
  return countries.filter((c) => {
    if (!settings.includeDisputed && c.disputed) return false
    if (settings.tier1Only && c.tier !== 1) return false
    if (settings.subregion) {
      if (c.subregion !== settings.subregion) return false
    } else if (settings.regions.length > 0) {
      if (!settings.regions.includes(c.region)) return false
    }
    // Need a name to quiz; capital may be absent (we then skip capital step).
    return true
  })
}
