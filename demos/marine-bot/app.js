/* ============================================================
   Live demo driver.

   The engine modules under ./engine/ are copied verbatim from
   src/ in the algerian-coast-marine-bot repository. Nothing here
   changes a rating — this file only fetches the forecast, calls
   buildReport, and draws the result (Halation, Drama · 1 · dark).
   ============================================================ */

import { buildReport } from "./engine/index.js";
import { renderFallback } from "./engine/render.js";

const el = (id) => document.getElementById(id);

/* The page's language (index.html = en, fr.html = fr) sets the interface and the default
   message language. The engine stays verbatim: on the French page the few sentences it
   writes in English (limits, flag reasons) are translated here, for display only. */
const UI = document.documentElement.lang === "fr" ? "fr" : "en";
const NB = " ";

const STRINGS = {
  en: {
    locale: "en-GB",
    profiles: { beginner: "Beginner", recreational: "Recreational", experienced: "Experienced" },
    activities: { sailing: "Sailing", fishing_shore: "Fishing from the shore", fishing_small_boat: "Fishing from a small boat", swimming: "Swimming" },
    metrics: ["Wind", "Gust held 2 h+", "Peak gust", "Gust factor", "Waves, max", "Wave period", "Swell, max", "Sea", "Air", "Rain chance"],
    severity: { info: "Info", caution: "Caution", high_risk: "High risk" },
    data: { complete: "complete", degraded: "partial", incomplete: "incomplete" },
    configError: "The bot’s configuration files could not be loaded.",
    fetching: (city) => "Fetching the live forecast for " + city,
    fetchError: "The forecast could not be fetched. Open-Meteo may be rate-limiting or briefly down, and no older data is shown in its place.",
    retry: "Try again",
    better: (label, rating) => "Better window: " + label + ", " + rating,
    noFlags: "No flags raised for this window.",
    waveByModel: "Max wave height, by model",
    gustByModel: "Max gust, by model",
    top: { m: "highest", kt: "strongest" },
    spread: (v, u) => "Spread " + v + " " + u,
    noModels: "Per-model figures are not available for this request.",
    models: (m, a) => "Marine models: " + m + ". Atmospheric: " + a + ".",
    sub: (win, profile, v, data) => win + " · " + profile + " · thresholds v" + v + " · data " + data,
    readout: (city, wave, period) => "Swell drawn from today’s forecast off " + city + ": waves up to " + wave + " m, every " + period + " s.",
    source: (n) => "Open-Meteo · " + n + " marine models",
    fetched: (t) => "Fetched " + t + " · Algiers time",
    pause: "Pause ambient motion",
    resume: "Resume ambient motion",
  },
  fr: {
    locale: "fr-FR",
    profiles: { beginner: "Débutant", recreational: "Loisir", experienced: "Expérimenté" },
    activities: { sailing: "Voile", fishing_shore: "Pêche du bord", fishing_small_boat: "Pêche en petit bateau", swimming: "Baignade" },
    metrics: ["Vent", "Rafale tenue 2 h+", "Rafale max.", "Facteur de rafale", "Vagues, max.", "Période", "Houle, max.", "Mer", "Air", "Risque de pluie"],
    severity: { info: "Info", caution: "Prudence", high_risk: "Risque élevé" },
    data: { complete: "complètes", degraded: "partielles", incomplete: "incomplètes" },
    configError: "Les fichiers de configuration du bot n’ont pas pu être chargés.",
    fetching: (city) => "Récupération de la prévision en direct pour " + city,
    fetchError: "La prévision n’a pas pu être récupérée. Open-Meteo limite peut-être les requêtes ou est brièvement indisponible, et aucune donnée plus ancienne n’est affichée à la place.",
    retry: "Réessayer",
    better: (label, rating) => "Meilleure fenêtre" + NB + ": " + label + ", " + rating,
    noFlags: "Aucun signal pour cette fenêtre.",
    waveByModel: "Hauteur de vague max., par modèle",
    gustByModel: "Rafale max., par modèle",
    top: { m: "la plus haute", kt: "la plus forte" },
    spread: (v, u) => "Écart " + v + " " + u,
    noModels: "Les valeurs par modèle ne sont pas disponibles pour cette requête.",
    models: (m, a) => "Modèles marins" + NB + ": " + m + ". Atmosphériques" + NB + ": " + a + ".",
    sub: (win, profile, v, data) => win + " · " + profile.toLowerCase() + " · seuils v" + v + " · données " + data,
    readout: (city, wave, period) => "Houle dessinée d’après la prévision du jour, " + city + NB + ": vagues jusqu’à " + wave + " m, toutes les " + period + " s.",
    source: (n) => "Open-Meteo · " + n + " modèles marins",
    fetched: (t) => "Récupérée à " + t + " · heure d’Alger",
    pause: "Mettre en pause le mouvement d’ambiance",
    resume: "Reprendre le mouvement d’ambiance",
  },
}[UI];

