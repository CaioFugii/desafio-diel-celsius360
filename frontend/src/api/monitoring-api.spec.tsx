import { renderHook } from '@testing-library/react';
import { useApi } from './api-context';
import { HttpClient } from './http';
import { createMonitoringApi } from './monitoring-api';

describe('createMonitoringApi', () => {
  const http = { get: jest.fn().mockResolvedValue('result') } satisfies HttpClient;
  const api = createMonitoringApi(http);
  const signal = new AbortController().signal;

  beforeEach(() => http.get.mockClear());

  it('lists stores with the filters as query parameters', async () => {
    const params = { period: '7d', sort: 'name', order: 'asc', page: 1, pageSize: 20 } as const;
    await expect(api.listStores(params, signal)).resolves.toBe('result');
    expect(http.get).toHaveBeenCalledWith('/stores', params, signal);
  });

  it('lists customers', async () => {
    await api.listCustomers(signal);
    expect(http.get).toHaveBeenCalledWith('/customers', undefined, signal);
  });

  it('requests zone summary and series by period, encoding the zone id', async () => {
    await api.zoneSummary('AMB 1', '7d', signal);
    await api.zoneSeries('AMB 1', '30d', signal);
    expect(http.get).toHaveBeenNthCalledWith(1, '/zones/AMB%201/summary', { period: '7d' }, signal);
    expect(http.get).toHaveBeenNthCalledWith(2, '/zones/AMB%201/series', { period: '30d' }, signal);
  });
});

describe('useApi', () => {
  it('fails loudly when used outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useApi())).toThrow('useApi must be used inside <ApiProvider>');
  });
});
