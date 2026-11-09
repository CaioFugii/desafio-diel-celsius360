export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: {
    status: 'up' | 'down';
    timescaledb?: string;
    error?: string;
  };
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthReport> {
  const res = await fetch('/api/health', { signal });
  const body = (await res.json()) as HealthReport | { message: HealthReport };
  return 'status' in body ? body : body.message;
}
