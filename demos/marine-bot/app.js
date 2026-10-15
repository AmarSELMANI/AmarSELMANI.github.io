/* ============================================================
   Live demo driver.

   The engine modules under ./engine/ are copied verbatim from
   src/ in the algerian-coast-marine-bot repository. Nothing here
   changes a rating — this file only fetches the forecast, calls
   buildReport, and draws the result.
   ============================================================ */

import { buildReport } from "./engine/index.js";
import { renderFallback } from "./engine/render.js";

const el = (id) => document.getElementById(id);

/* The page's language (index.html = en, fr.html = fr) sets the interface and the default
   message language. The engine stays verbatim: on the French page the few sentences it
   writes in English (limits, flag reasons) are translated here, for display only. */
const UI = document.documentElement.lang === "fr" ? "fr" : "en";

const STRINGS = {
  en: {
    profiles: { beginner: "Beginner", recreational: "Recreational", experienced: "Experienced" },
    activities: { sailing: "Sailing", fishing_shore: "Fishing — shore", fishing_small_boat: "Fishing — small boat", swimming: "Swimming" },
    metrics: ["Wind", "Gust held 2h+", "Peak gust", "Gust factor at peak", "Waves (max)", "Wave period", "Swell (max)", "Sea temperature", "Air temperature", "Rain chance"],
    configError: "Could not load the bot's configuration files.",
    fetching: (city) => "Fetching the live forecast for " + city + "…",
    fetchError: "The forecast could not be fetched. Open-Meteo may be rate-limiting or briefly unavailable — no stale data is shown instead. Try again in a moment.",
    better: (label, rating) => "Better window: " + label + " (" + rating + ")",
    noFlags: "No flags raised for this window.",
    waveByModel: "Max wave height by model",
    gustByModel: "Max gust by model",
    spread: (v, u) => "Spread: " + v + " " + u,
    noModels: "Per-model figures are not available for this request.",
    models: (m, a) => "Marine: " + m + " · Atmospheric: " + a,
    sub: (win, profile, v, data) => win + " · " + profile + " · thresholds v" + v + " · data " + data,
    title: (name, date) => name + " — " + date,
  },
  fr: {
    profiles: { beginner: "Débutant", recreational: "Loisir", experienced: "Expérimenté" },
    activities: { sailing: "Voile", fishing_shore: "Pêche — du bord", fishing_small_boat: "Pêche — petit bateau", swimming: "Baignade" },
    metrics: ["Vent", "Rafale tenue 2 h+", "Rafale maximale", "Facteur de rafale au pic", "Vagues (max.)", "Période des vagues", "Houle (max.)", "Température de la mer", "Température de l\u2019air", "Risque de pluie"],
    configError: "Impossible de charger les fichiers de configuration du bot.",
    fetching: (city) => "Récupération de la prévision en direct pour " + city + "…",
    fetchError: "La prévision n\u2019a pas pu être récupérée. Open-Meteo limite peut-être les requêtes ou est brièvement indisponible : aucune donnée ancienne n\u2019est affichée à la place. Réessayez dans un instant.",
    better: (label, rating) => "Meilleure fenêtre\u00a0: " + label + " (" + rating + ")",
    noFlags: "Aucun signal pour cette fenêtre.",
    waveByModel: "Hauteur de vague max. par modèle",
    gustByModel: "Rafale max. par modèle",
    spread: (v, u) => "Écart\u00a0: " + v + " " + u,
    noModels: "Les valeurs par modèle ne sont pas disponibles pour cette requête.",
    models: (m, a) => "Marins\u00a0: " + m + " · Atmosphériques\u00a0: " + a,
    sub: (win, profile, v, data) => win + " · " + profile.toLowerCase() + " · seuils v" + v + " · données " + data,
    title: (name, date) => name + " — " + new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    data: { complete: "complètes", degraded: "partielles", incomplete: "incomplètes" },
    severity: { info: "info", caution: "prudence", high_risk: "risque élevé" },
  },
}[UI];

const PROFILES = ["beginner", "recreational", "experienced"].map((id) => ({ id, label: STRINGS.profiles[id] }));

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const RATING_CLASS = { GOOD: "good", CAUTION: "warn", AVOID: "bad" };

const ACTIVITY_LABELS = STRINGS.activities;

let config = null;
let state = { city: "algiers", profile: "recreational", language: UI };
let inFlight = 0;

/* ---------- boot ---------- */

