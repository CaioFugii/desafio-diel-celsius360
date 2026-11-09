import { TimeRange } from '../../../shared/time/time-range';
import { Resolution } from '../../domain/resolution';
import { ZoneLiveFacts } from '../../domain/zone-evaluation';

export interface ZoneDetails extends ZoneLiveFacts {
  id: string;
  name: string;
  store: {
    id: string;
    name: string;
    city: string;
    state: string;
    timezone: string;
  };
  customer: { id: string; name: string };
}

export interface SeriesPoint {
  t: Date;
  avg: number;
  min: number;
  max: number;
  samples: number;
}

export interface PeriodStats {
  samples: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  businessHoursSamples: number;
  within: number;
  below: number;
  above: number;
}

export interface Gap {
  from: Date;
  to: Date;
}

export abstract class ZonesReadModel {
  abstract findZone(zoneId: string): Promise<ZoneDetails | null>;
  abstract series(
    zoneId: string,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<SeriesPoint[]>;
  abstract stats(
    zoneId: string,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<PeriodStats>;
  /**
   * Ranges are closed on both ends: the bucket holding the reference "now" belongs to
   * the period. Gaps are intervals of at least `minGapMs` without a valid reading,
   * including a missing start or end of the range.
   */
  abstract gaps(
    zoneId: string,
    range: TimeRange,
    minGapMs: number,
  ): Promise<Gap[]>;
  abstract rejectedReadings(zoneId: string, range: TimeRange): Promise<number>;
}
