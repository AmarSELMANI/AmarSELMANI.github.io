/**
 * Deterministic safety assessment. No LLM is involved here, and none ever
 * should be - this module is the thing the report is allowed to claim.
 *
 * Structure:
 *   1. Threshold criteria produce a per-activity rating from the numbers.
 *   2. Flags are computed independently and carry an explicit severity.
 *   3. A flag can only ever make a rating WORSE (`worst()`), never better.
 *
 * The invariant that matters, enforced by construction and asserted in tests:
 * an activity can never be rated GOOD while a high_risk flag affecting it
 * exists.
 */

export const RATING = { GOOD: 'GOOD', CAUTION: 'CAUTION', AVOID: 'AVOID' };
const RANK = { GOOD: 0, CAUTION: 1, AVOID: 2 };
export const ACTIVITIES = ['sailing', 'fishing_shore', 'fishing_small_boat', 'swimming'];

/** The only way ratings are ever combined. Monotonic: result is never better than either input. */
export function worst(...ratings) {
  return ratings
    .filter(Boolean)
    .reduce((acc, r) => (RANK[r] > RANK[acc] ? r : acc), RATING.GOOD);
}

const SEVERITY_TO_RATING = {
  info: RATING.GOOD,
  caution: RATING.CAUTION,
  high_risk: RATING.AVOID,
};

/**
 * The gust value a rating is based on.
 *
 * See thresholds.gust_policy for why this defaults to the sustained value
 * rather than the single worst hour. The peak is never discarded - it drives
 * the GUST_SPIKE flag below, which caps a spiky day at CAUTION.
 */
function ratingGust(metrics, thresholds) {
  const basis = thresholds.gust_policy?.rating_basis ?? 'sustained';
  if (basis === 'peak') return metrics.wind.gust_max_kt;
  return metrics.wind.gust_sustained_kt ?? metrics.wind.gust_max_kt;
}

/** Which metric each threshold criterion reads. */
const CRITERION_METRIC = {
  gust_kt: (m, t) => ratingGust(m, t),
  wind_kt: (m) => m.wind.mean_kt,
  wave_m: (m) => m.waves.max_m,
  period_s: (m) => m.waves.period_mean_s,
  current_ms: (m) => m.sea.current_max_ms,
  sst_c: (m) => m.sea.sst_mean_c,
  precip_prob_pct: (m) => m.weather.precip_probability_max_pct,
};

const CRITERION_LABEL = {
  gust_kt: 'maximum gust',
  wind_kt: 'mean wind',
  wave_m: 'maximum wave height',
  period_s: 'wave period',
  current_ms: 'surface current',
  sst_c: 'sea temperature',
  precip_prob_pct: 'rain probability',
};

const UNIT_SUFFIX = {
  gust_kt: ' kt',
  wind_kt: ' kt',
  wave_m: ' m',
  period_s: ' s',
  current_ms: ' m/s',
  sst_c: ' °C',
  precip_prob_pct: '%',
};

function fmt(criterion, value) {
  return `${value}${UNIT_SUFFIX[criterion] ?? ''}`;
}

/**
 * Rate one criterion. Handles both "higher is worse" (gust, waves) and
 * "lower is worse" (sea temperature) bounds, plus the period comfort floor.
 */
function rateCriterion(criterion, bounds, value) {
  if (value === null || value === undefined) {
    return { criterion, value: null, rating: null, known: false };
  }

  let rating = RATING.GOOD;
  let detail = null;

  if (bounds.avoid_above !== undefined && value > bounds.avoid_above) {
    rating = RATING.AVOID;
    detail = `${CRITERION_LABEL[criterion]} ${fmt(criterion, value)} exceeds the AVOID limit of ${fmt(criterion, bounds.avoid_above)}`;
  } else if (bounds.good_max !== undefined && value > bounds.good_max) {
    rating = RATING.CAUTION;
    detail = `${CRITERION_LABEL[criterion]} ${fmt(criterion, value)} is above the GOOD limit of ${fmt(criterion, bounds.good_max)}`;
  }

  if (bounds.avoid_below !== undefined && value < bounds.avoid_below) {
    rating = worst(rating, RATING.AVOID);
    detail = `${CRITERION_LABEL[criterion]} ${fmt(criterion, value)} is below the AVOID limit of ${fmt(criterion, bounds.avoid_below)}`;
  } else if (bounds.good_min !== undefined && value < bounds.good_min) {
    rating = worst(rating, RATING.CAUTION);
    detail = `${CRITERION_LABEL[criterion]} ${fmt(criterion, value)} is below the GOOD limit of ${fmt(criterion, bounds.good_min)}`;
  }

  if (bounds.comfort_min !== undefined && value < bounds.comfort_min) {
    rating = worst(rating, RATING.CAUTION);
    detail = `${CRITERION_LABEL[criterion]} ${fmt(criterion, value)} is short of the ${fmt(criterion, bounds.comfort_min)} comfort floor, implying steep, closely spaced waves`;
  }

  return { criterion, value, rating, known: true, detail, bounds };
}

