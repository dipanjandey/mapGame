# World Geography Trainer

A responsive React web app to practice country names, capitals, locations, flags, and
trivia on an interactive world map. Built from the bundled `countries.json` (198 records).
**No backend** — all state is client-side (`localStorage` + in-memory React state).
Deployed on Vercel from GitHub (`main` branch auto-deploys).

> This README is the handoff doc. It is meant to be complete enough to pick up new tasks
> in a fresh thread or with another agent. The original spec is
> [`_instructions/20260619/BUILD_NOTES.md`](_instructions/20260619/BUILD_NOTES.md).
>
> A 2026-06-20 gameplay/UX pass (top-bar mode switcher, zoom-independent locator crosshair,
> reviewed-tracking redesign, colour-blind palette, first-run onboarding, end-of-round
> summary, guess-question gating, skip/keyboard shortcuts, region auto-fit, country search)
> is documented in [`_instructions/20260620/UX_REVIEW.md`](_instructions/20260620/UX_REVIEW.md).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b + vite build -> dist/
npm run preview  # serve the production build
```

## Stack

- **Vite 5 + React 18 + TypeScript** (React 18 pinned for clean `react-simple-maps` v3 compatibility).
- **react-simple-maps** v3 + **world-atlas** (Natural Earth TopoJSON, 110m & 50m).
- **d3-geo** (`geoEqualEarth` + `fitExtent`) and **topojson-client** for the projection.
- **fastest-levenshtein** for fuzzy answer matching.
- Flags via `flagcdn.com` SVG URLs (not bundled).
- Custom CSS (no UI framework); dark theme; fully responsive.
- **puppeteer-core** (devDep) — drives the locally-installed system Chrome headless for
  visual/behavioral verification (see [Testing](#testing)). It is **not** shipped.

## Project structure

```text
src/
  main.tsx               app entry
  App.tsx                top-level state, mode orchestration, scoring, handlePick, zoom
  styles.css             all styles (single file, dark theme, responsive)
  components/
    WorldMap.tsx         map: join, region fill, markers, hover tooltip, review fill,
                         adaptive resolution, touch handling
    DetailsPanel.tsx     Explore details (flag, capitals, major cities, facts, trivia, wiki)
    GuessPanel.tsx       orchestrates the 2 questions (name + capital), picks answer format,
                         reveal block + Next, scoring callback
    QuestionBlock.tsx    a single question; renders mc | spell | blanks; handles commit
    SettingsPanel.tsx    the settings drawer (per-mode controls)
  lib/
    types.ts             Country, ModeSettings, AppSettings, Stats, enums
    countries.ts         data import, byId join, REGION_COLORS, subregions, markerCountries
    playable.ts          playableSet(settings) -> filtered Country[]
    matching.ts          normalize() + checkAnswer() (spell/blanks validation)
    distractors.ts       multiple-choice wrong-answer pools (difficulty-scoped, with fallback)
    blanks.ts            buildBlanks() layout + charMatches() (fill-in-the-blanks)
    mapProjection.ts     fitExtent geoEqualEarth, MAP_W/H, HOME_CENTER, ANTARCTICA_ID
    usePersisted.ts      useState backed by localStorage (safe if storage blocked)
  data/
    countries.json       the bundled dataset (198 records) — imported directly
    trivia-overrides.json  placeholder ({}), not yet wired in
