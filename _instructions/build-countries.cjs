const fs = require("fs");
const path = require("path");
const all = require("world-countries");
const cities = require("all-the-cities");
const topo = require("world-atlas/countries-110m.json");
const { trivia, wikipedia, capitalOverrides, nameAliasOverrides, capitalAliasOverrides, popNameOverrides, popHardcode } = require("./enrich.cjs");
// population.json is a build input — place it next to this script (in _instructions/).
const popData = JSON.parse(fs.readFileSync(path.join(__dirname, "population.json"), "utf8"));

// ---- helpers ----
const norm = s => (s || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip diacritics
  .toLowerCase().replace(/[^a-z0-9]+/g, " ")          // punctuation/hyphens -> space
  .replace(/\b(the|of|and|republic|democratic|kingdom|state|states|city)\b/g, "")
  .replace(/\s+/g, " ").trim();

// ccn3 present in the 110m base map (for needsMarker)
const mapIds = new Set(topo.objects.countries.geometries.map(g => String(g.id)));

// ---- answerable set: UN members + Palestine observer + disputed ----
const set = all.filter(x => x.unMember === true);
["PSE", "TWN", "UNK", "ESH"].forEach(code => { if (!set.find(x => x.cca3 === code)) set.push(all.find(x => x.cca3 === code)); });
const disputedCodes = new Set(["TWN", "UNK", "ESH"]);

// ---- index population by ISO3 ----
const popByIso = {};
for (const row of popData) {
  const iso = popNameOverrides[row.country] || (() => {
    const m = all.find(c => norm(c.name.common) === norm(row.country) || norm(c.name.official) === norm(row.country));
    return m ? m.cca3 : null;
  })();
  if (iso && row.population) popByIso[iso] = row.population;
}

// ---- index cities by cca2 (sorted desc by pop) ----
const cityByCca2 = {};
for (const c of cities) (cityByCca2[c.country] = cityByCca2[c.country] || []).push(c);
for (const k in cityByCca2) cityByCca2[k].sort((a, b) => b.population - a.population);

const findCityPop = (cca2, names) => {
  const list = cityByCca2[cca2] || [];
  const cand = (Array.isArray(names) ? names : [names]).map(norm);
  const hit = list.find(c => cand.includes(norm(c.name)) || (c.altName && cand.includes(norm(c.altName))));
  return hit ? hit.population : null;
};

// ---- build ----
const out = [];
const report = { noPop: [], noCapPop: [], fewCities: [], noTrivia: [] };

for (const base of set) {
  const iso = base.cca3;
  const ov = capitalOverrides[iso];
  const capAliases = capitalAliasOverrides[iso] || [];
  const primaryCapital = ov ? ov.primary : (base.capital[0] || null);
  const capital = ov ? ov.list.map(c => ({ ...c, population: findCityPop(base.cca2, [c.name, ...capAliases]) }))
                     : (base.capital[0] ? [{ name: base.capital[0], type: "capital", population: findCityPop(base.cca2, [base.capital[0], ...capAliases]) }] : []);

  // top 2 largest non-capital cities (exclude capital + its aliases/alt spellings)
  const capNames = new Set([...capital.map(c => c.name), ...capAliases].map(norm));
  const majorCities = (cityByCca2[base.cca2] || [])
    .filter(c => !capNames.has(norm(c.name)))
    .slice(0, 2)
    .map(c => ({ name: c.name, population: c.population }));

  const area = base.area;
  const pop = popByIso[iso] ?? popHardcode[iso] ?? null;
  const microstate = area != null && area < 1000;
  const needsMarker = microstate || !base.ccn3 || !mapIds.has(String(base.ccn3));
  const tier = (pop != null && pop > 20e6) || (area > 1e6) ? 1 : (pop != null && pop < 2e6) || microstate ? 3 : 2;

  // aliases
  const nameAliases = Array.from(new Set([
    base.name.common, base.name.official,
    ...(base.altSpellings || []), ...(nameAliasOverrides[iso] || []),
  ].filter(Boolean)));
  const capitalAliases = Array.from(new Set([
    ...capital.map(c => c.name), ...(capitalAliasOverrides[iso] || []),
  ].filter(Boolean)));

  if (pop == null) report.noPop.push(iso);
  if (capital.length && capital.every(c => c.population == null)) report.noCapPop.push(iso);
  if (majorCities.length < 2 && !microstate) report.fewCities.push(iso);
  if (!trivia[iso]) report.noTrivia.push(iso);

  out.push({
    id: base.ccn3 || null,                 // ISO3166 numeric = join key to world-atlas map
    cca2: base.cca2, cca3: iso,
    name: base.name.common,
    officialName: base.name.official,
    capital,                               // [{name, type, population}]
    primaryCapital,                        // the single guessable answer
    majorCities,                           // top 2 non-capital cities w/ population
    population: pop,
    region: base.region, subregion: base.subregion,
    latlng: base.latlng,                   // [lat, lng] for marker dots / zoom-to
    area,
    flagEmoji: base.flag,
    flagSvg: `https://flagcdn.com/${base.cca2.toLowerCase()}.svg`,
    trivia: trivia[iso] || [],
    wikipedia: wikipedia[iso] || null,
    nameAliases, capitalAliases,
    tier,
    disputed: disputedCodes.has(iso),
    microstate,
    needsMarker,                           // true => render as clickable dot, not polygon
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
// Write straight to the file the app imports.
const outPath = path.join(__dirname, "..", "src", "data", "countries.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log("WROTE:", outPath);

console.log("TOTAL:", out.length);
console.log("disputed:", out.filter(c => c.disputed).map(c => c.cca3).join(", "));
console.log("needsMarker (dots):", out.filter(c => c.needsMarker).length, "->", out.filter(c => c.needsMarker).map(c => c.cca3).join(", "));
console.log("multi-capital:", out.filter(c => c.capital.length > 1).map(c => c.cca3).join(", "));
console.log("--- gaps ---");
console.log("missing country pop:", report.noPop.join(", ") || "none");
console.log("missing capital pop:", report.noCapPop.join(", ") || "none");
console.log("fewer than 2 major cities (non-micro):", report.fewCities.join(", ") || "none");
console.log("missing trivia:", report.noTrivia.join(", ") || "none");
