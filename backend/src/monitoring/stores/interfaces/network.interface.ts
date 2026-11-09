import { PeriodKey } from '../../../shared/time/time-range';
import { ComfortBand } from '../../../telemetry/domain/comfort';
import { DeviceStatus, StoreStatus, ZoneCondition } from '../../domain/status';

export const STORE_SORT_KEYS = [
  'name',
  'city',
  'status',
  'comfort',
  'outOfRange',
] as const;
export type StoreSortKey = (typeof STORE_SORT_KEYS)[number];

export interface StoreListQuery {
  period: PeriodKey;
  customerId?: string;
  search?: string;
  status?: StoreStatus;
  sort: StoreSortKey;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface ZoneView {
  id: string;
  name: string;
  deviceId: string | null;
  deviceStatus: DeviceStatus;
  condition: ZoneCondition;
  isOpen: boolean;
  currentTemperature: number | null;
  lastReadingAt: Date | null;
  comfortBand: ComfortBand;
  comfortPct: number | null;
}

export interface StoreView {
  id: string;
  name: string;
  kind: string | null;
  city: string;
  state: string;
  timezone: string;
  customer: { id: string; name: string };
  status: StoreStatus;
  comfortPct: number | null;
  zonesTotal: number;
  zonesOnline: number;
  zonesOutOfRange: number;
  zones: ZoneView[];
}

export interface NetworkSummary {
  stores: number;
  zones: number;
  zonesOnline: number;
  zonesOutOfRange: number;
  comfortPct: number | null;
  storesByStatus: Record<StoreStatus, number>;
}

export interface StoreListResult {
  referenceTime: Date;
  period: { key: PeriodKey; from: Date; to: Date };
  summary: NetworkSummary;
  page: number;
  pageSize: number;
  total: number;
  items: StoreView[];
}
