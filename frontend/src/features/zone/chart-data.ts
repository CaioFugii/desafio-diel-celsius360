import { ComfortBand, Gap, SeriesPoint } from '../../api/types';

export interface ChartRow {
  t: number;
  avg: number | null;
  range: [number, number] | null;
  samples: number;
}

export interface GapArea {
  from: number;
  to: number;
}

/**
 * Converts the API points to chart rows, inserting an empty row wherever a
 * bucket is missing so the line breaks instead of bridging the hole.
 */
export function buildChartRows(points: SeriesPoint[], bucketSeconds: number): ChartRow[] {
  const bucketMs = bucketSeconds * 1000;
  const rows: ChartRow[] = [];
  let previous: number | null = null;
  for (const point of points) {
    const t = Date.parse(point.t);
    if (previous !== null && t - previous > bucketMs) {
      rows.push({ t: previous + bucketMs, avg: null, range: null, samples: 0 });
    }
    rows.push({ t, avg: point.avg, range: [point.min, point.max], samples: point.samples });
    previous = t;
  }
  return rows;
}

export function gapAreas(gaps: Gap[], from: string, to: string): GapArea[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return gaps
    .map((g) => ({ from: Math.max(start, Date.parse(g.from)), to: Math.min(end, Date.parse(g.to)) }))
    .filter((g) => g.to > g.from);
}

const STEP_MS = 30 * 60_000;

/**
 * Instants of local midnight (in the store's time zone) inside [from, to],
 * thinned to at most `maxTicks`, so multi-day axes get one label per day.
 * Walks in 30-minute steps, which covers whole and half-hour UTC offsets.
 */
export function midnightTicks(from: number, to: number, timeZone: string, maxTicks = 10): number[] {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const midnights: number[] = [];
  for (let t = Math.ceil(from / STEP_MS) * STEP_MS; t <= to; t += STEP_MS) {
    if (clock.format(t) === '00:00') midnights.push(t);
  }
  const every = Math.ceil(midnights.length / maxTicks);
  return midnights.filter((_, i) => i % every === 0);
}

/** Y axis bounds that always show the comfort band, padded and rounded to whole degrees. */
export function temperatureDomain(points: SeriesPoint[], band: ComfortBand, padding = 1): [number, number] {
  let low = band.min;
  let high = band.max;
  for (const p of points) {
    if (p.min < low) low = p.min;
    if (p.max > high) high = p.max;
  }
  return [Math.floor(low - padding), Math.ceil(high + padding)];
}
