import { Injectable } from '@nestjs/common';
import { PeriodKey, rangeForPeriod } from '../../shared/time/time-range';
import { ComfortBand } from '../../telemetry/domain/comfort';
import { resolutionFor } from '../domain/resolution';
import {
  DeviceStatus,
  STORE_STATUS_SEVERITY,
  StoreStatus,
  ZoneCondition,
  isOutOfRange,
  percentage,
  storeStatus,
} from '../domain/status';
import { ZoneEvaluator } from '../domain/zone-evaluation';
import { ReferenceClock } from '../reference-clock';
import { NetworkReadModel, StoreFacts } from './network.read-model';

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

interface Evaluated {
  view: StoreView;
  businessHoursSamples: number;
  withinSamples: number;
}

type Comparator = (a: StoreView, b: StoreView) => number;

const byName: Comparator = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
const nullsLast = (a: number | null, b: number | null, order: 1 | -1) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * order;

/**
 * Store status and indicators are computed in the application from facts read
 * in one query: the rules live in one tested place, and the facts for a few
 * thousand zones fit comfortably in memory.
 */
@Injectable()
export class NetworkService {
  constructor(
    private readonly clock: ReferenceClock,
    private readonly readModel: NetworkReadModel,
    private readonly evaluator: ZoneEvaluator,
  ) {}

  async list(query: StoreListQuery): Promise<StoreListResult> {
    const now = await this.clock.now();
    const range = rangeForPeriod(query.period, now);
    const facts = await this.readModel.storeFacts(
      { customerId: query.customerId, search: query.search },
      range,
      resolutionFor(range),
    );
    const evaluated = facts.map((store) => this.evaluateStore(store, now));
    const matching = evaluated
      .map((e) => e.view)
      .filter((s) => !query.status || s.status === query.status)
      .sort(this.comparator(query.sort, query.order));
    const start = (query.page - 1) * query.pageSize;

    return {
      referenceTime: now,
      period: { key: query.period, ...range },
      summary: summarize(evaluated),
      page: query.page,
      pageSize: query.pageSize,
      total: matching.length,
      items: matching.slice(start, start + query.pageSize),
    };
  }

  private evaluateStore(store: StoreFacts, now: Date): Evaluated {
    const zones = store.zones.map((z): ZoneView => {
      const state = this.evaluator.evaluate(z, store.timezone, now);
      return {
        id: z.id,
        name: z.name,
        deviceId: z.deviceId,
        deviceStatus: state.deviceStatus,
        condition: state.condition,
        isOpen: state.isOpen,
        currentTemperature: state.currentTemperature,
        lastReadingAt: z.lastSampleAt,
        comfortBand: z.band,
        comfortPct: percentage(z.withinSamples, z.businessHoursSamples),
      };
    });
    const businessHoursSamples = sum(
      store.zones.map((z) => z.businessHoursSamples),
    );
    const withinSamples = sum(store.zones.map((z) => z.withinSamples));
    return {
      businessHoursSamples,
      withinSamples,
      view: {
        id: store.id,
        name: store.name,
        kind: store.kind,
        city: store.city,
        state: store.state,
        timezone: store.timezone,
        customer: store.customer,
        status: storeStatus(zones.map((z) => z.deviceStatus)),
        comfortPct: percentage(withinSamples, businessHoursSamples),
        zonesTotal: zones.length,
        zonesOnline: zones.filter((z) => z.deviceStatus === 'online').length,
        zonesOutOfRange: zones.filter((z) => isOutOfRange(z.condition)).length,
        zones,
      },
    };
  }

  private comparator(key: StoreSortKey, order: 'asc' | 'desc'): Comparator {
    const sign = order === 'asc' ? 1 : -1;
    const primary: Record<StoreSortKey, Comparator> = {
      name: (a, b) => byName(a, b) * sign,
      city: (a, b) => a.city.localeCompare(b.city, 'pt-BR') * sign,
      status: (a, b) =>
        (STORE_STATUS_SEVERITY[a.status] - STORE_STATUS_SEVERITY[b.status]) *
        sign,
      comfort: (a, b) => nullsLast(a.comfortPct, b.comfortPct, sign),
      outOfRange: (a, b) => (a.zonesOutOfRange - b.zonesOutOfRange) * sign,
    };
    return (a, b) => primary[key](a, b) || byName(a, b);
  }
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function summarize(stores: Evaluated[]): NetworkSummary {
  const storesByStatus: Record<StoreStatus, number> = {
    online: 0,
    partial: 0,
    offline: 0,
    no_data: 0,
  };
  for (const { view } of stores) storesByStatus[view.status] += 1;
  return {
    stores: stores.length,
    zones: sum(stores.map((s) => s.view.zonesTotal)),
    zonesOnline: sum(stores.map((s) => s.view.zonesOnline)),
    zonesOutOfRange: sum(stores.map((s) => s.view.zonesOutOfRange)),
    comfortPct: percentage(
      sum(stores.map((s) => s.withinSamples)),
      sum(stores.map((s) => s.businessHoursSamples)),
    ),
    storesByStatus,
  };
}
