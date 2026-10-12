/**
 * Telegram message rendering.
 *
 * Two renderers, one skeleton:
 *   - renderReport()   uses LLM-written prose for the per-activity reasons.
 *   - renderFallback() builds those reasons from templates and flag labels.
 *
 * The fallback is not a degraded stub - it is a complete, correct report that
 * happens to be less fluent. Everything safety-relevant (ratings, values,
 * hazards, disclaimer) is identical in both paths, which is what makes it safe
 * to drop the LLM at any moment.
 *
 * parse_mode is HTML rather than MarkdownV2: MarkdownV2 requires escaping 18
 * characters, and an unescaped '.' inside "1.5 m" is enough to make Telegram
 * reject the whole message.
 */

const RATING_ICON = { GOOD: '🟢', CAUTION: '🟡', AVOID: '🔴' };

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function interpolate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v === null || v === undefined ? '—' : String(v);
  });
}

function ratingWord(t, rating) {
  return t.ratings[rating] ?? rating;
}

/** The "Key forecast:" line — identical in both renderers, straight from metrics. */
export function conditionsLine(report, t) {
  const m = report.metrics;
  const values = {
    wind_kmh: m.wind.mean_kmh,
    wind_kt: m.wind.mean_kt,
    wind_dir: m.wind.direction_compass ?? '',
    gust_kmh: m.wind.gust_max_kmh,
    gust_kt: m.wind.gust_max_kt,
    wave_m: m.waves.max_m,
    period_s: m.waves.period_mean_s,
    swell_m: m.swell.max_m,
    sst_c: m.sea.sst_mean_c,
  };
  const template = m.sea.sst_mean_c === null ? t.conditions_line_no_sst : t.conditions_line;
  return interpolate(template, values);
}

/**
 * How far apart the models were, in plain language.
 *
 * Quoting a single figure to two decimals when four models span 0.44-1.06 m
 * claims a precision the data does not have. This line restores the honesty
 * without burying the headline number.
 */
function uncertaintyLine(report, t) {
  const u = report.uncertainty;
  if (!u || !t.model_spread) return null;

  const wide = report.flags.some((f) => f.code === 'FORECAST_UNCERTAIN');
  if (!wide) return null;

  const parts = [];
  if (u.wave_range_m) parts.push(`${t.waves_word}: ${u.wave_range_m.min}-${u.wave_range_m.max} m`);
  if (u.gust_range_kt) parts.push(`${t.gusts_word}: ${u.gust_range_kt.min}-${u.gust_range_kt.max} kt`);
  if (!parts.length) return null;

  return interpolate(t.model_spread, {
    count: u.marine_model_count,
    ranges: parts.join('; '),
  });
}

/** Hazard line: only flags that are real, never padding. */
function warningLines(report, t) {
  const lines = [];

  if (report.data_status === 'incomplete') lines.push(t.data_incomplete);
  else if (report.data_status === 'degraded') lines.push(t.data_degraded);

  const hazards = report.flags
    .filter((f) => f.severity === 'caution' || f.severity === 'high_risk')
    .filter((f) => f.code !== 'DATA_INCOMPLETE')
    .map((f) => t.flags[f.code] ?? f.code);

  if (hazards.length) {
    lines.push(`${[...new Set(hazards)].join(', ')}.`);
  }

  lines.push(report.official_alerts_checked ? t.alerts_present : t.alerts_not_checked);
  return lines;
}

/**
 * Informational notes. Not hazards, but context the user needs to read the
 * rating correctly - chiefly the one-hour gust spike that can push an otherwise
 * quiet day to AVOID.
 */
function noteLines(report, t) {
  const notes = [];

  const spread = uncertaintyLine(report, t);
  if (spread) notes.push(spread);

  if (report.flags.some((f) => f.code === 'GUST_SPIKE') && t.note_gust_spike) {
    notes.push(t.note_gust_spike);
  }
  return notes;
}

function bestWindowLine(report, t, activity) {
  const bw = report.activities[activity].best_window;
  if (!bw) return null;
  return `${t.best_window}: ${bw.label} (${ratingWord(t, bw.rating)})`;
}

/**
 * Shared skeleton. `reasons` supplies the prose for each activity; where a
 * reason is missing the deterministic default is used, so a partially valid
 * LLM response can never produce an empty section.
 */
