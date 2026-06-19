# World Geography Trainer — Build Spec

A React webapp to practice country names, capitals, locations, flags, and trivia on an interactive world map. Hosted on GitHub → Vercel. This doc + `countries.json` are the complete starting point.

## Tech stack
- **Vite + React** (TypeScript recommended).
- **Map:** `react-simple-maps` (D3-geo + topojson under the hood) + `world-atlas` (Natural Earth TopoJSON).
- **Flags:** use the `flagSvg` URL (`flagcdn.com`) per record, or swap to the `flag-icons` npm package if you want them bundled offline.
- **Fuzzy matching:** `fastest-levenshtein` (or hand-rolled, it's tiny).
- No backend. `countries.json` is bundled and imported directly.

## Data: `countries.json`
198 records: 195 UN-recognized states (193 members + Vatican + Palestine) plus Taiwan, Kosovo, and Western Sahara flagged `disputed: true`. Each record:

```jsonc
{
  "id": "710",                  // ISO 3166-1 numeric. JOIN KEY to the map (see below). null for Kosovo.
  "cca2": "ZA", "cca3": "ZAF",
  "name": "South Africa",
  "officialName": "Republic of South Africa",
  "capital": [                  // array; multi-capital countries have >1 entry w/ type
    { "name": "Pretoria",   "type": "executive",   "population": 1619438 },
    { "name": "Cape Town",  "type": "legislative", "population": 3433441 },
    { "name": "Bloemfontein","type": "judicial",   "population": 463064 }
  ],
  "primaryCapital": "Pretoria", // THE single answer to accept in guess mode
  "majorCities": [              // top 2 largest NON-capital cities, w/ population
    { "name": "Durban",      "population": 3120282 },
    { "name": "Johannesburg","population": 2026469 }
  ],
  "population": 57779622,
  "region": "Africa",           // 5 buckets: Africa, Americas, Asia, Europe, Oceania
  "subregion": "Southern Africa",
  "latlng": [-29, 24],          // [lat, lng] — use for marker dots & zoom-to-country
  "area": 1221037,
  "flagEmoji": "🇿🇦",
  "flagSvg": "https://flagcdn.com/za.svg",
  "trivia": ["...", "..."],     // exactly 2 durable facts
  "nameAliases": ["South Africa", "RSA", ...],   // accepted answers in spell mode
  "capitalAliases": ["Pretoria", "Cape Town", ...],
  "tier": 1,                    // 1=well-known/large, 2=mid, 3=small/obscure (heuristic from pop+area)
  "disputed": false,
  "microstate": false,          // area < 1000 km²
  "needsMarker": false          // TRUE => render as clickable dot, not a polygon (see map section)
}
```

## The map and the join (most important part)
`react-simple-maps` renders `world-atlas/countries-110m.json` (or `50m` for detail). Each `<Geography>` carries a numeric `id` that **equals the `id` field in `countries.json`** (both are ISO 3166-1 numeric / ccn3). Verified: South Africa = `710` on both sides. So:

```jsx
const byId = Object.fromEntries(countries.map(c => [c.id, c]));
// inside <Geographies>:
geographies.map(geo => {
  const country = byId[geo.id];        // <-- the join
  return <Geography key={geo.rsmKey} geography={geo}
           onClick={() => country && handlePick(country)} />;
});
```

**Coverage gaps you must handle:**
- **30 countries need dots, not polygons** (`needsMarker: true`): all microstates and a few small islands. At 110m they're invisible/unclickable. Render them as a `<Marker>` layer using `latlng`, always clickable regardless of zoom. The list: AND, ATG, BHR, BRB, CPV, COM, DMA, GRD, KIR, UNK, LIE, MDV, MLT, MHL, MUS, FSM, MCO, NRU, PLW, KNA, LCA, VCT, WSM, SMR, STP, SYC, SGP, TON, TUV, VAT.
- **Kosovo (`UNK`) has `id: null`** and isn't in the 110m map at all — it's marker-only.
- **Disputed territories:** Taiwan (158) and Western Sahara (732) exist as polygons in Natural Earth; Kosovo does not. The `disputed` flag drives an include/exclude **setting** (see below) and a visual treatment (e.g., dashed border).

## Zoom (your question B — yes, fully supported)
Wrap the map in `<ZoomableGroup>` for pan + scroll/pinch zoom. Approach:
- Let users zoom into a region to see small-but-not-micro countries (Gulf states, Balkans, Luxembourg).
- Optionally swap `110m` → `50m` topojson above a zoom threshold for sharper borders (110m is fine zoomed out and much lighter).
- True microstates stay sub-pixel even zoomed — that's why the **marker dots** are the reliable interaction for those 30. Keep markers in a layer above the polygons so they're always tappable.
- Add a "zoom to country" helper that centers on `latlng` — useful in guess mode when a microstate is the target.

## Game modes
**Mode A — Guess (country + capital).** Two sub-flows, both end in the same answer panel:
- *Pick-on-map:* user clicks a country/marker, then answers its name and capital.
- *Prompted:* the game highlights/zooms to a random country (filtered by current settings) and asks for name + capital.

Answer input depends on the **# options** setting:
- `0 options` → free-text spelling, validated by fuzzy match (below).
- `2–4 options` → multiple choice; distractors generated per difficulty (below).

Accept `primaryCapital` (and its `capitalAliases`) as the capital answer. For multi-capital countries you may optionally accept any entry in `capital[]` — recommend accepting all, showing the type on reveal.

**Mode B — Explore / Details.** Map with labels. Clicking a country opens a panel: flag, name, `capital[]` (with types + populations), `majorCities` (with populations), `population`, region/subregion, and the 2 `trivia` lines. This is the no-pressure study mode.

## Answer checking (spell mode)
Normalize both sides before comparing: lowercase, strip diacritics, drop punctuation, drop filler words (`the/of/republic/...`). Then:
1. Exact match against normalized `nameAliases` (or `capitalAliases`) → correct.
2. Else Levenshtein distance ≤ 2 (scale with word length) against the same list → accept as "close enough" (optionally show the canonical spelling).

`nameAliases`/`capitalAliases` already bake in the hard cases: USA/America, UK/Britain, Czechia/Czech Republic, Myanmar/Burma, Kyiv/Kiev, Astana/Nur-Sultan, etc.

## Multiple-choice distractors (your difficulty rule)
Pull wrong options from a pool scoped by difficulty:
- **Easy** → any country (any region).
- **Medium** → same `region`.
- **Hard** → same `subregion`.

**Gotcha to handle:** some subregions are tiny (e.g., "Northern America" has ~2, "Polynesia" few). If the pool is smaller than the number of distractors needed, **fall back up one level** (subregion → region → global). Same logic for capital-name distractors (pull other countries' `primaryCapital`).

## Settings (single settings panel)
- **# of options for country** (0/2/3/4) and **# of options for capital** (0/2/3/4), independent.
- **Difficulty** (easy/medium/hard) — controls distractor pool scope only.
- **Region / subregion filter** — restrict the playable set (your point A). Multi-select regions, or drill to a subregion.
- **Include disputed territories** (on/off) — filters the 3 `disputed` records.
- **Tier filter** (optional) — "common countries only" = tier 1, using the `tier` field.
- Mode toggle (Guess pick-on-map / Guess prompted / Explore).

## Suggested build order
1. Render the world map + zoom/pan. Color by region.
2. Add the join and a hover tooltip (name) to confirm `id` matching end-to-end.
3. Add the marker layer for the 30 `needsMarker` countries.
4. Explore mode (click → details panel). Cheapest way to validate the whole dataset visually.
5. Guess mode (prompted) with multiple choice + distractor logic.
6. Spell mode + fuzzy matching.
7. Settings panel wiring.
8. Score/streak tracking (in React state — note: artifact sandboxes block localStorage, but on Vercel you can use localStorage freely).

## npm
`react-simple-maps world-atlas topojson-client d3-geo fastest-levenshtein` (+ `flag-icons` if bundling flags).

## Data caveats (worth a skim before shipping)
- **Country populations are ~2018 figures** (sufficient for relative magnitudes and quizzing; swap in a fresher source later if you care about exact numbers). The "most populous country" trivia for India reflects the current ranking, not the 2018 number.
- **City populations are GeoNames "city proper"**, not metro — so e.g. Tokyo shows ~8M (ward population), not the ~37M metro. Consistent across all countries, just don't present them as metro figures.
- **Time-sensitive trivia to verify:** Egypt's new capital, Myanmar/Naypyidaw, Burundi/Gitega, Eswatini naming, North Macedonia naming, Kazakhstan/Astana, "youngest country" (South Sudan), "most populous" (India). All correct as of writing but the category that drifts.
- **Micronesia (FSM)** is the only country missing a capital population (Palikir is ~6k and absent from the city dataset).
- Regenerate or extend anytime with `build-countries.js` + `enrich.js` (add records to the `enrich` maps; facts auto-merge from `world-countries`).
