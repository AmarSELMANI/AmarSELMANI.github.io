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

const PROFILES = [
  { id: "beginner", label: "Beginner" },
  { id: "recreational", label: "Recreational" },
  { id: "experienced", label: "Experienced" },
];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const RATING_CLASS = { GOOD: "good", CAUTION: "warn", AVOID: "bad" };

const ACTIVITY_LABELS = {
  sailing: "Sailing",
  fishing_shore: "Fishing — shore",
  fishing_small_boat: "Fishing — small boat",
  swimming: "Swimming",
};

let config = null;
let state = { city: "algiers", profile: "recreational", language: "en" };
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
    setStatus("Could not load the bot's configuration files.", "error");
    console.error(err);
    return;
  }

  buildChips("cities", config.locations.locations.map((l) => ({ id: l.id, label: l.name_en })), "city");
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

  setStatus("Fetching the live forecast for " + location.name_en + "…", "loading");

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
    setStatus(
      "The forecast could not be fetched. Open-Meteo may be rate-limiting or briefly unavailable — " +
        "no stale data is shown instead. Try again in a moment.",
      "error"
    );
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

  el("report-title").textContent = report.location.name + " — " + report.forecast_date;
  el("report-sub").textContent =
    report.headline_window.label +
    " · " +
    state.profile +
    " · thresholds v" +
    report.thresholds_version +
    " · data " +
    report.data_status;

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
    pill.textContent = value.rating;
    head.appendChild(pill);

    card.appendChild(head);

    if (value.limits && value.limits.length) {
      const ul = document.createElement("ul");
      ul.className = "limits";
      for (const limit of value.limits) {
        const li = document.createElement("li");
        li.textContent = limit;
        ul.appendChild(li);
      }
      card.appendChild(ul);
    }

    if (value.best_window) {
      const better = document.createElement("p");
      better.className = "better-window";
      better.textContent =
        "Better window: " + value.best_window.label + " (" + value.best_window.rating + ")";
      card.appendChild(better);
    }

    box.appendChild(card);
  }
}

function drawMetrics(report) {
  const m = report.metrics;
  const rows = [
    ["Wind", fmt(m.wind?.mean_kt, "kt"), m.wind?.direction_compass ?? null],
    ["Gust held 2h+", fmt(m.wind?.gust_sustained_kt, "kt"), null],
    ["Peak gust", fmt(m.wind?.gust_max_kt, "kt"), null],
    ["Gust factor at peak", fmt(m.wind?.gust_factor_at_peak, "×"), null],
    ["Waves (max)", fmt(m.waves?.max_m, "m"), null],
    ["Wave period", fmt(m.waves?.period_mean_s, "s"), null],
    ["Swell (max)", fmt(m.swell?.max_m, "m"), null],
    ["Sea temperature", fmt(m.sea?.sst_mean_c, "°C"), null],
    ["Air temperature", fmt(m.weather?.air_temp_mean_c, "°C"), null],
    ["Rain chance", fmt(m.weather?.precip_probability_max_pct, "%"), null],
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
  return value + " " + unit;
}

function drawFlags(report) {
  const box = el("flags");
  box.replaceChildren();

  if (!report.flags.length) {
    box.appendChild(tag("p", "panel-note", "No flags raised for this window."));
    return;
  }

  const list = document.createElement("ul");
  list.className = "flag-list";

  for (const flag of report.flags) {
    const li = document.createElement("li");
    li.className = "flag flag-" + flag.severity;

    const sev = document.createElement("span");
    sev.className = "flag-sev";
    sev.textContent = flag.severity;
    li.appendChild(sev);

    const body = document.createElement("div");
    body.appendChild(tag("span", "flag-code", flag.code));
    body.appendChild(tag("span", "flag-reason", flag.reason));
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
      title: "Max wave height by model",
      unit: "m",
      data: u.per_model_wave_max_m,
      spread: u.wave_spread_m,
      spreadUnit: "m",
    },
    {
      title: "Max gust by model",
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

      row.appendChild(tag("span", "spread-value mono", value + " " + block.unit));
      wrap.appendChild(row);
    }

    const spread = document.createElement("p");
    spread.className = "spread-total";
    spread.textContent = "Spread: " + block.spread + " " + block.spreadUnit;
    wrap.appendChild(spread);

    box.appendChild(wrap);
  }

  if (!drew) {
    box.appendChild(
      tag("p", "panel-note", "Per-model figures are not available for this request.")
    );
  }

  const models = document.createElement("p");
  models.className = "model-list";
  models.textContent =
    "Marine: " +
    (u.marine_models || []).join(", ") +
    " · Atmospheric: " +
    (u.atmospheric_models || []).join(", ");
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
  span.textContent = rating;
  td.appendChild(span);
  return td;
}

function dash(value, unit) {
  return value === null || value === undefined ? "—" : value + " " + unit;
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
