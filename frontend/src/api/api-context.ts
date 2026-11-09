import { createContext, useContext } from 'react';
import { MonitoringApi } from './monitoring-api';

export const ApiContext = createContext<MonitoringApi | null>(null);

export function useApi(): MonitoringApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