_instructions/20260619/  data-generation tooling + original spec (NOT bundled)
```

## Data model

`countries.json` — 198 records: 195 UN states (193 members + Vatican + Palestine) plus
Taiwan, Kosovo, Western Sahara (`disputed: true`). Each record (see `Country` in
[`types.ts`](src/lib/types.ts)):

- `id` — ISO 3166-1 numeric (ccn3) string; **the join key to the map**. `null` for Kosovo.
- `cca2`, `cca3`, `name`, `officialName`
- `capital[]` (`{name, type?, population}`), `primaryCapital` (the single accepted answer)
- `majorCities[]` (top-2 non-capital), `population`, `area`, `latlng` `[lat, lng]`
- `region` (5 buckets), `subregion`
- `flagEmoji`, `flagSvg` (flagcdn URL)
- `trivia` — **array of 5 strings** (UI renders all of them; adding more will render too)
- `wikipedia` — article URL or `null`
- `nameAliases`, `capitalAliases` — accepted spellings (bake in USA/America, UK/Britain,
  Czechia/Czech Republic, Kyiv/Kiev, Astana/Nur-Sultan, …)
- `tier` (1 well-known … 3 obscure), `disputed`, `microstate`, `needsMarker`

### The map join (most important part)

`react-simple-maps` renders `world-atlas` TopoJSON; each `<Geography>` carries a numeric
`id` that **equals `countries.json.id`** (`byId` in [`countries.ts`](src/lib/countries.ts)).
All 168 polygon countries join. The ~9 unmatched Natural Earth shapes (Greenland,
Antarctica, Puerto Rico, …) aren't in the dataset and render inert.

- **Marker layer** — the 30 `needsMarker` countries (microstates + small islands) **plus
  Kosovo** (`id: null`, absent from the 110m map) render as always-clickable dots above
  the polygons, at any zoom ([`WorldMap.tsx`](src/components/WorldMap.tsx)).
- **Disputed** (Taiwan / Western Sahara / Kosovo) get a dashed border and are filtered by
  the "include disputed" setting.

## Modes, settings & map behaviour

There are **three modes** (`GameMode`): `explore`, `guess-prompted`, `guess-pick`.

Settings are **per-mode**: `AppSettings = { mode, perMode: Record<GameMode, ModeSettings> }`.
Each mode keeps its own `ModeSettings`, so switching modes never carries over irrelevant
config. The settings drawer only shows controls relevant to the current mode.

The four **filter fields** (`regions`, `subregion`, `includeDisputed`, `tier1Only`) define
the **active country set** (`playableSet()` in [`playable.ts`](src/lib/playable.ts)), which
is reflected on the map in **every** mode: active countries are full-colour and interactive;
filtered-out ones are dimmed (opacity 0.4) and inert. Mode then decides hover/colour:

| | Explore | Guess · prompted | Guess · pick |
| --- | --- | --- | --- |
| Answer-format / difficulty settings | hidden (N/A) | shown | shown |
| Hover reveals name/capital | yes (configurable) | **no** (spoiler) | **no** (spoiler) |
| Polygon colour | region colour | masked grey | region colour |
| Click target | toggle/details (see below) | disabled | in-set → quiz |
| Region filter effect | highlights map | scopes quiz pool | scopes pick pool |
| Auto-zoom on target | n/a (no recenter on select) | yes (zooms to target) | no |

- **Explore** — study mode. Click an active country → details panel. Selecting does **not**
  recenter/zoom the map (kept stable on purpose); it only changes the highlight.
- **Guess · prompted** — a random active country gets a light fill + a static locator
  crosshair and the map is masked grey (so region isn't given away); auto-zooms to it. Name
  it + its capital. The capital question is gated behind the country answer (no spoilers).
- **Guess · pick on map** — click an active country/dot (names hidden on hover), then name
  it + its capital.

### `ModeSettings` fields (defaults in `baseMode`, [`App.tsx`](src/App.tsx))

| field | type | default | applies to | meaning |
| --- | --- | --- | --- | --- |
| `countryOptions` | `0\|2\|3\|4` | 4 | guess | 0 = spell, 2-4 = MC count (country) |
| `capitalOptions` | `0\|2\|3\|4` | 4 | guess | same, for capital |
| `difficulty` | `easy\|medium\|hard` | medium | guess (MC) | distractor pool scope |
| `regions` | `Region[]` | `[]` (all) | all | multi-select region filter |
| `subregion` | `string\|null` | null | all | drill-down (overrides `regions`) |
| `includeDisputed` | bool | true | all | show/quiz the 3 disputed |
| `tier1Only` | bool | false | all | "common countries only" |
| `hoverName` | bool | true | explore | hover tooltip shows country name |
| `hoverCapital` | bool | true | explore | hover tooltip shows capital |
| `markReviewed` | bool | false | explore | enable reviewed tracking (mark via details panel) — see below |
| `hideReviewed` | bool | false | explore | hide reviewed countries to focus on what's left |
| `fillBlanks` | bool | false | guess | answer format: blanks vs MC/spell |
| `revealPercent` | number 0–80 | 40 | guess (blanks) | % of letters pre-revealed |

`active` is computed as `{ ...baseMode, ...perMode[mode] }` so settings persisted before a
field existed fall back to defaults (legacy-safe; no version bump needed for additive fields).

## Answer formats (guess modes)

Selected via the **Answer format** segmented toggle (Multiple choice / Fill in the blanks),
which drives `fillBlanks`. [`GuessPanel.tsx`](src/components/GuessPanel.tsx) resolves a
per-question `AnswerFormat` (`'mc' | 'spell' | 'blanks'`) and
[`QuestionBlock.tsx`](src/components/QuestionBlock.tsx) renders it:

- **Multiple choice** (`# options` 2–4) — distractors from
  [`distractors.ts`](src/lib/distractors.ts): easy = global, medium = same region, hard =
  same subregion, **falling back up a level** when a pool is too small (e.g. "Australia and
  New Zealand" has 2 members). Capital distractors pull other countries' `primaryCapital`.
- **Spell** (`# options` = 0) — free text, validated by `checkAnswer`.
- **Fill in the blanks** (`fillBlanks` on) — per-character boxes (OTP-style: auto-advance on
  type, backspace-to-previous, Enter to check). [`blanks.ts`](src/lib/blanks.ts)
  `buildBlanks(answer, revealPercent)` reveals letters **evenly spaced, deterministic,
  always leaving ≥1 blank** even at 80%; separators (space/hyphen/apostrophe) are shown,
  never blanked. On submit, each box turns green/red (`charMatches`, diacritic-insensitive).
  Validation still goes through `checkAnswer`, so "San José" accepts "Jose".

### Answer checking — `checkAnswer` ([`matching.ts`](src/lib/matching.ts))

`normalize()` lowercases, strips diacritics, drops punctuation, and drops a **conservative**
filler list (`the/of/and/republic/democratic/people(s)` — intentionally **not** `states`/
`kingdom`, which are load-bearing for US vs UK). Then: exact match vs normalized aliases →
correct; else Levenshtein within a length-scaled tolerance (≤1/≤2/≤3) → "close enough".

## Scoring

In `Stats` (`localStorage`): `score += correct ? 10 + min(streak, 10) : 0`, plus `streak`,
`bestStreak`, `totalAnswered`, `totalCorrect`, and derived accuracy. A round (name + capital)
counts correct only if **both** sub-answers are correct. The scoreboard is hidden in Explore.

## Map rendering specifics ([`WorldMap.tsx`](src/components/WorldMap.tsx) + [`mapProjection.ts`](src/lib/mapProjection.ts))

- **Projection** — `geoEqualEarth().fitExtent(...)` fitted to the **inhabited world**
  (Antarctica excluded) into an 800×380 viewBox. This removes empty ocean margins and frames
  the continents to fill the area. `HOME_CENTER` is the fitted centre; "Reset view" returns
  there.
- **Antarctica** is hidden (`id '010'` skipped in render **and** excluded from the fit).
- **Adaptive resolution** — ships light **110m** (~105 KB); lazily imports sharp **50m**
  (~754 KB, separate chunk) once `zoom >= DETAIL_ZOOM` (2.2) and keeps it. Keeps initial
  bundle light while giving accurate borders up close.
- **Zoom** — `<ZoomableGroup>` (scroll/pinch) + explicit **− / +** buttons in the top bar
  (`zoomBy`, ×1.5, clamped [1, 20]).
- **Flags** — rendered in a fixed **84×56** (details) / **48×32** (reveal) frame with
  `object-fit: contain`, so flags with non-3:2 aspect ratios (square CH/VA, tall Nepal,
  ultra-wide Qatar) display as uniform undistorted rectangles.
- **Touch handling** — `canHover` via `matchMedia('(hover: hover)')`. On touch devices the
  Geography hover style **falls back to the default** (otherwise rsm's internal hover sticks
  after a tap and a selected country gets stuck white); the hover tooltip is disabled too.

### Explore "track reviewed" mode (`markReviewed`)

Opt-in from the explore settings. Clicking a country just **opens its details** (with the
locator crosshair), so any country can be re-opened freely; the details panel carries a
**"Mark as reviewed"** toggle. Reviewed countries **fade (dimmed) and get a cyan ✓ badge**
so the un-reviewed ones stand out, and a **"Reviewed N / 198"** counter shows on the map.
The reviewed set is **persisted** (`wgt.reviewed`, stored as a `string[]`, used as a `Set`);
**"Clear reviewed (N)"** empties it. A **"Hide reviewed"** toggle (`hideReviewed`) removes
reviewed countries from view to focus on what's left. Selection/target are encoded by an
outline + the locator crosshair (never a fill swap), so nothing collides with the region colours.

## Persistence

`usePersisted` ([`usePersisted.ts`](src/lib/usePersisted.ts)) = `useState` mirrored to
`localStorage` (no-ops if storage is blocked). Keys:

- `wgt.settings.v2` — `AppSettings` (mode + per-mode settings).
- `wgt.stats` — `Stats` (score/streak/accuracy).
- `wgt.reviewed` — `string[]` of reviewed cca3 (explore tracking; used as a `Set`).
- `wgt.cvd` — colour-blind-friendly map palette on/off.
- `wgt.onboarded` — first-run welcome modal dismissed.

**In-memory only** (reset on reload): `selected`, `target`, map `position`, the current
guess `round`, `settingsOpen`.

## Responsive / mobile

Layout switches to stacked (map on top, panel below) at **≤820px**. On mobile the persistent
"click any country" map hint is hidden once a country is selected (`.map-col.panel-open`).
Touch hover handling as above.

## Testing

There is no unit-test runner wired up. Verification this far has been done two ways:

1. `npm run build` (tsc typecheck + production build) must pass.
2. **Headless-Chrome behavioural checks** via `puppeteer-core` against the running dev
   server, driving the system Chrome at
   `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Pattern: write a throwaway
   `.mjs`, launch with `executablePath`, dispatch DOM events / read computed styles, then
   delete it. (Used to verify the flag fix, hover-info toggle, touch hover, fill-in-the-blanks
   flow, reviewed mode, etc.) `page.emulateMediaFeatures` does **not** support `hover`; stub
   `window.matchMedia` via `evaluateOnNewDocument` to simulate touch.

## Deploy (Vercel)

Framework preset **Vite**, build `npm run build`, output `dist/`. `localStorage` works
normally on Vercel. Pushing to `main` triggers a redeploy.

## Regenerating the data

Tooling lives in [`_instructions/20260619/`](_instructions/20260619/) (not bundled).
Convention: instruction/spec/tooling drops go in a **date-named subfolder** (`YYYYMMDD`) so
the history is archived.

- `build-countries.cjs` — reads `world-countries`, `all-the-cities`, `world-atlas` (npm
  devDeps) + `enrich.cjs` + `population.json`, writes `src/data/countries.json`.
- `enrich.cjs` — per-country `trivia` (5 each), `wikipedia` URLs, capital/alias/population overrides.
- `population.json` — population input (keyed by name).
- `BUILD_NOTES.md` — original build spec.

```bash
node _instructions/20260619/build-countries.cjs   # run from repo root; relative paths resolve to that folder
```

## Known open threads / possible next tasks

- **User-editable notes** (per country) — discussed, deferred. Recommended path: start with
  `localStorage` via `usePersisted` (no backend), optionally add JSON export/import; only move
  to a managed BaaS (Supabase) if cross-device sync is wanted.
- `src/data/trivia-overrides.json` exists as an empty placeholder (`{}`) but is **not wired
  in** anywhere yet.
- Bundle size: the main JS chunk is >500 KB (Vite warns). Acceptable for now; the 50m map is
  already split into a lazy chunk.
