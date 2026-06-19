import { geoEqualEarth } from 'd3-geo'
import { feature } from 'topojson-client'
import topo110 from 'world-atlas/countries-110m.json'

/**
 * A wide viewBox whose aspect roughly matches the inhabited world (no
 * Antarctica), so the framed map nearly fills a desktop map area.
 */
export const MAP_W = 800
export const MAP_H = 380

export const ANTARCTICA_ID = '010' // ISO 3166-1 numeric / ccn3

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fc: any = feature(topo110 as any, (topo110 as any).objects.countries)
const inhabited = {
  type: 'FeatureCollection',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  features: fc.features.filter((f: any) => String(f.id) !== ANTARCTICA_ID),
}

/**
 * Equal Earth projection pre-fitted to the inhabited world. fitExtent picks the
 * exact scale + translate that frames those landmasses inside the viewBox,
 * which removes the empty ocean margins (incl. the band Antarctica used to fill).
 */
export const PROJECTION = geoEqualEarth().fitExtent(
  [
    [4, 4],
    [MAP_W - 4, MAP_H - 4],
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inhabited as any,
)

// The geographic coordinate at the centre of the fitted frame — used as the
// default ZoomableGroup centre so "reset view" matches the fitted framing.
const c = PROJECTION.invert!([MAP_W / 2, MAP_H / 2]) as [number, number]
export const HOME_CENTER: [number, number] = [+c[0].toFixed(3), +c[1].toFixed(3)]