/**
 * Build the flag list. Every flag carries the values that produced it so the
 * report - and anyone auditing a rating later - can see exactly why.
 */
export function computeFlags({ metrics, thresholds, alerts, uncertainty = null }) {
  const cfg = thresholds.flags;
  const flags = [];
  const add = (code, severity, reason, values, affects) =>
    flags.push({ code, severity, reason, values, affects });

  const gustPeak = metrics.wind.gust_max_kt;
  const gust = ratingGust(metrics, thresholds);
  const wave = metrics.waves.max_m;
  const period = metrics.waves.period_mean_s;
  const current = metrics.sea.current_max_ms;
  const sst = metrics.sea.sst_mean_c;
  const codes = metrics.weather.weather_codes ?? [];

  // Data quality first: it can invalidate everything below it.
  if (!metrics.completeness.essential_ok) {
    add(
      'DATA_INCOMPLETE',
      'high_risk',
      `Essential forecast data is missing or too sparse to assess (${metrics.completeness.missing_essential.join(', ') || 'insufficient hourly coverage'}).`,
      { missing: metrics.completeness.missing_essential, score: metrics.completeness.score },
      ACTIVITIES,
    );
  }

  if (gust !== null) {
    // Phrased around what the wind actually does for a sustained period; the
    // peak is reported separately so both numbers reach the user.
    if (gust > cfg.HIGH_WIND.high_risk_gust_kt) {
      add('HIGH_WIND', 'high_risk',
        `Gusts hold at ${gust} kt or above, past the ${cfg.HIGH_WIND.high_risk_gust_kt} kt high-risk threshold (peak ${gustPeak} kt).`,
        { gust_kt: gust, gust_peak_kt: gustPeak }, cfg.HIGH_WIND.affects);
    } else if (gust > cfg.HIGH_WIND.caution_gust_kt) {
      add('HIGH_WIND', 'caution',
        `Gusts hold at ${gust} kt or above, past the ${cfg.HIGH_WIND.caution_gust_kt} kt caution threshold (peak ${gustPeak} kt).`,
        { gust_kt: gust, gust_peak_kt: gustPeak }, cfg.HIGH_WIND.affects);
    }
  }

  if (wave !== null) {
    if (wave > cfg.HIGH_WAVES.high_risk_wave_m) {
      add('HIGH_WAVES', 'high_risk',
        `Waves reach ${wave} m, above the ${cfg.HIGH_WAVES.high_risk_wave_m} m high-risk threshold.`,
        { wave_m: wave }, cfg.HIGH_WAVES.affects);
    } else if (wave > cfg.HIGH_WAVES.caution_wave_m) {
      add('HIGH_WAVES', 'caution',
        `Waves reach ${wave} m, above the ${cfg.HIGH_WAVES.caution_wave_m} m caution threshold.`,
        { wave_m: wave }, cfg.HIGH_WAVES.affects);
    }
  }

  // Steep chop: the same wave height is a very different sea at 4 s than at 9 s.
  if (wave !== null && period !== null) {
    const hr = cfg.SHORT_PERIOD_CHOP.high_risk;
    const ca = cfg.SHORT_PERIOD_CHOP.caution;
    if (wave >= hr.wave_m && period < hr.period_s) {
      add('SHORT_PERIOD_CHOP', 'high_risk',
        `${wave} m waves at only ${period} s produce steep, closely spaced seas.`,
        { wave_m: wave, period_s: period }, cfg.SHORT_PERIOD_CHOP.affects);
    } else if (wave >= ca.wave_m && period < ca.period_s) {
      add('SHORT_PERIOD_CHOP', 'caution',
        `${wave} m waves at ${period} s make for short, uncomfortable chop.`,
        { wave_m: wave, period_s: period }, cfg.SHORT_PERIOD_CHOP.affects);
    }
  }

  if (current !== null) {
    if (current > cfg.STRONG_CURRENT.high_risk_ms) {
      add('STRONG_CURRENT', 'high_risk',
        `Forecast surface current of ${current} m/s exceeds the ${cfg.STRONG_CURRENT.high_risk_ms} m/s high-risk threshold.`,
        { current_ms: current }, cfg.STRONG_CURRENT.affects);
    } else if (current > cfg.STRONG_CURRENT.caution_ms) {
      add('STRONG_CURRENT', 'caution',
        `Forecast surface current of ${current} m/s exceeds the ${cfg.STRONG_CURRENT.caution_ms} m/s caution threshold.`,
        { current_ms: current }, cfg.STRONG_CURRENT.affects);
    }
  }

  const severe = codes.filter((c) => cfg.THUNDERSTORM_OR_SEVERE_WEATHER.weather_codes.includes(c));
  if (severe.length) {
    add('THUNDERSTORM_OR_SEVERE_WEATHER', 'high_risk',
      'Thunderstorms are forecast within the window.',
      { weather_codes: severe }, cfg.THUNDERSTORM_OR_SEVERE_WEATHER.affects);
  } else if (uncertainty?.severe_weather_model_count > 0) {
    // A minority of models forecast thunderstorms and were outvoted. Outvoted is
    // not the same as wrong, so this still bars a GOOD rating - it just does not
    // force AVOID on the strength of one model's convective scheme.
    const total = uncertainty.atmospheric_model_count ?? 1;
    add('SEVERE_WEATHER_POSSIBLE', 'caution',
      `${uncertainty.severe_weather_model_count} of ${total} forecast models show thunderstorms in this window; the others do not.`,
      {
        models: uncertainty.severe_weather_models,
        model_count: uncertainty.severe_weather_model_count,
        total_models: total,
      },
      cfg.THUNDERSTORM_OR_SEVERE_WEATHER.affects);
  }

  const heavy = codes.filter((c) => cfg.HEAVY_PRECIPITATION.weather_codes.includes(c));
  if (heavy.length) {
    add('HEAVY_PRECIPITATION', 'caution',
      'Heavy rain or showers are forecast within the window.',
      { weather_codes: heavy }, cfg.HEAVY_PRECIPITATION.affects);
  }

  if (sst !== null) {
    if (sst < cfg.COLD_WATER.high_risk_below_c) {
      add('COLD_WATER', 'high_risk',
        `Sea temperature of ${sst} °C is below the ${cfg.COLD_WATER.high_risk_below_c} °C threshold; cold-shock and rapid heat loss are real risks.`,
        { sst_c: sst }, cfg.COLD_WATER.affects);
    } else if (sst < cfg.COLD_WATER.caution_below_c) {
      add('COLD_WATER', 'caution',
        `Sea temperature of ${sst} °C is below the ${cfg.COLD_WATER.caution_below_c} °C comfort threshold.`,
        { sst_c: sst }, cfg.COLD_WATER.affects);
    }
  }

  // Wide disagreement between the forecast models.
  //
  // Ratings already use the conservative end of the ensemble, which protects
  // against under-calling. This protects against over-confidence: when the
  // models split this far apart, even the conservative figure is unreliable,
  // so nothing may be rated GOOD.
  const unc = cfg.FORECAST_UNCERTAIN;
  if (unc && uncertainty) {
    const waveWide = uncertainty.wave_spread_m !== null
      && uncertainty.wave_spread_m >= unc.wave_spread_m;
    const gustWide = uncertainty.gust_spread_kt !== null
      && uncertainty.gust_spread_kt >= unc.gust_spread_kt;

    if (waveWide || gustWide) {
      const parts = [];
      if (waveWide) {
        const r = uncertainty.wave_range_m;
        parts.push(`wave height ${r ? `${r.min}-${r.max} m` : `spread ${uncertainty.wave_spread_m} m`}`);
      }
      if (gustWide) {
        const r = uncertainty.gust_range_kt;
        parts.push(`peak gust ${r ? `${r.min}-${r.max} kt` : `spread ${uncertainty.gust_spread_kt} kt`}`);
      }

      add('FORECAST_UNCERTAIN', unc.severity,
        `The ${uncertainty.marine_model_count} forecast models disagree materially on ${parts.join(' and ')}. `
        + 'The rating uses the most pessimistic of them and is held at CAUTION or worse.',
        {
          wave_spread_m: uncertainty.wave_spread_m,
          gust_spread_kt: uncertainty.gust_spread_kt,
          models: uncertainty.marine_models,
        },
        unc.affects);
    }
  }

  // A brief, extreme gust spike.
  //
  // Ratings are driven by the sustained gust, so this flag is what stops a
  // spike from being quietly ignored: whenever the peak passes the caution
  // threshold it carries 'caution' severity, which caps every affected
  // activity at CAUTION. A day with a 30 kt spike therefore can never be rated
  // GOOD, no matter how calm the other twelve hours are.
  const spike = cfg.GUST_SPIKE;
  if (spike && metrics.wind.gust_factor_at_peak !== null
      && metrics.wind.gust_factor_at_peak > spike.min_gust_factor
      && metrics.wind.gust_peak_hours <= spike.max_peak_hours) {
    const dangerous = gustPeak !== null && gustPeak > cfg.HIGH_WIND.caution_gust_kt;

    add('GUST_SPIKE', dangerous ? 'caution' : 'info',
      `Gusts peak at ${gustPeak} kt for about ${metrics.wind.gust_peak_hours} h `
      + `(${metrics.wind.gust_factor_at_peak}x the sustained wind of ${metrics.wind.mean_kt} kt), `
      + `while holding near ${gust} kt for longer. Treat the peak as real and plan around it.`,
      {
        gust_peak_kt: gustPeak,
        gust_sustained_kt: gust,
        factor: metrics.wind.gust_factor_at_peak,
        peak_hours: metrics.wind.gust_peak_hours,
      },
      spike.affects);
  }

  // Informational: too little wind is not dangerous, it just is not sailing.
  // Suppressed when gusts are strong - "very light wind" alongside a 27 kt gust
  // would read as a contradiction and undermine the rest of the report.
  const lightBelow = thresholds.activities.sailing?.recreational?.wind_kt?.light_below;
  const gustsAreLight = gustPeak === null || gustPeak <= cfg.HIGH_WIND.caution_gust_kt;
  if (metrics.wind.mean_kt !== null && lightBelow !== undefined
      && metrics.wind.mean_kt < lightBelow && gustsAreLight) {
    add('LIGHT_WIND', 'info',
      `Mean wind of ${metrics.wind.mean_kt} kt is very light - likely motoring rather than sailing.`,
      { wind_kt: metrics.wind.mean_kt }, cfg.LIGHT_WIND.affects);
  }

  // Official warnings. The spec is emphatic: never imply an all-clear that was
  // not actually checked, and never invent a warning.
  if (alerts?.checked && Array.isArray(alerts.warnings) && alerts.warnings.length) {
    add('OFFICIAL_WARNING_PRESENT', 'high_risk',
      `An official warning is in force: ${alerts.warnings.map((w) => w.title ?? w).join('; ')}.`,
      { source: alerts.source, count: alerts.warnings.length }, ACTIVITIES);
  } else if (!alerts?.checked) {
    add('OFFICIAL_ALERTS_NOT_CHECKED', 'info',
      'Official marine warnings were not checked - no machine-readable feed is available for this coast. Check them yourself before going out.',
      { checked: false }, ACTIVITIES);
  }

  return flags;
}