const PROFILES = ["beginner", "recreational", "experienced"].map((id) => ({ id, label: STRINGS.profiles[id] }));
const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

/* A rating is always a glyph and a word, never a color alone. */
const RATING = {
  GOOD: { tone: "positive", glyph: "check" },
  CAUTION: { tone: "caution", glyph: "alert" },
  AVOID: { tone: "critical", glyph: "close" },
};
const SEVERITY = {
  info: { tone: "info", glyph: "info" },
  caution: { tone: "caution", glyph: "alert" },
  high_risk: { tone: "critical", glyph: "alert" },
};

let config = null;
let state = { city: "algiers", profile: "recreational", language: UI };
let inFlight = 0;
let drawn = false;

/* ---------- boot ---------- */

async function boot() {
  frenchReel();
  themeToggle();
  drawSwell(0.6, 6);
  addEventListener("resize", debounce(() => { drawSwell(sea.wave, sea.period); drawCoast(); }, 200));

  try {
    const [thresholds, locations, runtime, i18n] = await Promise.all([
      getJson("config/thresholds.v1.json"),
      getJson("config/locations.json"),
      getJson("config/runtime.json"),
      getJson("config/i18n.json"),
    ]);
    config = { thresholds, locations, runtime, i18n };
  } catch (err) {
    setStatus(STRINGS.configError, "error");
    console.error(err);
    return;
  }

  buildCities();
  buildSeg("profiles", PROFILES, "profile");
  buildSeg("languages", LANGUAGES, "language");

  run();
}

function getJson(path) {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  });
}

/* ---------- controls ---------- */

function cityName(l) {
  return l["name_" + UI] ?? l.name_en;
}

function coords(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : UI === "fr" ? "O" : "W";
  return num(Math.abs(lat).toFixed(2)) + "° " + ns + " · " + num(Math.abs(lon).toFixed(2)) + "° " + ew;
}

/* The six forecast points, placed by their real longitude and latitude. West stays on the left. */
function coastPoints() {
  const pts = [...config.locations.locations].sort((a, b) => a.longitude - b.longitude);
  const lons = pts.map((p) => p.longitude);
  const lats = pts.map((p) => p.latitude);
  const lo = Math.min(...lons), hi = Math.max(...lons);
  const south = Math.min(...lats), north = Math.max(...lats);
  return pts.map((p, i) => ({
    loc: p,
    x: 7 + ((p.longitude - lo) / (hi - lo)) * 86,
    y: 44 + ((north - p.latitude) / (north - south || 1)) * 26,
    side: i % 2 ? "above" : "below",
  }));
}

function buildCities() {
  const box = el("cities");
  box.replaceChildren();
  for (const p of coastPoints()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "city";
    btn.dataset.value = p.loc.id;
    btn.dataset.side = p.side;
    btn.style.setProperty("--x", p.x.toFixed(2));
    btn.style.setProperty("--y", p.y.toFixed(2));
    btn.setAttribute("aria-pressed", String(state.city === p.loc.id));
    btn.append(tag("span", "city__name", cityName(p.loc)), tag("span", "city__at", coords(p.loc.latitude, p.loc.longitude)));
    btn.addEventListener("click", () => choose("city", p.loc.id, box));
    box.appendChild(btn);
  }
  drawCoast();
  setCoords();
}

function buildSeg(containerId, items, key) {
  const box = el(containerId);
  box.replaceChildren();
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    btn.dataset.value = item.id;
    if (key === "language") btn.lang = item.id;
    btn.setAttribute("aria-pressed", String(state[key] === item.id));
    btn.addEventListener("click", () => choose(key, item.id, box));
    box.appendChild(btn);
  }
}

