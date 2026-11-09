import { ReactNode } from 'react';
import { ApiContext } from './api-context';
import { MonitoringApi } from './monitoring-api';

export function ApiProvider({ api, children }: { api: MonitoringApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
