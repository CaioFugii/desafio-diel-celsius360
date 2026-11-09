import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RESOLUTION_SECONDS, resolutionFor } from '../../domain/resolution';
import { OFFLINE_AFTER_MS } from '../../domain/status';
import { ReferenceClock } from '../../interfaces/reference-clock.interface';
import {
  InvalidRangeError,
  RangeQuery,
  resolveRange,
} from '../../domain/zone-range';
import { TimeRange } from '../../../shared/time/time-range';
import { ZonesReadModel } from '../interfaces/zones-read-model.interface';
import { ZoneSeries } from '../interfaces/zone-series.interface';

@Injectable()
export class ZoneSeriesService {
  constructor(
    private readonly clock: ReferenceClock,
    private readonly zones: ZonesReadModel,
  ) {}

  async series(zoneId: string, query: RangeQuery): Promise<ZoneSeries> {
    const zone = await this.zones.findZone(zoneId);
    if (!zone) throw new NotFoundException(`ambiente ${zoneId} não encontrado`);

    const range = this.rangeFor(query, await this.clock.now());
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

  private rangeFor(query: RangeQuery, now: Date): TimeRange {
    try {
      return resolveRange(query, now);
    } catch (err) {
      if (err instanceof InvalidRangeError)
        throw new BadRequestException(err.message);
      throw err;
    }
  }
}
