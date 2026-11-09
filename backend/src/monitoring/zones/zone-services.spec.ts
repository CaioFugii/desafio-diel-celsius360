import { NotFoundException } from '@nestjs/common';
import { LocalTimeResolver } from '../../shared/time/local-time';
import { TimeRange } from '../../shared/time/time-range';
import { Resolution } from '../domain/resolution';
import { OFFLINE_AFTER_MS } from '../domain/status';
import { ZoneEvaluator } from '../domain/zone-evaluation';
import { FixedClock, NOW, zoneFacts } from '../testing/fakes';
import { ZoneSeriesService } from './zone-series.service';
import { ZoneSummaryService } from './zone-summary.service';
import {
  Gap,
  PeriodStats,
  SeriesPoint,
  ZoneDetails,
  ZonesReadModel,
} from './zones.read-model';

const HOUR_MS = 3_600_000;

class StubZonesReadModel extends ZonesReadModel {
  seriesCalls: Array<[string, TimeRange, Resolution]> = [];
  gapCalls: Array<[string, TimeRange, number]> = [];
  zone: ZoneDetails | null = {
    ...zoneFacts(),
    id: 'AMB-001',
    name: 'Vitrine',
    store: {
      id: 'LOJA-1',
      name: 'Tijuca',
      city: 'Rio de Janeiro',
      state: 'RJ',
      timezone: 'America/Sao_Paulo',
    },
    customer: { id: 'CLI-001', name: 'Moda Carioca' },
  };
  points: SeriesPoint[] = [{ t: NOW, avg: 23, min: 22, max: 24, samples: 2 }];
  gapList: Gap[] = [];
  periodStats: PeriodStats = {
    samples: 2_000,
    avg: 23.4,
    min: 20,
    max: 27,
    businessHoursSamples: 1_000,
    within: 900,
    below: 40,
    above: 60,
  };

  async findZone() {
    return this.zone;
  }

  async series(zoneId: string, range: TimeRange, resolution: Resolution) {
    this.seriesCalls.push([zoneId, range, resolution]);
    return this.points;
  }

  async stats() {
    return this.periodStats;
  }

  async gaps(zoneId: string, range: TimeRange, minGapMs: number) {
    this.gapCalls.push([zoneId, range, minGapMs]);
    return this.gapList;
  }

  async rejectedReadings() {
    return 7;
  }
}

describe('ZoneSeriesService', () => {
  let zones: StubZonesReadModel;
  let service: ZoneSeriesService;

  beforeEach(() => {
    zones = new StubZonesReadModel();
    service = new ZoneSeriesService(new FixedClock(NOW), zones);
  });

  it('returns the points of the period with a resolution suited to its length', async () => {
    const series = await service.series('AMB-001', { period: '30d' });

    expect(series).toMatchObject({
      zoneId: 'AMB-001',
      from: new Date(NOW.getTime() - 30 * 24 * HOUR_MS),
      to: NOW,
      resolution: '1h',
      bucketSeconds: 3_600,
      comfortBand: { min: 21, max: 25 },
      points: zones.points,
      gaps: [],
    });
    expect(zones.gapCalls[0][2]).toBe(OFFLINE_AFTER_MS);
  });

  it('accepts an explicit range', async () => {
    const from = new Date(NOW.getTime() - 6 * HOUR_MS);

    const series = await service.series('AMB-001', { from, to: NOW });

    expect(series.resolution).toBe('1m');
    expect(zones.seriesCalls[0][1]).toEqual({ from, to: NOW });
  });

  it('fails with 404 for an unknown zone', async () => {
    zones.zone = null;

    await expect(service.series('nope', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ZoneSummaryService', () => {
  let zones: StubZonesReadModel;
  let service: ZoneSummaryService;

  beforeEach(() => {
    zones = new StubZonesReadModel();
    service = new ZoneSummaryService(
      new FixedClock(NOW),
      zones,
      new ZoneEvaluator(new LocalTimeResolver()),
    );
  });

  it('combines the current state with the period indicators', async () => {
    zones.gapList = [
      {
        from: new Date(NOW.getTime() - 3 * HOUR_MS),
        to: new Date(NOW.getTime() - 2 * HOUR_MS),
      },
      {
        from: new Date(NOW.getTime() - HOUR_MS),
        to: new Date(NOW.getTime() - HOUR_MS / 2),
      },
    ];

    const summary = await service.summary('AMB-001', '1d');

    expect(summary).toMatchObject({
      referenceTime: NOW,
      zone: {
        id: 'AMB-001',
        name: 'Vitrine',
        comfortBand: { min: 21, max: 25 },
      },
      store: { id: 'LOJA-1', timezone: 'America/Sao_Paulo' },
      customer: { id: 'CLI-001' },
      device: { id: 'IOT001', status: 'online' },
      current: { temperature: 23, condition: 'within', isOpen: true },
      period: { key: '1d', to: NOW, resolution: '1m' },
      indicators: {
        comfortPct: 90,
        belowPct: 4,
        abovePct: 6,
        businessHoursSamples: 1_000,
        avgTemperature: 23.4,
        minTemperature: 20,
        maxTemperature: 27,
        availabilityPct: 93.8,
        gaps: 2,
        gapMinutes: 90,
        rejectedReadings: 7,
      },
    });
  });

  it('reports empty indicators when nothing was measured', async () => {
    zones.periodStats = {
      samples: 0,
      avg: null,
      min: null,
      max: null,
      businessHoursSamples: 0,
      within: 0,
      below: 0,
      above: 0,
    };
    zones.gapList = [{ from: new Date(NOW.getTime() - 24 * HOUR_MS), to: NOW }];

    const { indicators } = await service.summary('AMB-001', '1d');

    expect(indicators).toMatchObject({
      comfortPct: null,
      avgTemperature: null,
      availabilityPct: 0,
      gaps: 1,
      gapMinutes: 1_440,
    });
  });

  it('fails with 404 for an unknown zone', async () => {
    zones.zone = null;

    await expect(service.summary('nope', '1d')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
