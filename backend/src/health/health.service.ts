import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: {
    status: 'up' | 'down';
    timescaledb?: string;
    error?: string;
  };
}

@Injectable()
export class HealthService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async check(): Promise<HealthReport> {
    const uptimeSeconds = Math.round(process.uptime());
    try {
      const { rows } = await this.pool.query<{ extversion: string | null }>(
        `SELECT (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb') AS extversion`,
      );
      return {
        status: 'ok',
        uptimeSeconds,
        database: {
          status: 'up',
          timescaledb: rows[0]?.extversion ?? undefined,
        },
      };
    } catch (err) {
      return {
        status: 'degraded',
        uptimeSeconds,
        database: { status: 'down', error: (err as Error).message },
      };
    }
  }
}
