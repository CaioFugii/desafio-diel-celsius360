import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PeriodKey,
  rangeForPeriod,
  spanMs,
} from '../../shared/time/time-range';
import { WeeklyHours } from '../../shared/time/weekly-schedule';
import { ComfortBand } from '../../telemetry/domain/comfort';
import { Resolution, resolutionFor } from '../domain/resolution';
import {
  DeviceStatus,
  OFFLINE_AFTER_MS,
  ZoneCondition,
  percentage,
} from '../domain/status';

import { ZoneEvaluator } from '../domain/zone-evaluation';
import { ReferenceClock } from '../reference-clock';
import { ZoneDetails, ZonesReadModel } from './zones.read-model';

export interface ZoneIndicators {
  comfortPct: number | null;
  belowPct: number | null;
  abovePct: number | null;
  businessHoursSamples: number;
  avgTemperature: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  availabilityPct: number;
  gaps: number;
  gapMinutes: number;
  rejectedReadings: number;
}

export interface ZoneSummary {
  referenceTime: Date;
  zone: {
    id: string;
    name: string;
    comfortBand: ComfortBand;
    businessHours: WeeklyHours;
  };
  store: ZoneDetails['store'];
  customer: ZoneDetails['customer'];
  device: {
    id: string | null;
    status: DeviceStatus;
    lastPacketAt: Date | null;
  };
  current: {
    temperature: number | null;
    readingAt: Date | null;
    condition: ZoneCondition;
    isOpen: boolean;
  };
  period: { key: PeriodKey; from: Date; to: Date; resolution: Resolution };
  indicators: ZoneIndicators;
}

@Injectable()
export class ZoneSummaryService {
  constructor(
    private readonly clock: ReferenceClock,
    private readonly zones: ZonesReadModel,
    private readonly evaluator: ZoneEvaluator,
  ) {}

  async summary(zoneId: string, period: PeriodKey): Promise<ZoneSummary> {
    const zone = await this.zones.findZone(zoneId);
    if (!zone) throw new NotFoundException(`ambiente ${zoneId} não encontrado`);

    const now = await this.clock.now();
    const range = rangeForPeriod(period, now);
    const resolution = resolutionFor(range);
    const [stats, gaps, rejectedReadings] = await Promise.all([
      this.zones.stats(zoneId, range, resolution),
      this.zones.gaps(zoneId, range, OFFLINE_AFTER_MS),
      this.zones.rejectedReadings(zoneId, range),
    ]);
    const live = this.evaluator.evaluate(zone, zone.store.timezone, now);
    const gapMs = gaps.reduce(
      (acc, g) => acc + (g.to.getTime() - g.from.getTime()),
      0,
    );

    return {
      referenceTime: now,
      zone: {
        id: zone.id,
        name: zone.name,
        comfortBand: zone.band,
        businessHours: zone.businessHours,
      },
      store: zone.store,
      customer: zone.customer,
      device: {
        id: zone.deviceId,
        status: live.deviceStatus,
        lastPacketAt: zone.lastPacketAt,
      },
      current: {
        temperature: live.currentTemperature,
        readingAt: zone.lastSampleAt,
        condition: live.condition,
        isOpen: live.isOpen,
      },
      period: { key: period, ...range, resolution },
      indicators: {
        comfortPct: percentage(stats.within, stats.businessHoursSamples),
        belowPct: percentage(stats.below, stats.businessHoursSamples),
        abovePct: percentage(stats.above, stats.businessHoursSamples),
        businessHoursSamples: stats.businessHoursSamples,
        avgTemperature: stats.avg,
        minTemperature: stats.min,
        maxTemperature: stats.max,
        availabilityPct: percentage(spanMs(range) - gapMs, spanMs(range)) ?? 0,
        gaps: gaps.length,
        gapMinutes: Math.round(gapMs / 60_000),
        rejectedReadings,
      },
    };
  }
}
