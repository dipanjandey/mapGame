import { useEffect, useMemo, useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps'
import topo110 from 'world-atlas/countries-110m.json'
import {
  byId,
  byCca3,
  markerCountries,
  smallCountries,
  regionPalette,
} from '../lib/countries'
import { PROJECTION, MAP_W, MAP_H, ANTARCTICA_ID } from '../lib/mapProjection'
import type { Country, GameMode } from '../lib/types'

// Ship the light 110m map; lazy-load the sharp 50m geometry once the user
// zooms in to inspect a country (the 110m shapes look coarse up close).
const LOW_RES = topo110 as unknown as object
const DETAIL_ZOOM = 2.2
// Below this zoom, small polygon countries get an invisible enlarged tap area.
const HELPER_ZOOM = 3

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
  /** Explore "reviewed" tracking: reviewed countries fade with a ✓. */
  reviewMode: boolean
  reviewedIds: Set<string>
  /** Hide reviewed countries (dim + non-interactive) to focus on the rest. */
  hideReviewed: boolean
  /** Use the colour-blind-friendly region palette. */
  cvdPalette: boolean
  position: Position
  onPositionChange: (p: Position) => void
}

const OUT_FILL = '#172033' // out-of-set: dimmed
const MASK_FILL = '#475569' // in-set but masked (prompted)
const TARGET_FILL = '#cbd5e1' // prompted: the country to identify
const STROKE = '#0f172a'
const HOVER_FILL = '#f8fafc' // clickable hover — the only near-white state now
const FOCUS = '#38bdf8' // selection / target outline + locator ring (accent, off the region palette)
const REVIEWED_DIM = 0.4 // reviewed countries fade so un-reviewed ones pop
const HIDDEN_DIM = 0.12 // reviewed countries when "hide reviewed" is on

