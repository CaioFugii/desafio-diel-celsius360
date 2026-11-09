import { TimeRange } from '../../../shared/time/time-range';
import { Resolution } from '../../domain/resolution';
import { ZoneLiveFacts } from '../../domain/zone-evaluation';

export interface ZoneFacts extends ZoneLiveFacts {
  id: string;
  name: string;
  businessHoursSamples: number;
  withinSamples: number;
}

export interface StoreFacts {
  id: string;
  name: string;
  kind: string | null;
  city: string;
  state: string;
  timezone: string;
  customer: { id: string; name: string };
  zones: ZoneFacts[];
}

export interface StoreFilter {
  customerId?: string;
  /** Case-insensitive match on store id, name or city. */
  search?: string;
}

export abstract class NetworkReadModel {
  abstract storeFacts(
    filter: StoreFilter,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<StoreFacts[]>;
}
