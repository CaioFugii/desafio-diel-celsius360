export type PeriodKey = '1d' | '7d' | '30d';
export type DeviceStatus = 'online' | 'offline' | 'no_data';
export type StoreStatus = 'online' | 'partial' | 'offline' | 'no_data';
export type ZoneCondition = 'below' | 'within' | 'above' | 'closed' | 'unknown';
export type StoreSortKey = 'name' | 'city' | 'status' | 'comfort' | 'outOfRange';
export type SortOrder = 'asc' | 'desc';
export type Resolution = '1m' | '15m' | '1h';

export interface ComfortBand {
  min: number;
  max: number;
}

export interface Ref {
  id: string;
  name: string;
}

export interface Period {
  key: PeriodKey;
  from: string;
  to: string;
}

export interface ZoneStatus {
  id: string;
  name: string;
  deviceId: string | null;
  deviceStatus: DeviceStatus;
  condition: ZoneCondition;
  isOpen: boolean;
  currentTemperature: number | null;
  lastReadingAt: string | null;
  comfortBand: ComfortBand;
  comfortPct: number | null;
}

export interface Store {
  id: string;
  name: string;
  kind: string | null;
  city: string;
  state: string;
  timezone: string;
  customer: Ref;
  status: StoreStatus;
  comfortPct: number | null;
  zonesTotal: number;
  zonesOnline: number;
  zonesOutOfRange: number;
  zones: ZoneStatus[];
}

export interface NetworkSummary {
  stores: number;
  zones: number;
  zonesOnline: number;
  zonesOutOfRange: number;
  comfortPct: number | null;
  storesByStatus: Record<StoreStatus, number>;
}

export interface StoreList {
  referenceTime: string;
  period: Period;
  summary: NetworkSummary;
  page: number;
  pageSize: number;
  total: number;
  items: Store[];
}

export interface StoreListParams {
  period: PeriodKey;
  customerId?: string;
  search?: string;
  status?: StoreStatus;
  sort: StoreSortKey;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export interface Customer {
  id: string;
  name: string;
  segment: string | null;
  stores: number;
}

export interface SeriesPoint {
  t: string;
  avg: number;
  min: number;
  max: number;
  samples: number;
}

export interface Gap {
  from: string;
  to: string;
}

export interface ZoneSeries {
  zoneId: string;
  from: string;
  to: string;
  resolution: Resolution;
  bucketSeconds: number;
  comfortBand: ComfortBand;
  points: SeriesPoint[];
  gaps: Gap[];
}

export interface DailyWindow {
  open: string;
  close: string;
}

export type WeeklyHours = Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', DailyWindow | null>;

export interface ZoneSummary {
  referenceTime: string;
  zone: { id: string; name: string; comfortBand: ComfortBand; businessHours: WeeklyHours };
  store: { id: string; name: string; city: string; state: string; timezone: string };
  customer: Ref;
  device: { id: string | null; status: DeviceStatus; lastPacketAt: string | null };
  current: {
    temperature: number | null;
    readingAt: string | null;
    condition: ZoneCondition;
    isOpen: boolean;
  };
  period: Period & { resolution: Resolution };
  indicators: {
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
  };
}
