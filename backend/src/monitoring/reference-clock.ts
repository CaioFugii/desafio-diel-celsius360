import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

/**
 * "Now" for every rule is the instant of the latest packet processed by the
 * ingestion, not the wall clock. Before any ingestion it falls back to the
 * wall clock, so periods are still well defined (and simply empty).
 */
export abstract class ReferenceClock {
  abstract now(): Promise<Date>;
}

@Injectable()
export class PgReferenceClock extends ReferenceClock {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async now(): Promise<Date> {
    const { rows } = await this.pool.query<{ now: Date | null }>(
      'SELECT max(reference_time) AS now FROM ingestion.checkpoints',
    );
    return rows[0]?.now ?? new Date();
  }
}