/** Worst rating any flag imposes on a given activity. */
function flagCeiling(flags, activity) {
  return flags
    .filter((f) => f.affects.includes(activity))
    .reduce((acc, f) => worst(acc, SEVERITY_TO_RATING[f.severity]), RATING.GOOD);
}

/** Rate one activity from the thresholds alone, before flags are applied. */
export function rateActivity({ activity, metrics, thresholds, profile }) {
  const table = thresholds.activities[activity];
  if (!table) throw new Error(`Unknown activity: ${activity}`);
  const bounds = table[profile] ?? table.recreational;

  const criteria = [];
  for (const [criterion, criterionBounds] of Object.entries(bounds)) {
    if (!CRITERION_METRIC[criterion]) continue;

    // Some criteria only mean anything above a certain sea state. Wave period
    // is the important one: steepness is height over period, so a short period
    // is only uncomfortable once there is height behind it. Judging period
    // alone marks a glassy 0.3 m day at 4 s as choppy, which is both wrong and
    // - because the Mediterranean's normal wind-sea runs 3-5 s - constant.
    if (criterionBounds.applies_above_wave_m !== undefined) {
      const wave = metrics.waves.max_m;
      if (wave === null || wave < criterionBounds.applies_above_wave_m) {
        criteria.push({ criterion, value: CRITERION_METRIC[criterion](metrics, thresholds), rating: null, known: false, skipped: 'below wave-height floor' });
        continue;
      }
    }

    const value = CRITERION_METRIC[criterion](metrics, thresholds);
    criteria.push(rateCriterion(criterion, criterionBounds, value));
  }

  const rating = criteria.reduce((acc, c) => worst(acc, c.rating), RATING.GOOD);
  return { rating, criteria };
}