function renderSkeleton(report, t, reasons) {
  const a = report.activities;
  const icon = (r) => RATING_ICON[r] ?? '';
  const line = (rating, text) => `${ratingWord(t, rating)} ${icon(rating)}\n${escapeHtml(text)}`;

  const out = [];

  out.push(`🌊 <b>${escapeHtml(t.title)} — ${escapeHtml(report.location.name)}</b>`);
  out.push(`📅 ${report.forecast_date} | ${escapeHtml(t.window_label)}: ${report.headline_window.label} (${escapeHtml(t.tz_note)})`);
  out.push('');

  out.push(`⛵ <b>${escapeHtml(t.sailing)}:</b> ${line(a.sailing.rating, reasons.sailing)}`);
  const sailWindow = bestWindowLine(report, t, 'sailing');
  if (sailWindow) out.push(`<i>${escapeHtml(sailWindow)}</i>`);
  out.push('');

  out.push(`🎣 <b>${escapeHtml(t.fishing)}:</b>`);
  out.push(`• ${escapeHtml(t.shore)}: ${ratingWord(t, a.fishing_shore.rating)} ${icon(a.fishing_shore.rating)} — <i>${escapeHtml(t.shore_note)}</i>`);
  out.push(escapeHtml(reasons.fishing_shore));
  out.push(`• ${escapeHtml(t.small_boat)}: ${ratingWord(t, a.fishing_small_boat.rating)} ${icon(a.fishing_small_boat.rating)} — <i>${escapeHtml(t.small_boat_note)}</i>`);
  out.push(escapeHtml(reasons.fishing_small_boat));
  out.push('');

  out.push(`🏊 <b>${escapeHtml(t.swimming)}:</b> ${line(a.swimming.rating, reasons.swimming)}`);
  out.push('');

  out.push(`<b>${escapeHtml(t.key_forecast)}:</b> ${escapeHtml(conditionsLine(report, t))}`);
  out.push('');

  for (const w of warningLines(report, t)) out.push(`⚠️ ${escapeHtml(w)}`);
  for (const n of noteLines(report, t)) out.push(`ℹ️ ${escapeHtml(n)}`);
  out.push('');

  out.push(`<i>${escapeHtml(t.disclaimer)}</i>`);

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Deterministic reason for one activity, built from values and flag labels.
 * Fully translatable because it never reuses the English strings that assess.js
 * generates for the LLM prompt.
 */
function deterministicReason(report, t, activity) {
  const rating = report.activities[activity].rating;
  const base = { GOOD: t.reason_good, CAUTION: t.reason_caution, AVOID: t.reason_avoid }[rating];

  const hazards = report.flags
    .filter((f) => f.affects.includes(activity) && f.severity !== 'info')
    .map((f) => t.flags[f.code] ?? f.code);

  if (!hazards.length) return base;
  return `${base} (${[...new Set(hazards)].join(', ')})`;
}

/** Full report with no LLM involved. Used on any LLM failure, and for testing. */
export function renderFallback(report, i18n) {
  const t = i18n[report.language] ?? i18n.en;
  const reasons = {
    sailing: deterministicReason(report, t, 'sailing'),
    fishing_shore: deterministicReason(report, t, 'fishing_shore'),
    fishing_small_boat: deterministicReason(report, t, 'fishing_small_boat'),
    swimming: deterministicReason(report, t, 'swimming'),
  };
  return renderSkeleton(report, t, reasons);
}

/** Full report using validated LLM prose for the reason lines. */
export function renderReport(report, llm, i18n) {
  const t = i18n[report.language] ?? i18n.en;
  const reasons = {
    sailing: llm?.sailing?.reason || deterministicReason(report, t, 'sailing'),
    fishing_shore: llm?.fishing?.shore_reason || deterministicReason(report, t, 'fishing_shore'),
    fishing_small_boat: llm?.fishing?.small_boat_reason || deterministicReason(report, t, 'fishing_small_boat'),
    swimming: llm?.swimming?.reason || deterministicReason(report, t, 'swimming'),
  };
  return renderSkeleton(report, t, reasons);
}

/** Message shown when the forecast APIs themselves failed. Never uses stale data. */
export function renderDataUnavailable(language, i18n, locationName = null) {
  const t = i18n[language] ?? i18n.en;
  const where = locationName ? ` — ${escapeHtml(locationName)}` : '';
  return [
    `🌊 <b>${escapeHtml(t.title)}${where}</b>`,
    '',
    `⚠️ ${escapeHtml(t.bot.data_unavailable)}`,
    '',
    `<i>${escapeHtml(t.disclaimer)}</i>`,
  ].join('\n');
}
