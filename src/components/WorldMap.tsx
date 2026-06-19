import { useEffect, useMemo, useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps'
import topo110 from 'world-atlas/countries-110m.json'
import { byId, markerCountries, REGION_COLORS } from '../lib/countries'
import { PROJECTION, MAP_W, MAP_H, ANTARCTICA_ID } from '../lib/mapProjection'
import type { Country, GameMode } from '../lib/types'

// Ship the light 110m map; lazy-load the sharp 50m geometry once the user
// zooms in to inspect a country (the 110m shapes look coarse up close).
const LOW_RES = topo110 as unknown as object
const DETAIL_ZOOM = 2.2

interface Position {
  coordinates: [number, number]
  zoom: number
}

interface WorldMapProps {
  mode: GameMode
  onPick: (country: Country) => void
  /** cca3 of every country in the active set (filters applied). */
  playableIds: Set<string>
  /** cca3 of the country to highlight (prompted guess target). */
  highlightCca3?: string | null
  /** cca3 of the currently selected country (explore / pick). */
  selectedCca3?: string | null
  /** Explore hover tooltip: show the country name / capital. */
  hoverName: boolean
  hoverCapital: boolean
  position: Position
  onPositionChange: (p: Position) => void
}

const OUT_FILL = '#172033' // out-of-set: dimmed
const MASK_FILL = '#475569' // in-set but masked (prompted)
const STROKE = '#0f172a'

export default function WorldMap({
  mode,
  onPick,
  playableIds,
  highlightCca3,
  selectedCca3,
  hoverName,
  hoverCapital,
  position,
  onPositionChange,
}: WorldMapProps) {
  const [hover, setHover] = useState<{
    x: number
    y: number
    name: string
    capital: string | null
  } | null>(null)

  // Adaptive resolution: start with 110m, upgrade to 50m (and keep it) once
  // the user zooms past the threshold so country shapes stay accurate up close.
  const [geoData, setGeoData] = useState<object>(LOW_RES)
  const [hiResLoaded, setHiResLoaded] = useState(false)
  useEffect(() => {
    if (!hiResLoaded && position.zoom >= DETAIL_ZOOM) {
      setHiResLoaded(true)
      import('world-atlas/countries-50m.json')
        .then((m) => setGeoData(m.default as unknown as object))
        .catch(() => setHiResLoaded(false))
    }
  }, [position.zoom, hiResLoaded])

  // Touch devices can't fire mouseleave, so rsm's internal hover state sticks
  // after a tap (the tapped country keeps the white hover fill, masking its
  // selected colour). Detect real hover capability and drop hover behaviour
  // entirely when it's absent.
  const canHover = useMemo(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia ||
      window.matchMedia('(hover: hover)').matches,
    [],
  )

  // Mode-derived behaviour (see the dependency table in the README).
  const masked = mode === 'guess-prompted'
  const showNames = mode === 'explore'
  const clickEnabled = mode !== 'guess-prompted'

  /** Resolve the visual + interaction state for a country. */
  const resolve = (c: Country) => {
    const inSet = playableIds.has(c.cca3)
    const isTarget = c.cca3 === highlightCca3
    const isSelected = c.cca3 === selectedCca3

    let fill: string
    if (!inSet) fill = OUT_FILL
    else if (isSelected) fill = '#fbbf24'
    else if (masked) fill = isTarget ? '#cbd5e1' : MASK_FILL
    else fill = REGION_COLORS[c.region]

    const clickable = clickEnabled && inSet
    return { inSet, isTarget, isSelected, fill, clickable }
  }

  // Hover tooltip only appears in explore mode, and only if at least one of
  // the hover-info toggles is on.
  const hoverEnabled = canHover && showNames && (hoverName || hoverCapital)
  const enter = (e: { clientX: number; clientY: number }, c: Country) => {
    if (hoverEnabled)
      setHover({ x: e.clientX, y: e.clientY, name: c.name, capital: c.primaryCapital })
  }
  const move = (e: { clientX: number; clientY: number }) =>
    setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
  const leave = () => setHover(null)

  return (
    <div className="map-wrap">
      <ComposableMap
        width={MAP_W}
        height={MAP_H}
        projection={PROJECTION as never}
        className="map-svg"
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1}
          maxZoom={20}
          onMoveEnd={(p) => onPositionChange(p as Position)}
        >
          <Geographies geography={geoData}>
            {({ geographies }) =>
              geographies.map((geo) => {
                if (String(geo.id) === ANTARCTICA_ID) return null // hidden per design
                const country = byId[geo.id as string]
                if (!country) {
                  // Territory not in our dataset (Greenland, Antarctica, …): inert.
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: { fill: OUT_FILL, stroke: STROKE, strokeWidth: 0.3, outline: 'none', opacity: 0.6 },
                        hover: { fill: OUT_FILL, outline: 'none' },
                        pressed: { fill: OUT_FILL, outline: 'none' },
                      }}
                    />
                  )
                }
                const { inSet, isTarget, isSelected, fill, clickable } = resolve(country)
                const defaultStyle = {
                  fill,
                  stroke: isTarget ? '#fff' : STROKE,
                  strokeWidth: isTarget ? 1.3 : 0.3,
                  strokeDasharray: country.disputed && inSet ? '2 1.5' : undefined,
                  outline: 'none',
                  opacity: inSet ? 1 : 0.4,
                  transition: 'fill 120ms, opacity 120ms',
                }
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => clickable && onPick(country)}
                    onMouseEnter={(e) => inSet && enter(e, country)}
                    onMouseMove={move}
                    onMouseLeave={leave}
                    style={{
                      default: defaultStyle,
                      // On touch, fall back to the default style so the hover
                      // fill can't get stuck after a tap.
                      hover: canHover
                        ? {
                            fill: clickable ? (masked ? '#94a3b8' : '#f8fafc') : fill,
                            stroke: isTarget ? '#fff' : clickable ? '#fff' : STROKE,
                            strokeWidth: clickable ? 0.5 : 0.3,
                            outline: 'none',
                            opacity: inSet ? 1 : 0.4,
                            cursor: clickable ? 'pointer' : 'default',
                          }
                        : defaultStyle,
                      pressed: {
                        fill: isSelected || clickable ? '#fbbf24' : fill,
                        outline: 'none',
                      },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {/* Marker layer: the 30 needsMarker countries (+ Kosovo). Always on top. */}
          {markerCountries.map((c) => {
            const { inSet, isTarget, isSelected, fill, clickable } = resolve(c)
            const r = Math.max(2.5, 4 / Math.sqrt(position.zoom))
            return (
              <Marker
                key={c.cca3}
                coordinates={[c.latlng[1], c.latlng[0]]}
                onClick={() => clickable && onPick(c)}
                onMouseEnter={(e) => inSet && enter(e, c)}
                onMouseMove={move}
                onMouseLeave={leave}
                style={{ default: { cursor: clickable ? 'pointer' : 'default' } }}
              >
                <circle
                  r={r}
                  fill={inSet ? fill : OUT_FILL}
                  stroke={isTarget ? '#fff' : isSelected ? '#fff' : '#0f172a'}
                  strokeWidth={isTarget ? 1.4 : 0.6}
                  opacity={inSet ? 1 : 0.4}
                />
              </Marker>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>

      {hover && (
        <div className="map-tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {hoverName && <div className="tt-name">{hover.name}</div>}
          {hoverCapital && (
            <div className="tt-capital">{hover.capital ?? 'No capital'}</div>
          )}
        </div>
      )}
    </div>
  )
}
