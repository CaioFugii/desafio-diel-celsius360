import { HttpClient } from './http';
import {
  Customer,
  PeriodKey,
  StoreList,
  StoreListParams,
  ZoneSeries,
  ZoneSummary,
} from './types';

export interface MonitoringApi {
  listStores(params: StoreListParams, signal?: AbortSignal): Promise<StoreList>;
  listCustomers(signal?: AbortSignal): Promise<Customer[]>;
  zoneSummary(zoneId: string, period: PeriodKey, signal?: AbortSignal): Promise<ZoneSummary>;
  zoneSeries(zoneId: string, period: PeriodKey, signal?: AbortSignal): Promise<ZoneSeries>;
}

export function createMonitoringApi(http: HttpClient): MonitoringApi {
  const zonePath = (zoneId: string, resource: string) =>
    `/zones/${encodeURIComponent(zoneId)}/${resource}`;
  return {
    listStores: (params, signal) => http.get('/stores', { ...params }, signal),
    listCustomers: (signal) => http.get('/customers', undefined, signal),
    zoneSummary: (zoneId, period, signal) => http.get(zonePath(zoneId, 'summary'), { period }, signal),
    zoneSeries: (zoneId, period, signal) => http.get(zonePath(zoneId, 'series'), { period }, signal),
  };
}
