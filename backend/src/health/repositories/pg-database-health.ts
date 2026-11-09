import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { DatabaseHealth } from '../interfaces/database-health.interface';

@Injectable()
export class PgDatabaseHealth extends DatabaseHealth {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async timescaleVersion(): Promise<string | null> {
    const { rows } = await this.pool.query<{ extversion: string | null }>(
      `SELECT (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb') AS extversion`,
    );
    return rows[0]?.extversion ?? null;
  }
}
