import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import {
  INGESTION_PROGRESS_CHANNEL,
  IngestionProgress,
  encodeProgress,
} from '../../shared/events/ingestion-progress';
import { IngestionNotifier } from '../interfaces/ingestion-notifier.interface';

@Injectable()
export class PgIngestionNotifier extends IngestionNotifier {
  private readonly logger = new Logger('IngestionNotifier');

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async batchCommitted(progress: IngestionProgress): Promise<void> {
    try {
      await this.pool.query('SELECT pg_notify($1, $2)', [
        INGESTION_PROGRESS_CHANNEL,
        encodeProgress(progress),
      ]);
    } catch (err) {
      this.logger.warn(`notification lost: ${(err as Error).message}`);
    }
  }
}
