/**
 * Entry point for the deterministic pipeline.
 *
 * raw API responses -> windows -> metrics -> assessment -> report object
 *
 * Everything downstream (the LLM prompt, the validator, both renderers) reads
 * the object this returns. Nothing downstream is allowed to change a rating.
 */
import { selectWindows, localDate, localHour, upcomingWindows } from './windows.js';
import { computeWindowMetrics } from './metrics.js';
import { assess, bestWindow, ACTIVITIES, RATING } from './assess.js';
import { collapseEnsemble, ensembleUncertainty, mergeByTime } from './ensemble.js';

/**
 * Sea state that the pinned wave models do not carry, and which therefore comes
 * from a separate unpinned request. See mergeByTime.
 */
const SEA_STATE_VARIABLES = [
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
];

export { RATING, ACTIVITIES };

export function buildReport({
  forecast,
  marine,
  location,
  language = 'en',
  profile = 'recreational',
  alerts = { checked: false },
  thresholds,
  timezone = 'Africa/Algiers',
  now = new Date(),
  date = null,
  marineModels = [],
  atmosphericModels = [],
  seaState = null,
}) {
  const forecastDate = date ?? localDate(timezone, now);
  const currentHour = localHour(timezone, now);

  // Collapse the multi-model responses to a single conservative series before
  // anything else looks at them. A single-model response passes through
  // unchanged, so this is safe whether or not an ensemble was requested.
  const forecastEnsemble = collapseEnsemble(forecast, atmosphericModels);
  const marineEnsemble = seaState
    ? mergeByTime(collapseEnsemble(marine, marineModels), seaState, SEA_STATE_VARIABLES)
    : collapseEnsemble(marine, marineModels);
  const windows = selectWindows({
    forecast: forecastEnsemble, marine: marineEnsemble, thresholds, date: forecastDate,
  });

  // Scoped to the reported day, not the whole fetch. Measuring disagreement over
  // three days and both nights inflates it several-fold and made the uncertainty
  // flag fire on every single report - see ensembleUncertainty.
  const dayWindow = windows.find((w) => w.key === 'day');
  const uncertainty = ensembleUncertainty({
    forecast: forecastEnsemble,
    marine: marineEnsemble,
    forecastIdx: dayWindow?.forecast_idx ?? null,
    marineIdx: dayWindow?.marine_idx ?? null,
  });

  const windowAssessments = windows.map((window) => {
    const metrics = computeWindowMetrics({
      window, forecast: forecastEnsemble, marine: marineEnsemble, thresholds,
    });
    return {
      key: window.key,
      label: window.label,
      metrics,
      assessment: assess({ metrics, thresholds, profile, alerts, uncertainty }),
    };
  });

  const day = windowAssessments.find((w) => w.key === 'day');
  if (!day) throw new Error('The "day" window is required but was not produced');

  // Best remaining window per activity, restricted to windows not already past.
  const stillAhead = new Set(
    upcomingWindows(windows, currentHour).map((w) => w.key),
  );
  const relevant = windowAssessments.filter((w) => w.key === 'day' || stillAhead.has(w.key));

  const best = {};
  for (const activity of ACTIVITIES) {
    const dayRating = day.assessment.activities[activity].rating;
    const candidate = bestWindow({ windowAssessments: relevant, activity });
    // Only surface a window that genuinely beats the day as a whole.
    best[activity] = candidate && candidate.assessment.activities[activity].rating !== dayRating
      ? { key: candidate.key, label: candidate.label, rating: candidate.assessment.activities[activity].rating }
      : null;
  }

  return {
    schema_version: '1.0.0',
    thresholds_version: thresholds.version,
    generated_at: new Date(now).toISOString(),
    location: {
      id: location.id,
      name: location[`name_${language}`] ?? location.name_en,
      latitude: location.latitude,
      longitude: location.longitude,
      exposure: location.exposure ?? null,
    },
    language,
    profile,
    forecast_date: forecastDate,
    timezone,
    request_hour_local: currentHour,
    headline_window: { key: day.key, label: day.label },
    activities: Object.fromEntries(
      ACTIVITIES.map((a) => [a, {
        rating: day.assessment.activities[a].rating,
        limits: day.assessment.activities[a].limits,
        best_window: best[a],
      }]),
    ),
    metrics: day.metrics,
    flags: day.assessment.flags,
    windows: windowAssessments.map((w) => ({
      key: w.key,
      label: w.label,
      ratings: Object.fromEntries(
        ACTIVITIES.map((a) => [a, w.assessment.activities[a].rating]),
      ),
      wind_gust_kt: w.metrics.wind.gust_max_kt,
      wave_max_m: w.metrics.waves.max_m,
      wave_period_s: w.metrics.waves.period_mean_s,
    })),
    data_status: day.assessment.data_status,
    official_alerts_checked: day.assessment.official_alerts_checked,
    uncertainty,
    sources: {
      atmospheric: 'Open-Meteo Forecast API',
      marine: 'Open-Meteo Marine API',
      atmospheric_models: uncertainty.atmospheric_models,
      marine_models: uncertainty.marine_models,
      alerts: alerts?.checked ? (alerts.source ?? 'unknown') : null,
    },
  };
}
