import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiProvider } from '../api/ApiProvider';
import { MonitoringApi } from '../api/monitoring-api';
import { ROUTER_FUTURE } from '../router';
import { CUSTOMERS, storeList, zoneSeries, zoneSummary } from './fixtures';

export type FakeApi = { [K in keyof MonitoringApi]: jest.MockedFunction<MonitoringApi[K]> };

export function fakeApi(overrides: Partial<FakeApi> = {}): FakeApi {
  return {
    listStores: jest.fn().mockResolvedValue(storeList()),
    listCustomers: jest.fn().mockResolvedValue(CUSTOMERS),
    zoneSummary: jest.fn().mockResolvedValue(zoneSummary()),
    zoneSeries: jest.fn().mockResolvedValue(zoneSeries()),
    subscribeToUpdates: jest.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

/** Prints the current URL so tests can assert on navigation and query string. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

interface RenderOptions {
  api?: FakeApi;
  route?: string;
  path?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { api = fakeApi(), route = '/', path }: RenderOptions = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const result = render(
    <ApiProvider api={api}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE}>
          {path ? (
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<p>outra página</p>} />
            </Routes>
          ) : (
            ui
          )}
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </ApiProvider>,
  );
  return { ...result, api };
}
