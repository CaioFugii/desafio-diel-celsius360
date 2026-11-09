import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApiProvider } from './api/ApiProvider';
import { createHttpClient } from './api/http';
import { createLiveUpdates } from './api/live-updates';
import { createMonitoringApi } from './api/monitoring-api';
import App from './App';
import './index.css';
import { ROUTER_FUTURE } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});
const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
const api = createMonitoringApi(
  createHttpClient(apiUrl),
  createLiveUpdates(`${apiUrl}/events`),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={ROUTER_FUTURE}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ApiProvider>
  </StrictMode>,
);
