/**
 * Multi-model ensemble handling.
 *
 * WHY THIS EXISTS
 *
 * Measured against the live API for all six sites on a calm day
 * (scripts/model-spread.mjs, scripts/wind-spread.mjs):
 *
 *   wave height   models disagreed by 0.33 m on average, up to 0.62 m
 *                 (the swimming CAUTION band is 0.50 m wide)
 *   peak gust     models disagreed by 10.9 kt on average
 *                 (the sailing CAUTION band is 5 kt wide)
 *
 * At Skikda the wave forecast ranged 0.44-1.06 m for the same hour. Reporting
 * any single model's figure as "the" wave height states a precision the data
 * does not have, and the disagreement is wider than the rating boundaries it
 * feeds. So the bot asks several models and combines them.
 *
 * HOW IT COMBINES
 *
 * Element-wise, hour by hour, in whichever direction is CONSERVATIVE for that
 * variable - the highest waves, the shortest period, the coldest water. The
 * result is an envelope: a worst-plausible-case series that no single model
 * predicts, which is the appropriate basis for a safety rating.
 *
 * The disagreement itself is kept and reported, because "the models do not
 * agree" is information the user needs, not noise to hide.
 */

/**
 * Which direction is pessimistic for each variable.
 *
 * Getting this backwards would be dangerous rather than merely wrong: taking
 * the MAXIMUM wave period would make a steep, dangerous sea look like a long,
 * comfortable swell.
 */
const CONSERVATIVE = {
  // Higher is worse.
  wave_height: 'max',
  wind_wave_height: 'max',
  swell_wave_height: 'max',
  wind_speed_10m: 'max',
  wind_gusts_10m: 'max',
  ocean_current_velocity: 'max',
  precipitation: 'max',
  precipitation_probability: 'max',

  // Categorical, so neither 'max' nor 'min' is meaningful: WMO codes are labels
  // that happen to be numbers. 'max' ranks snow (71) above heavy rain (65) and
  // fog (45) above overcast (3), and - measured here - let a single model's
  // convective scheme decide the day. Across all six sites, ukmo_seamless
  // produced 32 of the 33 forecast thunderstorm hours while icon_eu produced
  // none; under 'max' that flagged thunderstorms on 12 of 18 site-days in
  // settled late-August weather. A majority vote gives 1 of 18. The dissenting
  // model is not discarded - it is reported separately as a caution.
  weather_code: 'vote',

  // Lower is worse.
  wave_period: 'min',
  wind_wave_period: 'min',
  swell_wave_period: 'min',
  sea_surface_temperature: 'min',

  // Directions and air temperature have no meaningful "worse" end; a circular
  // mean of several models is not defensible either, so the first model that
  // has data wins.
  wave_direction: 'first',
  wind_wave_direction: 'first',
  swell_wave_direction: 'first',
  wind_direction_10m: 'first',
  ocean_current_direction: 'first',
  temperature_2m: 'first',
};

/** Variables whose model disagreement is worth reporting to the user. */
const SPREAD_TRACKED = ['wave_height', 'wind_gusts_10m'];

/**
 * WMO weather codes that mean thunderstorm. Kept here as well as in the
 * threshold config because the vote needs a severity order, and a tie between
 * two models must never resolve in favour of the calmer sky.
 */
const SEVERE_CODES = new Set([95, 96, 99]);

/** Severity rank for tie-breaking a vote. Higher is worse. */
function codeSeverity(code) {
  if (code === null || code === undefined) return -1;
  if (SEVERE_CODES.has(code)) return 6;
  if (code >= 71 && code <= 77) return 5;
  if (code >= 85 && code <= 86) return 5;
  if (code >= 80 && code <= 82) return 4;
  if (code >= 61 && code <= 67) return 3;
  if (code >= 51 && code <= 57) return 2;
  if (code === 45 || code === 48) return 1;
  return 0;
}

/**
 * Splits an Open-Meteo multi-model response into { variable: { model: series } }.
 *
 * With `&models=a,b`, keys arrive suffixed: `wave_height_a`, `wave_height_b`.
 * A single-model response has plain keys, which this treats as a one-member
 * ensemble so the rest of the pipeline is identical either way.
 */
export function splitByModel(hourly, models) {
  const byVariable = {};

  for (const key of Object.keys(hourly ?? {})) {
    if (key === 'time') continue;

    const model = models.find((m) => key.endsWith(`_${m}`));
    const variable = model ? key.slice(0, -(model.length + 1)) : key;

    byVariable[variable] ??= {};
    byVariable[variable][model ?? '_single'] = hourly[key];
  }

  return byVariable;
}

function combine(series, how) {
  const present = series.filter((s) => Array.isArray(s));
  if (!present.length) return { values: [], models: 0 };

  const length = Math.max(...present.map((s) => s.length));
  const values = [];

  for (let i = 0; i < length; i++) {
    const hour = present.map((s) => s[i]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));

    if (!hour.length) { values.push(null); continue; }
    if (how === 'max') values.push(Math.max(...hour));
    else if (how === 'min') values.push(Math.min(...hour));
    else if (how === 'vote') values.push(vote(hour));
    else values.push(hour[0]);
  }

  return { values, models: present.length };
}

