import { Logger } from '@nestjs/common';
import { Client } from 'pg';
import { Observable, retry, share, timer } from 'rxjs';
import {
  INGESTION_PROGRESS_CHANNEL,
  IngestionProgress,
  decodeProgress,
} from '../../../shared/events/ingestion-progress';
import { IngestionFeed } from '../interfaces/ingestion-feed.interface';

/**
 * LISTEN needs a dedicated connection (not a pooled one). It is opened with the
 * first subscriber, closed after the last one leaves, and reopened after errors.
 */
export class PgIngestionFeed extends IngestionFeed {
  private readonly logger = new Logger('IngestionFeed');
  private readonly feed: Observable<IngestionProgress>;

  constructor(connectionString: string, retryDelayMs = 2_000) {
    super();
    this.feed = new Observable<IngestionProgress>((subscriber) => {
      const client = new Client({ connectionString });
      client.on('notification', ({ channel, payload }) => {
        if (channel !== INGESTION_PROGRESS_CHANNEL || !payload) return;
        const progress = decodeProgress(payload);
        if (progress) subscriber.next(progress);
      });
      client.on('error', (err) => subscriber.error(err));
      client
        .connect()
        .then(() => client.query(`LISTEN ${INGESTION_PROGRESS_CHANNEL}`))
        .catch((err: Error) => subscriber.error(err));
      return () => {
        client.removeAllListeners();
        client.on('error', () => undefined);
        client.end().catch(() => undefined);
      };
    }).pipe(
      retry({
        delay: (err: Error) => {
          this.logger.warn(`listener failed, retrying: ${err.message}`);
          return timer(retryDelayMs);
        },
      }),
      share(),
    );
  }

  progress(): Observable<IngestionProgress> {
    return this.feed;
  }
}
