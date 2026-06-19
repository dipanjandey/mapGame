# World Geography Trainer

A responsive React webapp to practice country names, capitals, locations, flags, and
trivia on an interactive world map. Built per [BUILD_NOTES.md](_instructions/BUILD_NOTES.md)
from the bundled `countries.json` (198 records). No backend.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle to dist/
npm run preview  # serve the production build
```

## Stack

- **Vite + React 18 + TypeScript**
- **react-simple-maps** + **world-atlas** (Natural Earth 110m TopoJSON)
- **fastest-levenshtein** for fuzzy answer matching
- Flags via `flagcdn.com` URLs; score/streak persisted to `localStorage`

## How it works

- **The join** — each `<Geography>` carries an ISO 3166-1 numeric `id` that equals the
  `id` field in `countries.json` (`src/lib/countries.ts` → `byId`). All 168 polygon
  countries join; the 9 unmatched Natural Earth shapes (Greenland, Antarctica, Puerto
  Rico, …) aren't in the dataset and render inert.
- **Marker layer** — the 30 `needsMarker` countries (microstates + small islands) plus
  Kosovo (`id: null`, absent from the 110m map) render as always-clickable dots above the
  polygons, regardless of zoom (`src/components/WorldMap.tsx`).
- **Zoom/pan** — `<ZoomableGroup>` with scroll/pinch zoom; prompted mode auto-zooms to the
  target country via its `latlng`.
- **Disputed territories** — Taiwan / Western Sahara / Kosovo carry a dashed border and are
  filtered by the "include disputed" setting.

### Modes, settings & map state

Settings are **per-mode** — each mode keeps its own config, so switching to Explore never
shows guess-only controls. The four filter fields (region / subregion / disputed / tier)
define the **active country set**, which is reflected on the map in every mode: active
countries are full-color and interactive, filtered-out ones are dimmed and inert. Mode then
decides hover/colour behaviour:

| | Explore | Guess · prompted | Guess · pick |
| --- | --- | --- | --- |
| Option/difficulty settings | hidden (N/A) | shown | shown |
| Hover reveals name | yes | **no** (spoiler) | **no** (spoiler) |
| Polygon colour | region colour | masked grey | region colour |
| Click target | in-set → details | disabled | in-set → quiz |
| Region filter effect | highlights map | scopes quiz pool | scopes pick pool |

- **Explore** — study mode: click any active country → details panel (flag, all capitals
  w/ types & populations, major cities, region, 2 trivia lines).
- **Guess · prompted** — a random active country is highlighted (map masked so region isn't
  given away); name it + its capital.
- **Guess · pick on map** — click an active country/dot (names hidden on hover), then name
  it + its capital.

Each answer is multiple-choice (2–4 options) or free-text **spell** mode (0 options),
independently for country and capital.

### Answer checking (spell mode)

`src/lib/matching.ts` normalizes both sides (lowercase, strip diacritics, drop punctuation,
drop conservative filler words) then: exact alias match → correct; else Levenshtein within a
length-scaled tolerance → "close enough". Aliases bake in USA/America, UK/Britain,
Czechia/Czech Republic, Kyiv/Kiev, etc.

### Distractors

`src/lib/distractors.ts` scopes the wrong-answer pool by difficulty (easy = global,
medium = same region, hard = same subregion) and **falls back up a level** when a pool is
too small (e.g. "Australia and New Zealand" has 2 members).

## Deploy (Vercel)

Framework preset **Vite**, build `npm run build`, output `dist/`. `localStorage` works
normally on Vercel, so score/streak persist across sessions.

## Regenerating the data

Everything needed to rebuild `countries.json` lives in [`_instructions/`](_instructions/)
(not bundled into the app):

- `build-countries.cjs` — the build script. Reads `world-countries`, `all-the-cities`,
  `world-atlas` (npm devDeps) + `enrich.cjs` + `population.json`, and writes directly to
  `src/data/countries.json`.
- `enrich.cjs` — per-country `trivia` (5 each), `wikipedia` URLs, and the capital / alias /
  population overrides.
- `population.json` — country population input (keyed by name).
- `BUILD_NOTES.md` — the original build spec.

```bash
node _instructions/build-countries.cjs
```

Each record gets `trivia` (5 strings) and `wikipedia` (article URL) plus the usual fields.