function choose(key, value, box) {
  if (state[key] === value) return;
  state[key] = value;
  for (const b of box.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.value === value));
  if (key === "city") { drawCoast(); setCoords(); }
  run();
}

function setCoords() {
  const l = config.locations.locations.find((x) => x.id === state.city);
  if (l) el("sea-coords").textContent = coords(l.latitude, l.longitude);
}

/* The shore through the six points, the land below it, and a dot per point. */
function drawCoast() {
  const svg = el("coast-line");
  if (!svg || !config) return;
  const w = svg.clientWidth, h = svg.clientHeight;
  if (!w || !h) return;
  const pts = coastPoints().map((p) => ({ ...p, px: (p.x / 100) * w, py: (p.y / 100) * h }));
  const first = pts[0], last = pts[pts.length - 1];
  const shore = [[0, first.py + h * 0.04], ...pts.map((p) => [p.px, p.py]), [w, last.py - h * 0.02]];
  const line = shore.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML =
    `<path class="coast__land" d="${line} L${w} ${h} L0 ${h} Z"></path>` +
    `<path class="coast__shore" d="${line}"></path>` +
    pts.map((p) => `<circle class="coast__dot${p.loc.id === state.city ? " is-on" : ""}" cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="4.5"></circle>`).join("");
}

/* ---------- the swell: ambient layer of the opening shot ----------
   Lines nearer the viewer are lower, larger and brighter. Their height follows the forecast's
   maximum wave height, their spacing and speed its period. Each line is one composited layer
   that only translates, so phones move it without repainting. */
const sea = { wave: 0.6, period: 6 };

function drawSwell(wave, period) {
  sea.wave = wave;
  sea.period = period;
  const box = el("swell");
  if (!box) return;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  const touch = document.documentElement.dataset.tier === "touch";
  const count = touch ? 8 : 13;
  const amp = Math.min(Math.max(wave, 0.15), 4);
  const per = Math.min(Math.max(period, 2.5), 14);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    const near = 0.1 + 0.9 * Math.pow(t, 1.6);
    const y = h * Math.pow(t, 1.8) * 0.96 + 2;
    const a = amp * 11 * near + 0.6;
    const len = per * 30 * near + 40;
    const span = w + len * 2;
    const phase = i * 1.7;
    let d = "";
    for (let x = 0; x <= span; x += len / 18) {
      const k = (x / len) * Math.PI * 2 + phase;
      const yy = a + a * (0.82 * Math.sin(k) + 0.18 * Math.sin(2 * k + 0.6));
      d += (x ? "L" : "M") + x.toFixed(1) + " " + yy.toFixed(1);
    }
    const line = document.createElement("div");
    line.className = "swell-line";
    line.style.cssText = `top:${(y - a).toFixed(1)}px;left:${(-len).toFixed(1)}px;--l:${len.toFixed(1)};--t:${(per * 2.2 * (1.4 - near * 0.4)).toFixed(2)}s;opacity:${(0.08 + 0.4 * Math.pow(t, 0.8)).toFixed(2)}`;
    line.innerHTML = `<svg width="${span.toFixed(0)}" height="${(a * 2 + 2).toFixed(0)}" aria-hidden="true" focusable="false"><path d="${d}"></path></svg>`;
    frag.appendChild(line);
  }
  box.replaceChildren(frag);
}

/* ---------- fetch + assess ---------- */

async function run() {
  const token = ++inFlight;
  const location = config.locations.locations.find((l) => l.id === state.city);
  if (!location) return;

  setStatus(STRINGS.fetching(cityName(location)), "loading");
  if (drawn) el("report").classList.add("is-swapping");

  try {
    const { forecast, marine, seaState } = await fetchForecast(location);
    if (token !== inFlight) return; // a newer request won

    const date = forecast.hourly.time[0].slice(0, 10);
    const report = buildReport({
      forecast,
      marine,
      seaState,
      location,
      thresholds: config.thresholds,
      language: state.language,
      profile: state.profile,
      date,
      now: new Date(),
      marineModels: config.runtime.ensemble.marine_models,
      atmosphericModels: config.runtime.ensemble.atmospheric_models,
      timezone: config.locations.timezone,
    });

    draw(report, location);
    setStatus("", "");
  } catch (err) {
    if (token !== inFlight) return;
    console.error(err);
    el("report").hidden = true;
    el("report").classList.remove("is-swapping");
    drawn = false;
    setStatus(STRINGS.fetchError, "error");
  }
}

