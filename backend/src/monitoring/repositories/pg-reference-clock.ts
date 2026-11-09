import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { ReferenceClock } from '../interfaces/reference-clock.interface';

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
