import { SeriesPoint } from '../../api/types';
import { buildChartRows, gapAreas, midnightTicks, temperatureDomain } from './chart-data';

const point = (t: string, avg: number, min = avg, max = avg): SeriesPoint => ({
  t,
  avg,
  min,
  max,
  samples: 2,
});

describe('buildChartRows', () => {
  it('maps points to timestamps with a min–max range', () => {
    expect(buildChartRows([point('2026-02-10T12:00:00Z', 21, 20.5, 21.5)], 60)).toEqual([
      { t: Date.parse('2026-02-10T12:00:00Z'), avg: 21, range: [20.5, 21.5], samples: 2 },
    ]);
  });

  it('inserts an empty row after a missing bucket so the line breaks', () => {
    const rows = buildChartRows(
      [
        point('2026-02-10T12:00:00Z', 21),
        point('2026-02-10T12:01:00Z', 21),
        point('2026-02-10T12:07:00Z', 22),
      ],
      60,
    );
    expect(rows.map((r) => r.avg)).toEqual([21, 21, null, 22]);
    expect(rows[2]).toMatchObject({ t: Date.parse('2026-02-10T12:02:00Z'), range: null, samples: 0 });
  });

  it('returns nothing for an empty series', () => {
    expect(buildChartRows([], 900)).toEqual([]);
  });
});

describe('gapAreas', () => {
  it('clips gaps to the visible range and drops the ones outside it', () => {
    const areas = gapAreas(
      [
        { from: '2026-02-10T10:00:00Z', to: '2026-02-10T12:30:00Z' },
        { from: '2026-02-10T12:40:00Z', to: '2026-02-10T12:50:00Z' },
        { from: '2026-02-10T14:00:00Z', to: '2026-02-10T15:00:00Z' },
      ],
      '2026-02-10T12:00:00Z',
      '2026-02-10T13:00:00Z',
    );
    expect(areas).toEqual([
      { from: Date.parse('2026-02-10T12:00:00Z'), to: Date.parse('2026-02-10T12:30:00Z') },
      { from: Date.parse('2026-02-10T12:40:00Z'), to: Date.parse('2026-02-10T12:50:00Z') },
    ]);
  });
});

describe('midnightTicks', () => {
  const at = (iso: string) => Date.parse(iso);

  it('returns local midnights of the store time zone inside the range', () => {
    const ticks = midnightTicks(at('2026-02-03T23:59:56Z'), at('2026-02-06T02:59:56Z'), 'America/Sao_Paulo');
    expect(ticks.map((t) => new Date(t).toISOString())).toEqual([
      '2026-02-04T03:00:00.000Z',
      '2026-02-05T03:00:00.000Z',
    ]);
  });

  it('handles half-hour offsets', () => {
    const ticks = midnightTicks(at('2026-02-03T00:00:00Z'), at('2026-02-05T00:00:00Z'), 'Asia/Kolkata');
    expect(ticks.map((t) => new Date(t).toISOString())).toEqual([
      '2026-02-03T18:30:00.000Z',
      '2026-02-04T18:30:00.000Z',
    ]);
  });

  it('thins long ranges to at most maxTicks, keeping the first midnight', () => {
    const ticks = midnightTicks(at('2026-01-11T03:00:00Z'), at('2026-02-10T03:00:00Z'), 'America/Sao_Paulo', 10);
    expect(ticks.length).toBeLessThanOrEqual(10);
    expect(ticks[0]).toBe(at('2026-01-11T03:00:00Z'));
    expect(ticks[1] - ticks[0]).toBe(4 * 86_400_000);
  });
});

describe('temperatureDomain', () => {
  const band = { min: 20, max: 24 };

  it('always contains the comfort band', () => {
    expect(temperatureDomain([], band)).toEqual([19, 25]);
    expect(temperatureDomain([point('2026-02-10T12:00:00Z', 22, 21.5, 22.5)], band)).toEqual([19, 25]);
  });

  it('grows to the extreme readings, rounded outwards', () => {
    expect(temperatureDomain([point('2026-02-10T12:00:00Z', 22, 17.4, 28.2)], band, 0.5)).toEqual([
      16, 29,
    ]);
  });
});