/**
 * Consensus weather code for one hour.
 *
 * Severe weather needs at least half the models behind it. Three models
 * disagreeing three ways is not a majority for anything, and letting the most
 * severe code win such a split reproduces the very bug this replaces: one
 * model's convective scheme deciding the day. A severe forecast that loses the
 * vote is not discarded - `ensembleUncertainty` reports it, and it still bars a
 * GOOD rating.
 *
 * Among non-severe codes the most-predicted wins, ties going to the worse sky.
 */
function vote(hour) {
  const severe = hour.filter((v) => SEVERE_CODES.has(v));
  if (severe.length * 2 >= hour.length && severe.length > 0) {
    return mostCommon(severe);
  }
  const rest = hour.filter((v) => !SEVERE_CODES.has(v));
  return rest.length ? mostCommon(rest) : mostCommon(hour);
}

/** Most frequent value; ties resolve to the more severe code. */
function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  let best = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && codeSeverity(value) > codeSeverity(best))) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Largest gap between models at any single hour. */
function maxSpread(series) {
  const present = series.filter((s) => Array.isArray(s));
  if (present.length < 2) return null;

  const length = Math.max(...present.map((s) => s.length));
  let worst = 0;

  for (let i = 0; i < length; i++) {
    const hour = present.map((s) => s[i]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
    if (hour.length < 2) continue;
    worst = Math.max(worst, Math.max(...hour) - Math.min(...hour));
  }

  return worst;
}

/**
 * Collapses a multi-model response into a single conservative series, shaped
 * exactly like an ordinary single-model response so nothing downstream needs to
 * know an ensemble was involved.
 *
 * Adds `ensemble` metadata describing how many models contributed and how far
 * apart they were.
 */
export function collapseEnsemble(response, models = []) {
  if (!response?.hourly?.time) return response;

  const byVariable = splitByModel(response.hourly, models);
  const hourly = { time: response.hourly.time };
  const perVariable = {};
  const contributing = new Set();

  for (const [variable, perModel] of Object.entries(byVariable)) {
    const modelNames = Object.keys(perModel);
    const series = Object.values(perModel);
    const how = CONSERVATIVE[variable] ?? 'first';

    const { values, models: count } = combine(series, how);
    hourly[variable] = values;

    // A model that returns only nulls at this point is not part of the ensemble.
    const withData = modelNames.filter((m) => (perModel[m] ?? []).some((v) => v !== null && v !== undefined));
    withData.forEach((m) => { if (m !== '_single') contributing.add(m); });

    perVariable[variable] = {
      combined_by: how,
      models_with_data: withData.length,
      model_count: count,
    };

    // Retained so a minority severe-weather forecast can still be reported.
    if (variable === 'weather_code') {
      perVariable[variable].per_model_series = Object.fromEntries(
        withData.map((m) => [m, perModel[m] ?? []]),
      );
    }

    if (SPREAD_TRACKED.includes(variable)) {
      perVariable[variable].max_spread = maxSpread(series);
      perVariable[variable].per_model_max = Object.fromEntries(
        withData.map((m) => {
          const vals = (perModel[m] ?? []).filter((v) => v !== null && v !== undefined);
          return [m, vals.length ? Math.max(...vals) : null];
        }),
      );
      // Retained so disagreement can be recomputed for the hours actually being
      // reported. The whole-series figures above span every fetched day and hour,
      // including nights, which overstates the spread for a single daytime window.
      perVariable[variable].per_model_series = Object.fromEntries(
        withData.map((m) => [m, perModel[m] ?? []]),
      );
    }
  }

  // Units arrive suffixed too; strip the suffix so downstream lookups work.
  const hourlyUnits = {};
  for (const [key, unit] of Object.entries(response.hourly_units ?? {})) {
    const model = models.find((m) => key.endsWith(`_${m}`));
    hourlyUnits[model ? key.slice(0, -(model.length + 1)) : key] = unit;
  }

  return {
    ...response,
    hourly,
    hourly_units: hourlyUnits,
    ensemble: {
      requested: models,
      contributing: [...contributing].sort(),
      model_count: contributing.size || 1,
      variables: perVariable,
    },
  };
}

/**
 * Disagreement between models over a specific set of hours, in the units the
 * report uses.
 *
 * `wave_spread_m` and `gust_spread_kt` are the numbers the uncertainty flag and
 * the reported ranges are built from.
 *
 * SCOPE MATTERS, AND GETTING IT WRONG IS NOT A ROUNDING ERROR. Measured over a
 * whole three-day fetch including nights, the daytime gust spread at these six
 * sites reads 11-17 kt; measured over the day actually being reported it is
 * 0.4-8.4 kt (median 4.6). Against a 10 kt threshold that is the difference
 * between a flag that never fires and one that fires on every report, caps
 * every activity at CAUTION, and so carries no information at all.
 *
 * Pass the window's index arrays. Without them this falls back to the whole
 * series, which is only correct when the caller fetched exactly one window.
 */
export function ensembleUncertainty({ forecast, marine, forecastIdx = null, marineIdx = null }) {
  const KMH_PER_KNOT = 1.852;

  const waveVar = marine?.ensemble?.variables?.wave_height;
  const gustVar = forecast?.ensemble?.variables?.wind_gusts_10m;

  const scopedMax = (variable, idx) => {
    const series = variable?.per_model_series;
    if (!series || !Array.isArray(idx)) return null;
    const out = {};
    for (const [model, values] of Object.entries(series)) {
      const picked = idx.map((i) => values[i]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
      out[model] = picked.length ? Math.max(...picked) : null;
    }
    return out;
  };

  const scopedSpread = (variable, idx) => {
    const series = variable?.per_model_series;
    if (!series || !Array.isArray(idx)) return null;
    const arrays = Object.values(series);
    if (arrays.length < 2) return null;
    let worst = 0;
    for (const i of idx) {
      const hour = arrays.map((a) => a[i]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
      if (hour.length < 2) continue;
      worst = Math.max(worst, Math.max(...hour) - Math.min(...hour));
    }
    return worst;
  };

  // Which models forecast a thunderstorm within the window, whether or not the
  // vote carried it. A minority forecast is real information and must not be
  // silently outvoted - it is reported as a caution instead of an AVOID.
  const severeVar = forecast?.ensemble?.variables?.weather_code;
  const severeModels = [];
  if (severeVar?.per_model_series && Array.isArray(forecastIdx)) {
    for (const [model, values] of Object.entries(severeVar.per_model_series)) {
      if (forecastIdx.some((i) => SEVERE_CODES.has(values[i]))) severeModels.push(model);
    }
  }

  const waveModels = scopedMax(waveVar, marineIdx) ?? waveVar?.per_model_max ?? {};
  const gustModels = scopedMax(gustVar, forecastIdx) ?? gustVar?.per_model_max ?? {};
  const waveSpread = scopedSpread(waveVar, marineIdx) ?? waveVar?.max_spread ?? null;
  const gustSpread = scopedSpread(gustVar, forecastIdx) ?? gustVar?.max_spread ?? null;

  const gustModelsKt = Object.fromEntries(
    Object.entries(gustModels).map(([m, v]) => [m, v === null ? null : Math.round((v / KMH_PER_KNOT) * 10) / 10]),
  );

  const round = (v, d) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);

  return {
    marine_models: marine?.ensemble?.contributing ?? [],
    atmospheric_models: forecast?.ensemble?.contributing ?? [],
    marine_model_count: marine?.ensemble?.model_count ?? 1,
    atmospheric_model_count: forecast?.ensemble?.model_count ?? 1,

    wave_spread_m: round(waveSpread, 2),
    gust_spread_kt: round(gustSpread == null ? null : gustSpread / KMH_PER_KNOT, 1),

    wave_range_m: rangeOf(Object.values(waveModels), 2),
    gust_range_kt: rangeOf(Object.values(gustModelsKt), 1),

    per_model_wave_max_m: waveModels,
    per_model_gust_max_kt: gustModelsKt,

    severe_weather_models: severeModels.sort(),
    severe_weather_model_count: severeModels.length,
  };
}

/**
 * Merges a second response's series into a multi-model one, aligned by
 * timestamp.
 *
 * The wave models (EWAM, GWAM, WAM, Météo-France) carry sea state only - no
 * sea-surface temperature and no currents. Pinning the model list therefore
 * silently dropped two variables that the default aggregate does provide, which
 * capped swimming at CAUTION every single day for a missing-data reason that
 * was self-inflicted.
 *
 * So those variables come from a separate unpinned request and are merged here.
 * They arrive with plain, unsuffixed keys, which collapseEnsemble treats as a
 * single-member ensemble - no special casing needed downstream.
 */
export function mergeByTime(base, extra, variables) {
  if (!base?.hourly?.time || !extra?.hourly?.time) return base;

  const index = new Map(extra.hourly.time.map((t, i) => [String(t).slice(0, 16), i]));
  const hourly = { ...base.hourly };
  const units = { ...(base.hourly_units ?? {}) };

  for (const variable of variables) {
    const source = extra.hourly[variable];
    if (!Array.isArray(source)) continue;

    hourly[variable] = base.hourly.time.map((t) => {
      const i = index.get(String(t).slice(0, 16));
      return i === undefined ? null : source[i];
    });

    if (extra.hourly_units?.[variable]) units[variable] = extra.hourly_units[variable];
  }

  return { ...base, hourly, hourly_units: units };
}

function rangeOf(values, decimals) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length < 2) return null;
  const f = 10 ** decimals;
  return {
    min: Math.round(Math.min(...present) * f) / f,
    max: Math.round(Math.max(...present) * f) / f,
  };
}
