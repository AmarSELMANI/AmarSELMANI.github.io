/**
 * Unit normalisation.
 *
 * Open-Meteo reports the unit of every series in `hourly_units`, and those units
 * are not always what you would guess: `ocean_current_velocity` comes back in
 * km/h, not m/s. Reading the declared unit instead of assuming one is the
 * difference between a correct rip-current threshold and one that is wrong by
 * a factor of 3.6.
 *
 * Every converter throws on an unrecognised unit rather than silently passing
 * the number through - a wrong safety number is worse than a failed report.
 */

export const KMH_PER_KNOT = 1.852;

/** knots = km/h / 1.852 */
export function kmhToKnots(kmh) {
  return kmh === null || kmh === undefined ? null : kmh / KMH_PER_KNOT;
}

const SPEED_TO_KMH = {
  'km/h': 1,
  'kmh': 1,
  'm/s': 3.6,
  'ms': 3.6,
  'mph': 1.609344,
  'kn': KMH_PER_KNOT,
  'kt': KMH_PER_KNOT,
  'knots': KMH_PER_KNOT,
};

const LENGTH_TO_M = {
  m: 1,
  metre: 1,
  meters: 1,
  ft: 0.3048,
  feet: 0.3048,
};

export function speedToKmh(value, unit) {
  if (value === null || value === undefined) return null;
  const factor = SPEED_TO_KMH[String(unit).trim().toLowerCase()];
  if (factor === undefined) throw new Error(`Unsupported speed unit from source: ${unit}`);
  return value * factor;
}

export function speedToMs(value, unit) {
  const kmh = speedToKmh(value, unit);
  return kmh === null ? null : kmh / 3.6;
}

export function lengthToM(value, unit) {
  if (value === null || value === undefined) return null;
  const factor = LENGTH_TO_M[String(unit).trim().toLowerCase()];
  if (factor === undefined) throw new Error(`Unsupported length unit from source: ${unit}`);
  return value * factor;
}

export function tempToC(value, unit) {
  if (value === null || value === undefined) return null;
  const u = String(unit).trim().toLowerCase().replace('°', '').replace('degrees', '').trim();
  if (u === 'c' || u === 'celsius') return value;
  if (u === 'f' || u === 'fahrenheit') return (value - 32) / 1.8;
  throw new Error(`Unsupported temperature unit from source: ${unit}`);
}

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Meteorological bearing (degrees the wind/waves come FROM) to a 16-point compass label. */
export function compassPoint(deg) {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return null;
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_16[idx];
}

/** Round for display without turning 0 into null. */
export function round(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