export default function WorldMap({
  mode,
  onPick,
  playableIds,
  highlightCca3,
  selectedCca3,
  hoverName,
  hoverCapital,
  reviewMode,
  reviewedIds,
  hideReviewed,
  cvdPalette,
  position,
  onPositionChange,
}: WorldMapProps) {
  const [hover, setHover] = useState<{
    x: number
    y: number
    name: string
    capital: string | null
  } | null>(null)

  const palette = regionPalette(cvdPalette)

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
  // after a tap. Detect real hover capability and drop hover behaviour when
  // it's absent.
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
    const reviewed = reviewMode && reviewedIds.has(c.cca3)
    const hidden = reviewed && hideReviewed
    const focused = isTarget || isSelected

    // Selection / target are encoded by an outline + a locator ring (rendered
    // below), never a fill swap, so they can't collide with a region colour.
    // Reviewed countries keep their region colour but fade via opacity — except
    // the one currently open, which stays bright.
    let fill: string
    if (!inSet) fill = OUT_FILL
    else if (masked) fill = isTarget ? TARGET_FILL : MASK_FILL
    else fill = palette[c.region]

    const clickable = clickEnabled && inSet && !hidden
    const opacity = !inSet
      ? 0.4
      : hidden
        ? HIDDEN_DIM
        : reviewed && !focused
          ? REVIEWED_DIM
          : 1
    return { inSet, isTarget, isSelected, reviewed, hidden, focused, fill, clickable, opacity }
  }

  // The single "focused" country (open in explore/pick, or the prompted target)
  // gets a zoom-independent static crosshair so it's findable even at world zoom
  // (the cyan outline is the highlight; this just pinpoints it — no animation).
  const focusCca3 = highlightCca3 ?? selectedCca3
  const focusCountry = focusCca3 ? byCca3[focusCca3] : null
  const checkR = 4.6 / Math.sqrt(position.zoom)
  const helperR = 9 / Math.sqrt(position.zoom)
  const crossArm = 11 / Math.sqrt(position.zoom)
  const crossGap = 3.5 / Math.sqrt(position.zoom)
  const crossW = Math.max(0.8, 1.6 / Math.sqrt(position.zoom))

  // Hover tooltip only appears in explore mode, and only if at least one of the
  // hover-info toggles is on.
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
                const { inSet, focused, fill, clickable, opacity } = resolve(country)
                const defaultStyle = {
                  fill,
                  stroke: focused ? FOCUS : STROKE,
                  strokeWidth: focused ? 1.3 : 0.3,
                  strokeDasharray: country.disputed && inSet ? '2 1.5' : undefined,
                  outline: 'none',
                  opacity,
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
                      // fill can't get stuck after a tap. White is now used only
                      // for hover, so it reads unambiguously as "interactive".
                      hover: canHover
                        ? {
                            fill: clickable ? HOVER_FILL : fill,
                            stroke: clickable ? '#fff' : STROKE,
                            strokeWidth: clickable ? 0.6 : 0.3,
                            outline: 'none',
                            opacity: inSet ? 1 : 0.4,
                            cursor: clickable ? 'pointer' : 'default',
                          }
                        : defaultStyle,
                      pressed: {
                        fill: clickable ? HOVER_FILL : fill,
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
            const { inSet, focused, fill, clickable, opacity } = resolve(c)
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
                  stroke={focused ? FOCUS : '#0f172a'}
                  strokeWidth={focused ? 1.4 : 0.6}
                  opacity={opacity}
                />
              </Marker>
            )
          })}

          {/* Invisible enlarged tap areas for small polygon countries at low
              zoom, so they're forgiving to click/tap (no visual clutter). */}
          {clickEnabled &&
            position.zoom < HELPER_ZOOM &&
            smallCountries.map((c) => {
              const { clickable } = resolve(c)
              if (!clickable) return null
              return (
                <Marker
                  key={`hit-${c.cca3}`}
                  coordinates={[c.latlng[1], c.latlng[0]]}
                  onClick={() => onPick(c)}
                  onMouseEnter={(e) => enter(e, c)}
                  onMouseMove={move}
                  onMouseLeave={leave}
                  style={{ default: { cursor: 'pointer' } }}
                >
                  <circle r={helperR} fill="#000" fillOpacity={0} style={{ pointerEvents: 'all' }} />
                </Marker>
              )
            })}

          {/* Reviewed ✓ badges (explore review mode). The currently-open country
              shows the locator ring instead, so it's skipped here. */}
          {reviewMode &&
            !hideReviewed &&
            [...reviewedIds].map((id) => {
              const c = byCca3[id]
              if (!c || !playableIds.has(c.cca3) || c.cca3 === focusCca3) return null
              return (
                <Marker
                  key={`rev-${id}`}
                  coordinates={[c.latlng[1], c.latlng[0]]}
                  style={{ default: { pointerEvents: 'none' } }}
                >
                  <circle r={checkR} fill="#0b1220" opacity={0.55} />
                  <path
                    d={`M ${-0.42 * checkR} ${0.02 * checkR} L ${-0.1 * checkR} ${0.32 * checkR} L ${0.46 * checkR} ${-0.36 * checkR}`}
                    fill="none"
                    stroke={FOCUS}
                    strokeWidth={Math.max(0.5, checkR * 0.28)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Marker>
              )
            })}

          {/* Zoom-independent static crosshair pinpointing the focused / target
              country (the cyan outline carries the highlight; no animation). */}
          {focusCountry && (
            <Marker
              coordinates={[focusCountry.latlng[1], focusCountry.latlng[0]]}
              style={{ default: { pointerEvents: 'none' } }}
            >
              <line x1={-crossArm} y1={0} x2={-crossGap} y2={0} stroke={FOCUS} strokeWidth={crossW} strokeLinecap="round" />
              <line x1={crossGap} y1={0} x2={crossArm} y2={0} stroke={FOCUS} strokeWidth={crossW} strokeLinecap="round" />
              <line x1={0} y1={-crossArm} x2={0} y2={-crossGap} stroke={FOCUS} strokeWidth={crossW} strokeLinecap="round" />
              <line x1={0} y1={crossGap} x2={0} y2={crossArm} stroke={FOCUS} strokeWidth={crossW} strokeLinecap="round" />
            </Marker>
          )}
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
