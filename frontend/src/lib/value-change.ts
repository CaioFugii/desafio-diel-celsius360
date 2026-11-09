import { formatPercent, formatTemperature } from './format';

export type ValueKind = 'temperature' | 'percent' | 'count';
export type Direction = 'up' | 'down';

export interface Change {
  /** Difference between the displayed values, already rounded to the display precision. */
  delta: number;
  direction: Direction;
}

const LOCALE = 'pt-BR';

const DIGITS: Record<ValueKind, number> = { temperature: 1, percent: 1, count: 0 };

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Whether the value on screen changes; values are compared at display precision. */
export function isDisplayChange(
  previous: number | null,
  next: number | null,
  kind: ValueKind,
): boolean {
  if (previous === null || next === null) return previous !== next;
  return roundTo(previous, DIGITS[kind]) !== roundTo(next, DIGITS[kind]);
}

/** How much the displayed value moved; null when there is nothing to compare or it did not move. */
export function changeBetween(
  previous: number | null,
  next: number | null,
  kind: ValueKind,
): Change | null {
  if (previous === null || next === null) return null;
  const digits = DIGITS[kind];
  const delta = roundTo(roundTo(next, digits) - roundTo(previous, digits), digits);
  if (delta === 0) return null;
  return { delta, direction: delta > 0 ? 'up' : 'down' };
}

export function formatValue(value: number | null, kind: ValueKind): string {
  if (kind === 'temperature') return formatTemperature(value);
  if (kind === 'percent') return formatPercent(value);
  if (value === null) return '—';
  return Math.round(value).toLocaleString(LOCALE);
}

/** Magnitude of a change, e.g. "0,3 °C", "1,2 p.p." (percentage points) or "2". */
export function formatChange(delta: number, kind: ValueKind): string {
  const digits = DIGITS[kind];
  const magnitude = Math.abs(delta).toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (kind === 'temperature') return `${magnitude} °C`;
  if (kind === 'percent') return `${magnitude} p.p.`;
  return magnitude;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
