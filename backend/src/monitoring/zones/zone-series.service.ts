import { Injectable, NotFoundException } from '@nestjs/common';
import { ComfortBand } from '../../telemetry/domain/comfort';
import {
  RESOLUTION_SECONDS,
  Resolution,
  resolutionFor,
} from '../domain/resolution';
import { OFFLINE_AFTER_MS } from '../domain/status';
import { ReferenceClock } from '../reference-clock';
import { RangeQuery, resolveRange } from './zone-range';
import { Gap, SeriesPoint, ZonesReadModel } from './zones.read-model';

export interface ZoneSeries {
  zoneId: string;
  from: Date;
  to: Date;
  resolution: Resolution;
  bucketSeconds: number;
  comfortBand: ComfortBand;
  points: SeriesPoint[];
  /** Periods of at least the offline threshold without valid readings. */
  gaps: Gap[];
}

@Injectable()
export class ZoneSeriesService {
  constructor(
    private readonly clock: ReferenceClock,
    private readonly zones: ZonesReadModel,
  ) {}

  async series(zoneId: string, query: RangeQuery): Promise<ZoneSeries> {
    const zone = await this.zones.findZone(zoneId);
    if (!zone) throw new NotFoundException(`ambiente ${zoneId} não encontrado`);

    const range = resolveRange(query, await this.clock.now());
    const resolution = resolutionFor(range);
    const [points, gaps] = await Promise.all([
      this.zones.series(zoneId, range, resolution),
      this.zones.gaps(zoneId, range, OFFLINE_AFTER_MS),
    ]);
    return {
      zoneId,
      ...range,
      resolution,
      bucketSeconds: RESOLUTION_SECONDS[resolution],
      comfortBand: zone.band,
      points,
      gaps,
    };
  }
}
