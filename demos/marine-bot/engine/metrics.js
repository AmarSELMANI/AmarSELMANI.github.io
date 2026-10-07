/**
 * Derived metrics for one forecast window.
 *
 * Two things here are easy to get wrong and are handled deliberately:
 *
 * 1. Direction is circular. The arithmetic mean of 350 deg and 10 deg is 180 -
 *    due south, the exact opposite of the true northerly mean. All bearings go
 *    through a vector (atan2) mean, and the length of the resultant vector
 *    doubles as a free measure of how steady the direction is.
 *
 * 2. Units come from the response, never from assumption. See src/units.js.
 */
import {
  compassPoint, kmhToKnots, lengthToM, round, speedToKmh, speedToMs, tempToC,
} from './units.js';

function values(hourly, name, idx) {
  const series = hourly?.[name];
  if (!Array.isArray(series)) return [];
  return idx.map((i) => series[i]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function max(arr) {
  return arr.length ? Math.max(...arr) : null;
}

function min(arr) {
  return arr.length ? Math.min(...arr) : null;
}

/**
 * Vector mean of a set of bearings.
 *
 * Returns the mean direction plus `steadiness` = the resultant length R in
 * [0,1]. R near 1 means every hour points the same way; R near 0 means the
 * direction is all over the place, which for sailing matters as much as the
 * speed does.
 */
export function circularMean(degrees) {
  if (!degrees.length) return { mean_deg: null, steadiness: null, variability: null };

  let sumSin = 0;
  let sumCos = 0;
  for (const d of degrees) {
    const rad = (d * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }

  const n = degrees.length;
  const meanSin = sumSin / n;
  const meanCos = sumCos / n;
  const R = Math.sqrt(meanSin * meanSin + meanCos * meanCos);

  let deg = (Math.atan2(meanSin, meanCos) * 180) / Math.PI;
  if (deg < 0) deg += 360;

  return { mean_deg: deg, steadiness: R, variability: 1 - R };
}

export function describeSteadiness(R) {
  if (R === null) return null;
  if (R >= 0.9) return 'steady';
  if (R >= 0.7) return 'mostly steady';
  if (R >= 0.4) return 'variable';
  return 'shifty';
}

/**
 * Compute every metric the assessment and the report need, for one window.
 *
 * Missing inputs produce `null` rather than a thrown error or a zero - a zero
 * would read as "flat calm" and could turn a data outage into a GOOD rating.
 */
export function computeWindowMetrics({ window, forecast, marine, thresholds }) {
  const fu = forecast?.hourly_units ?? {};
  const mu = marine?.hourly_units ?? {};
  const fh = forecast?.hourly ?? {};
  const mh = marine?.hourly ?? {};
  const fi = window.forecast_idx;
  const mi = window.marine_idx;

  // --- Wind ---------------------------------------------------------------
  const windRaw = values(fh, 'wind_speed_10m', fi);
  const gustRaw = values(fh, 'wind_gusts_10m', fi);
  const windKmh = windRaw.map((v) => speedToKmh(v, fu.wind_speed_10m ?? 'km/h'));
  const gustKmh = gustRaw.map((v) => speedToKmh(v, fu.wind_gusts_10m ?? 'km/h'));
  const windDir = circularMean(values(fh, 'wind_direction_10m', fi));

  // --- Waves --------------------------------------------------------------
  const waveM = values(mh, 'wave_height', mi).map((v) => lengthToM(v, mu.wave_height ?? 'm'));
  const wavePeriod = values(mh, 'wave_period', mi);
  const waveDir = circularMean(values(mh, 'wave_direction', mi));
  const swellM = values(mh, 'swell_wave_height', mi).map((v) => lengthToM(v, mu.swell_wave_height ?? 'm'));
  const swellPeriod = values(mh, 'swell_wave_period', mi);
  const swellDir = circularMean(values(mh, 'swell_wave_direction', mi));
  const windWaveM = values(mh, 'wind_wave_height', mi).map((v) => lengthToM(v, mu.wind_wave_height ?? 'm'));
  const windWavePeriod = values(mh, 'wind_wave_period', mi);

  // --- Sea ----------------------------------------------------------------
  const sstC = values(mh, 'sea_surface_temperature', mi)
    .map((v) => tempToC(v, mu.sea_surface_temperature ?? '°C'));
  const currentMs = values(mh, 'ocean_current_velocity', mi)
    .map((v) => speedToMs(v, mu.ocean_current_velocity ?? 'km/h'));
  const currentDir = circularMean(values(mh, 'ocean_current_direction', mi));

  // --- Weather ------------------------------------------------------------
  const precipProb = values(fh, 'precipitation_probability', fi);
  const precip = values(fh, 'precipitation', fi);
  const airTemp = values(fh, 'temperature_2m', fi).map((v) => tempToC(v, fu.temperature_2m ?? '°C'));
  const weatherCodes = values(fh, 'weather_code', fi);

  const windMeanKmh = mean(windKmh);
  const windMaxKmh = max(windKmh);
  const gustMaxKmh = max(gustKmh);
  const gustProfile = describeGustPeak(
    windKmh, gustKmh, thresholds.gust_policy?.min_sustained_hours ?? 2,
  );
  const waveMax = max(waveM);
  const wavePeriodMean = mean(wavePeriod);

  const completeness = assessCompleteness({ fh, mh, fi, mi, thresholds, window });

  return {
    window: {
      key: window.key,
      date: window.date,
      label: window.label,
      start_hour: window.start_hour,
      end_hour: window.end_hour,
      hours_covered: fi.length,
      marine_hours_covered: mi.length,
    },

    wind: {
      mean_kmh: round(windMeanKmh, 1),
      max_kmh: round(windMaxKmh, 1),
      mean_kt: round(kmhToKnots(windMeanKmh), 1),
      max_kt: round(kmhToKnots(windMaxKmh), 1),
      gust_max_kmh: round(gustMaxKmh, 1),
      gust_max_kt: round(kmhToKnots(gustMaxKmh), 1),
      direction_deg: round(windDir.mean_deg, 0),
      direction_compass: compassPoint(windDir.mean_deg),
      direction_steadiness: round(windDir.steadiness, 2),
      direction_description: describeSteadiness(windDir.steadiness),
      gust_factor_at_peak: round(gustProfile.factor, 1),
      gust_peak_hours: gustProfile.peak_hours,
      // The gust level actually held for the configured number of hours. This
      // is what drives ratings; gust_max_* stays the honest headline number and
      // is what the report shows the user.
      gust_sustained_kmh: round(gustProfile.sustained_kmh, 1),
      gust_sustained_kt: round(kmhToKnots(gustProfile.sustained_kmh), 1),
    },

    waves: {
      mean_m: round(mean(waveM), 2),
      max_m: round(waveMax, 2),
      period_mean_s: round(wavePeriodMean, 1),
      period_min_s: round(min(wavePeriod), 1),
      direction_deg: round(waveDir.mean_deg, 0),
      direction_compass: compassPoint(waveDir.mean_deg),
    },

    swell: {
      max_m: round(max(swellM), 2),
      mean_m: round(mean(swellM), 2),
      period_mean_s: round(mean(swellPeriod), 1),
      direction_deg: round(swellDir.mean_deg, 0),
      direction_compass: compassPoint(swellDir.mean_deg),
    },

    wind_wave: {
      max_m: round(max(windWaveM), 2),
      period_mean_s: round(mean(windWavePeriod), 1),
    },

    sea: {
      sst_mean_c: round(mean(sstC), 1),
      sst_min_c: round(min(sstC), 1),
      current_max_ms: round(max(currentMs), 2),
      current_mean_ms: round(mean(currentMs), 2),
      current_direction_deg: round(currentDir.mean_deg, 0),
      current_direction_compass: compassPoint(currentDir.mean_deg),
    },

    weather: {
      air_temp_mean_c: round(mean(airTemp), 1),
      air_temp_max_c: round(max(airTemp), 1),
      precip_probability_max_pct: max(precipProb),
      precip_total_mm: round(precip.reduce((a, b) => a + b, 0), 1),
      weather_codes: [...new Set(weatherCodes)].sort((a, b) => a - b),
      weather_code_max: max(weatherCodes),
    },

    completeness,
  };
}

/**
 * Characterises the peak gust: how far above the sustained wind it sits, and
 * how many hours it lasts.
 *
 * Real forecasts sometimes contain a single-hour gust spike an order of
 * magnitude above the sustained wind (observed in production data: 4.7 km/h
 * sustained with a 51.1 km/h gust). A gust factor above ~4 is not physically
 * typical - 1.3 to 2.0 is normal, up to ~3 in convective conditions - and one
 * such hour can drive a whole day to AVOID.
 *
 * The peak is NEVER discarded: a forecast gust is a hazard signal and the
 * conservative rating stands. This only lets the report tell the user the peak
 * is brief and anomalous, so they can weigh it and check another source.
 */
export function describeGustPeak(windKmh, gustKmh, minSustainedHours = 2) {
  if (!gustKmh.length) return { factor: null, peak_hours: 0, peak_kmh: null, sustained_kmh: null };

  const peak = Math.max(...gustKmh);
  const peakIdx = gustKmh.indexOf(peak);
  const sustainedAtPeak = windKmh[peakIdx];

  // Hours within 10% of the peak - i.e. how sustained the strong wind actually is.
  const peakHours = gustKmh.filter((g) => g >= peak * 0.9).length;

  // The strongest gust level actually reached for `minSustainedHours` hours:
  // sort descending and read off the Nth value. With N=2 this is the second
  // highest hour, so a lone spike cannot define the day while a genuine blow -
  // where many hours are strong - is unaffected.
  const descending = [...gustKmh].sort((a, b) => b - a);
  const sustained = descending[Math.min(minSustainedHours, descending.length) - 1];

  const factor = sustainedAtPeak && sustainedAtPeak > 0 ? peak / sustainedAtPeak : null;
  return { factor, peak_hours: peakHours, peak_kmh: peak, sustained_kmh: sustained };
}

/**
 * Data-quality gate.
 *
 * `essential` fields decide whether the window can be assessed at all.
 * `degrading` fields only narrow what can be said (see thresholds.data_quality),
 * because coastal models return currents and sea temperature inconsistently and
 * a strict rule there would mark every day AVOID.
 */
function assessCompleteness({ fh, mh, fi, mi, thresholds, window }) {
  const dq = thresholds.data_quality;
  const minHours = Math.min(dq.min_hours_per_window, Math.max(fi.length, 1));
  const perField = {};
  const missing = [];

  for (const field of dq.essential) {
    const inForecast = Object.prototype.hasOwnProperty.call(fh, field);
    const source = inForecast ? fh : mh;
    const idx = inForecast ? fi : mi;
    const present = values(source, field, idx).length;
    const expected = idx.length || 1;

    perField[field] = { present, expected, coverage: round(present / expected, 2) };
    if (present < minHours) missing.push(field);
  }

  const degraded = [];
  for (const field of Object.keys(dq.degrading)) {
    const inForecast = Object.prototype.hasOwnProperty.call(fh, field);
    const source = inForecast ? fh : mh;
    const idx = inForecast ? fi : mi;
    if (values(source, field, idx).length < minHours) degraded.push(field);
  }

  const coverages = Object.values(perField).map((f) => f.coverage);
  const score = coverages.length ? round(coverages.reduce((a, b) => a + b, 0) / coverages.length, 2) : 0;

  return {
    score,
    essential_ok: missing.length === 0 && score >= dq.min_completeness_score,
    missing_essential: missing,
    degraded_fields: degraded,
    per_field: perField,
    hours_in_window: window.forecast_idx.length,
  };
}