function fetchForecast(location) {
  const api = config.runtime.api;
  const tz = encodeURIComponent(config.locations.timezone);
  const base = `latitude=${location.latitude}&longitude=${location.longitude}&timezone=${tz}&forecast_days=2`;
  const marineModels = config.runtime.ensemble.marine_models.join(",");
  const atmosModels = config.runtime.ensemble.atmospheric_models.join(",");

  const fUrl = `https://api.open-meteo.com/v1/forecast?${base}&hourly=${api.forecast_hourly}&models=${atmosModels}`;
  const mUrl = `https://marine-api.open-meteo.com/v1/marine?${base}&hourly=${api.marine_hourly}&models=${marineModels}`;
  // Deliberately unpinned: the wave models carry no sea temperature or currents.
  const sUrl = `https://marine-api.open-meteo.com/v1/marine?${base}&hourly=${api.sea_state_hourly}`;

  return Promise.all([getJson(fUrl), getJson(mUrl), getJson(sUrl)]).then(
    ([forecast, marine, seaState]) => ({ forecast, marine, seaState })
  );
}

/* ---------- drawing ---------- */

function draw(report, location) {
  const first = !drawn;
  const box = el("report");
  box.hidden = false;
  box.classList.remove("is-swapping");

  const fetchedAt = new Date().toLocaleTimeString(STRINGS.locale, { hour: "2-digit", minute: "2-digit", timeZone: config.locations.timezone });

  el("report-title").textContent = cityName(location);
  el("report-date").textContent = new Date(report.forecast_date + "T12:00:00").toLocaleDateString(STRINGS.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  el("report-sub").textContent = STRINGS.sub(
    report.headline_window.label,
    STRINGS.profiles[state.profile] || state.profile,
    report.thresholds_version,
    STRINGS.data[report.data_status] || report.data_status
  );

  drawActivities(report);
  drawMetrics(report, fetchedAt);
  drawFlags(report);
  drawEnsemble(report);
  drawWindows(report);

  el("telegram").innerHTML = renderFallback(report, config.i18n);
  el("telegram-time").textContent = fetchedAt;

  const w = report.metrics.waves || {};
  if (typeof w.max_m === "number" && typeof w.period_mean_s === "number") {
    drawSwell(w.max_m, w.period_mean_s);
    el("sea-readout").textContent = STRINGS.readout(cityName(location), num(w.max_m), num(w.period_mean_s));
  } else {
    el("sea-readout").textContent = "";
  }

  drawn = true;
  if (first && window.Halation) {
    // The report was hidden when Halation bound the page: bind its reveals and the models scene now.
    window.Halation.rebind();
  } else {
    develop(el("activities").children);
  }
  growBars();
}

function drawActivities(report) {
  const box = el("activities");
  box.replaceChildren();

  for (const [activity, value] of Object.entries(report.activities)) {
    const r = RATING[value.rating] || RATING.CAUTION;
    const li = document.createElement("li");
    li.className = "act";
    li.dataset.tone = r.tone;

    li.appendChild(tag("h3", "act__name h-heading", STRINGS.activities[activity] || activity));
    li.appendChild(status(ratingWord(value.rating), r, "act__rating"));

    const why = document.createElement("div");
    why.className = "act__why";
    if (value.limits && value.limits.length) {
      const ul = document.createElement("ul");
      ul.className = "act__limits";
      for (const limit of value.limits) ul.appendChild(tag("li", null, say(limit)));
      why.appendChild(ul);
    }
    if (value.best_window) {
      why.appendChild(tag("p", "act__better", STRINGS.better(value.best_window.label, ratingWord(value.best_window.rating))));
    }
    li.appendChild(why);
    box.appendChild(li);
  }
}

function drawMetrics(report, fetchedAt) {
  const m = report.metrics;
  const L = STRINGS.metrics;
  const rows = [
    [L[0], m.wind?.mean_kt, "kt", compass(m.wind?.direction_compass ?? null)],
    [L[1], m.wind?.gust_sustained_kt, "kt"],
    [L[2], m.wind?.gust_max_kt, "kt"],
    [L[3], m.wind?.gust_factor_at_peak, "×"],
    [L[4], m.waves?.max_m, "m"],
    [L[5], m.waves?.period_mean_s, "s"],
    [L[6], m.swell?.max_m, "m"],
    [L[7], m.sea?.sst_mean_c, "°C"],
    [L[8], m.weather?.air_temp_mean_c, "°C"],
    [L[9], m.weather?.precip_probability_max_pct, "%"],
  ];

  const box = el("metrics");
  box.replaceChildren();
  for (const [label, value, unit, extra] of rows) {
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    const cell = document.createElement("div");
    cell.className = "gauge";
    cell.appendChild(tag("dt", null, label));
    const dd = document.createElement("dd");
    dd.append(num(value), tag("small", null, unitWord(unit) + (extra ? " " + extra : "")));
    cell.appendChild(dd);
    box.appendChild(cell);
  }

  const u = report.uncertainty || {};
  el("metrics-source").textContent = STRINGS.source((u.marine_models || config.runtime.ensemble.marine_models).length);
  el("metrics-time").textContent = STRINGS.fetched(fetchedAt);
}

function drawFlags(report) {
  const box = el("flags");
  box.replaceChildren();

  if (!report.flags.length) {
    box.appendChild(tag("p", "note", STRINGS.noFlags));
    return;
  }

  const list = document.createElement("ul");
  list.className = "flag-list";
  for (const flag of report.flags) {
    const li = document.createElement("li");
    li.className = "flag";
    li.appendChild(status(STRINGS.severity[flag.severity] || flag.severity, SEVERITY[flag.severity] || SEVERITY.info));
    const body = document.createElement("div");
    const flagName = UI === "fr" && config.i18n.fr.flags ? config.i18n.fr.flags[flag.code] : null;
    body.appendChild(tag("span", "flag__code", flagName ? flagName + " · " + flag.code : flag.code));
    body.appendChild(tag("span", "flag__reason", say(flag.reason)));
    li.appendChild(body);
    list.appendChild(li);
  }
  box.appendChild(list);
}

function drawEnsemble(report) {
  const u = report.uncertainty;
  const box = el("ensemble");
  box.replaceChildren();

  const blocks = [
    { title: STRINGS.waveByModel, unit: "m", data: u.per_model_wave_max_m, spread: u.wave_spread_m },
    { title: STRINGS.gustByModel, unit: "kt", data: u.per_model_gust_max_kt, spread: u.gust_spread_kt },
  ];

  let drew = false;
  for (const block of blocks) {
    if (!block.data || !Object.keys(block.data).length) continue;
    drew = true;

    const wrap = document.createElement("div");
    wrap.className = "spread";
    wrap.appendChild(tag("h3", "spread__h h-eyebrow", block.title));

    const values = Object.values(block.data).filter((v) => typeof v === "number");
    const max = Math.max(...values, 0.0001);
    for (const [model, value] of Object.entries(block.data)) {
      if (typeof value !== "number") continue;
      const top = value === max;
      const row = document.createElement("div");
      row.className = "spread__row" + (top ? " is-top" : "");
      row.appendChild(tag("span", "spread__model", model));
      const track = document.createElement("span");
      track.className = "spread__track";
      const bar = document.createElement("span");
      bar.className = "spread__bar";
      bar.style.setProperty("--v", Math.max(0.02, value / max).toFixed(3));
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(tag("span", "spread__value", num(value) + " " + unitWord(block.unit)));
      if (top) row.title = STRINGS.top[block.unit];
      wrap.appendChild(row);
    }
    wrap.appendChild(tag("p", "spread__total", STRINGS.spread(num(block.spread), unitWord(block.unit))));
    box.appendChild(wrap);
  }

  if (!drew) box.appendChild(tag("p", "note", STRINGS.noModels));
  box.appendChild(tag("p", "model-list", STRINGS.models((u.marine_models || []).join(", "), (u.atmospheric_models || []).join(", "))));
}

function drawWindows(report) {
  const body = el("windows-table").querySelector("tbody");
  body.replaceChildren();
  for (const w of report.windows) {
    const tr = document.createElement("tr");
    tr.appendChild(tag("td", "is-strong", w.label));
    tr.appendChild(tag("td", "is-num", dash(w.wind_gust_kt, "kt")));
    tr.appendChild(tag("td", "is-num", dash(w.wave_max_m, "m")));
    tr.appendChild(tag("td", "is-num", dash(w.wave_period_s, "s")));
    for (const rating of [w.ratings.sailing, w.ratings.swimming]) {
      const td = document.createElement("td");
      td.appendChild(status(ratingWord(rating), RATING[rating] || RATING.CAUTION));
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}

/* ---------- motion for redrawn content ---------- */

function calm() {
  return document.documentElement.dataset.tier === "calm";
}

/* When a setting changes, the ratings develop again, as on first view. */
function develop(items) {
  const gs = window.gsap;
  const list = Array.from(items);
  if (!gs || !list.length) return;
  const r = list[0].getBoundingClientRect();
  if (r.top > innerHeight || r.bottom < 0) return;
  const g = window.Halation ? window.Halation.genre(list[0]) : { distance: 32, reveal: 1.2, stagger: 0.11, enter: "expo.out" };
  if (calm()) gs.from(list, { opacity: 0, duration: 0.3, clearProps: "opacity" });
  else gs.from(list, { opacity: 0, y: g.distance * 0.5, duration: g.reveal * 0.7, ease: g.enter, stagger: g.stagger * 0.6, clearProps: "opacity,transform" });
}

/* The model bars grow from zero the first time they are seen after each draw. */
let barsTrigger = null;
function growBars() {
  const gs = window.gsap, ST = window.ScrollTrigger;
  const bars = Array.from(document.querySelectorAll(".spread__bar"));
  if (!gs || !bars.length || calm()) return;
  if (barsTrigger) { barsTrigger.kill(); barsTrigger = null; }
  const play = () => gs.from(bars, { scaleX: 0, duration: 1.4, ease: "expo.out", stagger: 0.08, clearProps: "transform" });
  const r = el("ensemble").getBoundingClientRect();
  if (r.top < innerHeight * 0.85 && r.bottom > 0) { play(); return; }
  if (ST) barsTrigger = ST.create({ trigger: el("ensemble"), start: "top 85%", once: true, onEnter: play });
}

/* ---------- small builders ---------- */

function status(word, r, extra) {
  const span = document.createElement("span");
  span.className = "h-status" + (extra ? " " + extra : "");
  span.dataset.tone = r.tone;
  span.innerHTML = `<svg class="h-glyph" aria-hidden="true"><use href="#g-${r.glyph}"></use></svg>`;
  span.append(word);
  return span;
}

function dash(value, unit) {
  return value === null || value === undefined ? "—" : num(value) + " " + unitWord(unit);
}

/* The Halation reel names its pause state in English; the French page says it in French. */
function frenchReel() {
  if (UI !== "fr") return;
  const reel = document.querySelector("[data-reel]");
  const sr = reel && reel.querySelector(".h-sr");
  if (!sr) return;
  new MutationObserver(() => {
    const text = reel.getAttribute("aria-pressed") === "true" ? STRINGS.resume : STRINGS.pause;
    if (sr.textContent !== text) sr.textContent = text;
  }).observe(reel, { attributes: true, attributeFilter: ["aria-pressed"], subtree: true, childList: true, characterData: true });
}

/* Dark is the default; print (light) is the alternative. The choice is remembered on this device only. */
function themeToggle() {
  const btn = document.querySelector("[data-theme-toggle]");
  if (!btn) return;
  const root = document.documentElement;
  const paint = () => {
    const light = root.dataset.theme === "light";
    btn.setAttribute("aria-label", light ? btn.dataset.toDark : btn.dataset.toLight);
    btn.querySelector("use").setAttribute("href", light ? "#g-moon" : "#g-sun");
  };
  paint();
  btn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("mb-theme", root.dataset.theme); } catch (e) { /* private mode: not remembered */ }
    paint();
  });
}

