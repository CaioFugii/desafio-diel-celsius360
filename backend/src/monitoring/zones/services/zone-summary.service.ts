import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PeriodKey,
  rangeForPeriod,
  spanMs,
} from '../../../shared/time/time-range';
import { resolutionFor } from '../../domain/resolution';
import { OFFLINE_AFTER_MS, percentage } from '../../domain/status';
import { ZoneEvaluator } from '../../domain/zone-evaluation';
import { ReferenceClock } from '../../interfaces/reference-clock.interface';
import { ZonesReadModel } from '../interfaces/zones-read-model.interface';
import { ZoneSummary } from '../interfaces/zone-summary.interface';

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
