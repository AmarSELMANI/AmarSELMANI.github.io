/**
 * Forecast window selection.
 *
 * Both Open-Meteo endpoints are called with `timezone=Africa/Algiers`, so the
 * timestamps they return are already local wall-clock strings of the form
 * "2026-08-27T14:00". That means window selection is a string/hour filter and
 * needs no timezone library - and critically, no UTC conversion that could shift
 * the "afternoon" window by an hour twice a year.
 *
 * The two endpoints are matched by timestamp rather than by array position: the
 * marine and atmospheric models are different products and there is no guarantee
 * their hourly arrays start at the same hour.
 */

/** "2026-08-27T14:00" -> { date: "2026-08-27", hour: 14 } */
export function parseLocalStamp(stamp) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(stamp));
  if (!m) return null;
  return { date: m[1], hour: Number(m[2]), minute: Number(m[3]) };
}

/**
 * Today's date in a given IANA zone, as YYYY-MM-DD.
 * `en-CA` formats as ISO, which avoids hand-rolling the padding.
 */
export function localDate(zone = 'Africa/Algiers', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Current local hour in a given IANA zone, 0-23. */
export function localHour(zone = 'Africa/Algiers', now = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hour12: false }).format(now),
  );
}

/** Map every timestamp to its index so two series can be aligned by time. */
function indexByStamp(times) {
  const map = new Map();
  if (!Array.isArray(times)) return map;
  times.forEach((t, i) => map.set(String(t).slice(0, 16), i));
  return map;
}

/**
 * Build the window set for one calendar date.
 *
 * Returns, per window, the array indices into the forecast and marine hourly
 * series. A window whose hours are absent from a series simply gets fewer
 * indices; the metrics layer decides whether that is enough data to assess.
 */
export function selectWindows({ forecast, marine, thresholds, date }) {
  const forecastTimes = forecast?.hourly?.time ?? [];
  const marineTimes = marine?.hourly?.time ?? [];
  const marineIndex = indexByStamp(marineTimes);

  const definitions = thresholds.windows;
  const windows = [];

  for (const [key, def] of Object.entries(definitions)) {
    if (key.startsWith('_')) continue;

    const forecastIdx = [];
    const marineIdx = [];
    const stamps = [];

    forecastTimes.forEach((t, i) => {
      const parsed = parseLocalStamp(t);
      if (!parsed || parsed.date !== date) return;
      if (parsed.hour < def.start_hour || parsed.hour >= def.end_hour) return;

      forecastIdx.push(i);
      stamps.push(t);
      const mIdx = marineIndex.get(String(t).slice(0, 16));
      if (mIdx !== undefined) marineIdx.push(mIdx);
    });

    windows.push({
      key,
      date,
      start_hour: def.start_hour,
      end_hour: def.end_hour,
      label: `${String(def.start_hour).padStart(2, '0')}:00-${String(def.end_hour).padStart(2, '0')}:00`,
      forecast_idx: forecastIdx,
      marine_idx: marineIdx,
      stamps,
    });
  }

  return windows;
}

/**
 * Remaining windows relevant to a request made at `hour` - used so an
 * afternoon /report does not recommend a morning slot that is already gone.
 */
export function upcomingWindows(windows, hour) {
  if (hour === null || hour === undefined) return windows.filter((w) => w.key !== 'day');
  return windows.filter((w) => w.key !== 'day' && w.end_hour > hour);
}