async function boot() {
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

  buildChips("cities", config.locations.locations.map((l) => ({ id: l.id, label: l["name_" + UI] ?? l.name_en })), "city");
  buildChips("profiles", PROFILES, "profile");
  buildChips("languages", LANGUAGES, "language");

  run();
}

function getJson(path) {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  });
}

function buildChips(containerId, items, key) {
  const box = el(containerId);
  box.replaceChildren();
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = item.label;
    btn.dataset.value = item.id;
    btn.setAttribute("aria-pressed", String(state[key] === item.id));
    btn.addEventListener("click", () => {
      if (state[key] === item.id) return;
      state[key] = item.id;
      for (const sibling of box.querySelectorAll(".chip")) {
        sibling.setAttribute("aria-pressed", String(sibling.dataset.value === item.id));
      }
      run();
    });
    box.appendChild(btn);
  }
}

/* ---------- fetch + assess ---------- */

async function run() {
  const token = ++inFlight;
  const location = config.locations.locations.find((l) => l.id === state.city);
  if (!location) return;

  setStatus(STRINGS.fetching(location["name_" + UI] ?? location.name_en), "loading");

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

    draw(report);
    setStatus("", "");
  } catch (err) {
    if (token !== inFlight) return;
    console.error(err);
    el("report").hidden = true;
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

function draw(report) {
  el("report").hidden = false;

  el("report-title").textContent = STRINGS.title(report.location.name, report.forecast_date);
  el("report-sub").textContent = STRINGS.sub(
    report.headline_window.label,
    STRINGS.profiles[state.profile] || state.profile,
    report.thresholds_version,
    (STRINGS.data && STRINGS.data[report.data_status]) || report.data_status
  );

  drawActivities(report);
  drawMetrics(report);
  drawFlags(report);
  drawEnsemble(report);
  drawWindows(report);

  el("telegram").innerHTML = renderFallback(report, config.i18n);
}

function drawActivities(report) {
  const box = el("activities");
  box.replaceChildren();

  for (const [activity, value] of Object.entries(report.activities)) {
    const card = document.createElement("div");
    card.className = "activity " + RATING_CLASS[value.rating];

    const head = document.createElement("div");
    head.className = "activity-head";

    const name = document.createElement("span");
    name.className = "activity-name";
    name.textContent = ACTIVITY_LABELS[activity] || activity;
    head.appendChild(name);

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = ratingWord(value.rating);
    head.appendChild(pill);

    card.appendChild(head);

    if (value.limits && value.limits.length) {
      const ul = document.createElement("ul");
      ul.className = "limits";
      for (const limit of value.limits) {
        const li = document.createElement("li");
        li.textContent = say(limit);
        ul.appendChild(li);
      }
      card.appendChild(ul);
    }

    if (value.best_window) {
      const better = document.createElement("p");
      better.className = "better-window";
      better.textContent = STRINGS.better(value.best_window.label, ratingWord(value.best_window.rating));
      card.appendChild(better);
    }

    box.appendChild(card);
  }
}

function drawMetrics(report) {
  const m = report.metrics;
  const L = STRINGS.metrics;
  const rows = [
    [L[0], fmt(m.wind?.mean_kt, "kt"), compass(m.wind?.direction_compass ?? null)],
    [L[1], fmt(m.wind?.gust_sustained_kt, "kt"), null],
    [L[2], fmt(m.wind?.gust_max_kt, "kt"), null],
    [L[3], fmt(m.wind?.gust_factor_at_peak, "×"), null],
    [L[4], fmt(m.waves?.max_m, "m"), null],
    [L[5], fmt(m.waves?.period_mean_s, "s"), null],
    [L[6], fmt(m.swell?.max_m, "m"), null],
    [L[7], fmt(m.sea?.sst_mean_c, "°C"), null],
    [L[8], fmt(m.weather?.air_temp_mean_c, "°C"), null],
    [L[9], fmt(m.weather?.precip_probability_max_pct, "%"), null],
  ];

  const box = el("metrics");
  box.replaceChildren();

  for (const [label, value, extra] of rows) {
    if (value === null) continue;
    const cell = document.createElement("div");
    cell.className = "metric";
    cell.appendChild(tag("span", "metric-label", label));
    cell.appendChild(tag("span", "metric-value", value + (extra ? " " + extra : "")));
    box.appendChild(cell);
  }
}

function fmt(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return num(value) + " " + unitWord(unit);
}

function drawFlags(report) {
  const box = el("flags");
  box.replaceChildren();

  if (!report.flags.length) {
    box.appendChild(tag("p", "panel-note", STRINGS.noFlags));
    return;
  }

  const list = document.createElement("ul");
  list.className = "flag-list";

  for (const flag of report.flags) {
    const li = document.createElement("li");
    li.className = "flag flag-" + flag.severity;

    const sev = document.createElement("span");
    sev.className = "flag-sev";
    sev.textContent = (STRINGS.severity && STRINGS.severity[flag.severity]) || flag.severity;
    li.appendChild(sev);

    const body = document.createElement("div");
    const flagName = UI === "fr" && config.i18n.fr.flags ? config.i18n.fr.flags[flag.code] : null;
    body.appendChild(tag("span", "flag-code", flagName ? flagName + " · " + flag.code : flag.code));
    body.appendChild(tag("span", "flag-reason", say(flag.reason)));
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
    {
      title: STRINGS.waveByModel,
      unit: "m",
      data: u.per_model_wave_max_m,
      spread: u.wave_spread_m,
      spreadUnit: "m",
    },
    {
      title: STRINGS.gustByModel,
      unit: "kt",
      data: u.per_model_gust_max_kt,
      spread: u.gust_spread_kt,
      spreadUnit: "kt",
    },
  ];

  let drew = false;

  for (const block of blocks) {
    if (!block.data || !Object.keys(block.data).length) continue;
    drew = true;

    const wrap = document.createElement("div");
    wrap.className = "spread-block";
    wrap.appendChild(tag("h4", null, block.title));

    const values = Object.values(block.data).filter((v) => typeof v === "number");
    const max = Math.max(...values, 0.0001);

    for (const [model, value] of Object.entries(block.data)) {
      const row = document.createElement("div");
      row.className = "spread-row";
      row.appendChild(tag("span", "spread-model mono", model));

      const barWrap = document.createElement("span");
      barWrap.className = "spread-bar-wrap";
      const bar = document.createElement("span");
      bar.className = "spread-bar";
      bar.style.width = Math.max(2, (value / max) * 100) + "%";
      barWrap.appendChild(bar);
      row.appendChild(barWrap);

      row.appendChild(tag("span", "spread-value mono", num(value) + " " + unitWord(block.unit)));
      wrap.appendChild(row);
    }

    const spread = document.createElement("p");
    spread.className = "spread-total";
    spread.textContent = STRINGS.spread(num(block.spread), unitWord(block.spreadUnit));
    wrap.appendChild(spread);

    box.appendChild(wrap);
  }

  if (!drew) {
    box.appendChild(
      tag("p", "panel-note", STRINGS.noModels)
    );
  }

  const models = document.createElement("p");
  models.className = "model-list";
  models.textContent = STRINGS.models((u.marine_models || []).join(", "), (u.atmospheric_models || []).join(", "));
  box.appendChild(models);
}

function drawWindows(report) {
  const body = el("windows-table").querySelector("tbody");
  body.replaceChildren();

  for (const w of report.windows) {
    const tr = document.createElement("tr");
    tr.appendChild(tag("td", null, w.label));
    tr.appendChild(tag("td", "mono", dash(w.wind_gust_kt, "kt")));
    tr.appendChild(tag("td", "mono", dash(w.wave_max_m, "m")));
    tr.appendChild(tag("td", "mono", dash(w.wave_period_s, "s")));
    tr.appendChild(ratingCell(w.ratings.sailing));
    tr.appendChild(ratingCell(w.ratings.swimming));
    body.appendChild(tr);
  }
}

function ratingCell(rating) {
  const td = document.createElement("td");
  const span = document.createElement("span");
  span.className = "pill pill-" + RATING_CLASS[rating];
  span.textContent = ratingWord(rating);
  td.appendChild(span);
  return td;
}

function dash(value, unit) {
  return value === null || value === undefined ? "—" : num(value) + " " + unitWord(unit);
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
const NB = " ";
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
  [/^(\d+) of (\d+) forecast models show thunderstorms in this window; the others do not\.$/, (m) => `${m[1]} modèles de prévision sur ${m[2]} annoncent des orages dans cette fenêtre ; les autres non.`],
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
  node.textContent = message;
  node.className = "status" + (kind ? " status-" + kind : "");
  node.hidden = !message;
}

boot();
