import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from './api-context';
import { PeriodKey, StoreListParams } from './types';

export function useStores(params: StoreListParams) {
  const api = useApi();
  return useQuery({
    queryKey: ['stores', params],
    queryFn: ({ signal }) => api.listStores(params, signal),
    // keeps the current page on screen while the next one loads
    placeholderData: keepPreviousData,
  });
}

export function useCustomers() {
  const api = useApi();
  return useQuery({
    queryKey: ['customers'],
    queryFn: ({ signal }) => api.listCustomers(signal),
    staleTime: 5 * 60_000,
  });
}

export function useZoneSummary(zoneId: string, period: PeriodKey) {
  const api = useApi();
  return useQuery({
    queryKey: ['zone-summary', zoneId, period],
    queryFn: ({ signal }) => api.zoneSummary(zoneId, period, signal),
  });
}

export function useZoneSeries(zoneId: string, period: PeriodKey) {
  const api = useApi();
  return useQuery({
    queryKey: ['zone-series', zoneId, period],
    queryFn: ({ signal }) => api.zoneSeries(zoneId, period, signal),
    placeholderData: keepPreviousData,
  });
}
