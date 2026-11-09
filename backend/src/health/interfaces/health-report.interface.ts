export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: {
    status: 'up' | 'down';
    timescaledb?: string;
    error?: string;
  };
}
