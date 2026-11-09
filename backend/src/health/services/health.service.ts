import { Injectable } from '@nestjs/common';
import { DatabaseHealth } from '../interfaces/database-health.interface';
import { HealthReport } from '../interfaces/health-report.interface';

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseHealth) {}

  async check(): Promise<HealthReport> {
    const uptimeSeconds = Math.round(process.uptime());
    try {
      const timescaledb = await this.database.timescaleVersion();
      return {
        status: 'ok',
        uptimeSeconds,
        database: { status: 'up', timescaledb: timescaledb ?? undefined },
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