/**
 * Full assessment for one window.
 *
 * Returns per-activity ratings, the driving reasons, and the flag list. The
 * `limits` array records every reason a rating was held back, which is what the
 * LLM prompt and the fallback template both quote from.
 */
export function assess({
  metrics, thresholds, profile = 'recreational', alerts = { checked: false }, uncertainty = null,
}) {
  const flags = computeFlags({ metrics, thresholds, alerts, uncertainty });
  const dq = thresholds.data_quality;

  const activities = {};
  for (const activity of ACTIVITIES) {
    const { rating: thresholdRating, criteria } = rateActivity({ activity, metrics, thresholds, profile });
    const ceiling = flagCeiling(flags, activity);

    // Degraded (not missing-essential) inputs cap what we are willing to claim.
    let degradeCap = RATING.GOOD;
    const degradeReasons = [];
    for (const field of metrics.completeness.degraded_fields) {
      const rule = dq.degrading[field];
      if (rule && rule.activities.includes(activity)) {
        degradeCap = worst(degradeCap, rule.caps_at);
        degradeReasons.push(`${field.replace(/_/g, ' ')} unavailable`);
      }
    }

    const rating = worst(thresholdRating, ceiling, degradeCap);

    const limits = [
      ...criteria.filter((c) => c.rating && c.rating !== RATING.GOOD).map((c) => c.detail),
      ...flags.filter((f) => f.affects.includes(activity) && f.severity !== 'info').map((f) => f.reason),
      ...degradeReasons.map((r) => `Rating capped at ${degradeCap}: ${r}.`),
    ].filter(Boolean);

    activities[activity] = {
      rating,
      threshold_rating: thresholdRating,
      flag_ceiling: ceiling,
      criteria,
      limits,
    };
  }

  return {
    profile,
    thresholds_version: thresholds.version,
    activities,
    flags,
    official_alerts_checked: Boolean(alerts?.checked),
    data_status: metrics.completeness.essential_ok
      ? (metrics.completeness.degraded_fields.length ? 'degraded' : 'complete')
      : 'incomplete',
  };
}

/**
 * Best upcoming window for the given activity, or null when nothing is better
 * than the headline. Only ever returns a window rated at least as good as the
 * day as a whole, and never returns one rated AVOID.
 */
export function bestWindow({ windowAssessments, activity }) {
  const candidates = windowAssessments
    .filter((w) => w.key !== 'day')
    .filter((w) => w.assessment.activities[activity].rating !== RATING.AVOID)
    .sort((a, b) => RANK[a.assessment.activities[activity].rating] - RANK[b.assessment.activities[activity].rating]
      || a.metrics.window.start_hour - b.metrics.window.start_hour);

  return candidates.length ? candidates[0] : null;
}