function debounce(fn, ms) {
  let t = 0;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

/* ---------- language helpers ---------- */

function ratingWord(rating) {
  if (UI !== "fr") return rating;
  return (config && config.i18n.fr.ratings[rating]) || rating;
}
function num(value) {
  return UI === "fr" ? String(value).replace(".", ",") : String(value);
}
function unitWord(unit) {
  return UI === "fr" && unit === "kt" ? "nd" : unit;
}
function compass(dir) {
  return UI === "fr" && dir ? dir.replace(/W/g, "O") : dir;
}

/* The engine writes its limits and flag reasons in English (it is the bot's audit trail).
   On the French page each known sentence is read in French; anything unknown stays as written. */
const CRITERIA_FR = {
  "maximum gust": "Rafale maximale",
  "mean wind": "Vent moyen",
  "maximum wave height": "Hauteur de vague maximale",
  "wave period": "Période des vagues",
  "surface current": "Courant de surface",
  "sea temperature": "Température de la mer",
  "rain probability": "Probabilité de pluie",
};
const CRIT = "(maximum gust|mean wind|maximum wave height|wave period|surface current|sea temperature|rain probability)";
const FR_RULES = [
  [new RegExp("^" + CRIT + " (.+?) exceeds the AVOID limit of (.+)$"), (m) => `${CRITERIA_FR[m[1]]}${NB}: ${m[2]}, au-delà de la limite À ÉVITER (${m[3]})`],
  [new RegExp("^" + CRIT + " (.+?) is above the GOOD limit of (.+)$"), (m) => `${CRITERIA_FR[m[1]]}${NB}: ${m[2]}, au-dessus de la limite FAVORABLE (${m[3]})`],
  [new RegExp("^" + CRIT + " (.+?) is below the AVOID limit of (.+)$"), (m) => `${CRITERIA_FR[m[1]]}${NB}: ${m[2]}, sous la limite À ÉVITER (${m[3]})`],
  [new RegExp("^" + CRIT + " (.+?) is below the GOOD limit of (.+)$"), (m) => `${CRITERIA_FR[m[1]]}${NB}: ${m[2]}, sous la limite FAVORABLE (${m[3]})`],
  [new RegExp("^" + CRIT + " (.+?) is short of the (.+?) comfort floor, implying steep, closely spaced waves$"), (m) => `${CRITERIA_FR[m[1]]}${NB}: ${m[2]}, sous le seuil de confort de ${m[3]}${NB}: vagues creuses et rapprochées`],
  [/^Essential forecast data is missing or too sparse to assess \((.+)\)\.$/, (m) => `Des données de prévision essentielles manquent ou sont trop éparses pour évaluer (${m[1]}).`],
  [/^Gusts hold at (.+?) kt or above, past the (.+?) kt high-risk threshold \(peak (.+?) kt\)\.$/, (m) => `Les rafales se maintiennent à ${m[1]} nd ou plus, au-delà du seuil de risque élevé de ${m[2]} nd (pic à ${m[3]} nd).`],
  [/^Gusts hold at (.+?) kt or above, past the (.+?) kt caution threshold \(peak (.+?) kt\)\.$/, (m) => `Les rafales se maintiennent à ${m[1]} nd ou plus, au-delà du seuil de prudence de ${m[2]} nd (pic à ${m[3]} nd).`],
  [/^Waves reach (.+?) m, above the (.+?) m high-risk threshold\.$/, (m) => `Les vagues atteignent ${m[1]} m, au-dessus du seuil de risque élevé de ${m[2]} m.`],
  [/^Waves reach (.+?) m, above the (.+?) m caution threshold\.$/, (m) => `Les vagues atteignent ${m[1]} m, au-dessus du seuil de prudence de ${m[2]} m.`],
  [/^(.+?) m waves at only (.+?) s produce steep, closely spaced seas\.$/, (m) => `Des vagues de ${m[1]} m à seulement ${m[2]} s forment une mer creuse et rapprochée.`],
  [/^(.+?) m waves at (.+?) s make for short, uncomfortable chop\.$/, (m) => `Des vagues de ${m[1]} m à ${m[2]} s donnent un clapot court et inconfortable.`],
  [/^Forecast surface current of (.+?) m\/s exceeds the (.+?) m\/s high-risk threshold\.$/, (m) => `Le courant de surface prévu, ${m[1]} m/s, dépasse le seuil de risque élevé de ${m[2]} m/s.`],
  [/^Forecast surface current of (.+?) m\/s exceeds the (.+?) m\/s caution threshold\.$/, (m) => `Le courant de surface prévu, ${m[1]} m/s, dépasse le seuil de prudence de ${m[2]} m/s.`],
  [/^Thunderstorms are forecast within the window\.$/, () => "Des orages sont prévus dans la fenêtre."],
  [/^(\d+) of (\d+) forecast models show thunderstorms in this window; the others do not\.$/, (m) => `${m[1]} modèles de prévision sur ${m[2]} annoncent des orages dans cette fenêtre${NB}; les autres non.`],
  [/^Heavy rain or showers are forecast within the window\.$/, () => "De fortes pluies ou des averses sont prévues dans la fenêtre."],
  [/^Sea temperature of (.+?) °C is below the (.+?) °C threshold; cold-shock and rapid heat loss are real risks\.$/, (m) => `La mer est à ${m[1]} °C, sous le seuil de ${m[2]} °C${NB}: choc thermique et refroidissement rapide sont de vrais risques.`],
  [/^Sea temperature of (.+?) °C is below the (.+?) °C comfort threshold\.$/, (m) => `La mer est à ${m[1]} °C, sous le seuil de confort de ${m[2]} °C.`],
  [/^The (\d+) forecast models disagree materially on (.+?)\. The rating uses the most pessimistic of them and is held at CAUTION or worse\.$/, (m) => `Les ${m[1]} modèles de prévision divergent nettement sur ${uncertainParts(m[2])}. L’évaluation retient le plus pessimiste et reste à PRUDENCE ou moins.`],
  [/^Gusts peak at (.+?) kt for about (.+?) h \((.+?)x the sustained wind of (.+?) kt\), while holding near (.+?) kt for longer\. Treat the peak as real and plan around it\.$/, (m) => `Les rafales culminent à ${m[1]} nd pendant environ ${m[2]} h (${m[3]}× le vent établi de ${m[4]} nd), et restent autour de ${m[5]} nd plus longtemps. Considérez ce pic comme réel et prévoyez en conséquence.`],
  [/^Mean wind of (.+?) kt is very light - likely motoring rather than sailing\.$/, (m) => `Vent moyen de ${m[1]} nd, très faible${NB}: plutôt du moteur que de la voile.`],
  [/^An official warning is in force: (.+)\.$/, (m) => `Un avis officiel est en vigueur${NB}: ${m[1]}.`],
  [/^Official marine warnings were not checked - no machine-readable feed is available for this coast\. Check them yourself before going out\.$/, () => `Les avis maritimes officiels n’ont pas été vérifiés${NB}: aucun flux exploitable n’existe pour cette côte. Vérifiez-les vous-même avant de sortir.`],
];
function uncertainParts(text) {
  return text
    .split(" and ")
    .map((p) => p
      .replace(/^wave height spread (.+) m$/, "la hauteur des vagues (écart de $1 m)")
      .replace(/^wave height (.+) m$/, "la hauteur des vagues ($1 m)")
      .replace(/^peak gust spread (.+) kt$/, "la rafale maximale (écart de $1 nd)")
      .replace(/^peak gust (.+) kt$/, "la rafale maximale ($1 nd)"))
    .join(" et ");
}
function say(sentence) {
  if (UI !== "fr" || !sentence) return sentence;
  for (const [re, fr] of FR_RULES) {
    const m = sentence.match(re);
    if (m) return fr(m).replace(/(\d)\.(\d)/g, "$1,$2").replace(/(\d) kt\b/g, "$1 nd");
  }
  return sentence;
}

/* ---------- helpers ---------- */

function tag(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}

function setStatus(message, kind) {
  const node = el("status");
  node.replaceChildren();
  node.hidden = !message;
  if (!message) return;
  if (kind === "error") {
    node.dataset.tone = "critical";
    node.innerHTML = `<svg class="h-glyph" aria-hidden="true"><use href="#g-alert"></use></svg>`;
    node.append(message + " ");
    const again = tag("button", "h-btn h-btn--ghost h-btn--sm", STRINGS.retry);
    again.type = "button";
    again.addEventListener("click", () => (config ? run() : location.reload()));
    node.append(again);
  } else {
    node.dataset.tone = "live";
    node.append(message);
  }
}

boot();
