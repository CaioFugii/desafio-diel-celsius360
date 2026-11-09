import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  Observable,
  Subject,
  bufferTime,
  filter,
  interval,
  map,
  merge,
  share,
  takeUntil,
} from 'rxjs';
import { LiveUpdate, mergeProgress } from '../../domain/live-update';
import { IngestionFeed } from '../interfaces/ingestion-feed.interface';

export const LIVE_UPDATES_OPTIONS = Symbol('LIVE_UPDATES_OPTIONS');

export interface LiveUpdatesOptions {
  /** Batches committed within this window reach the browsers as one update. */
  windowMs: number;
  /** Keeps idle connections alive through proxies and detects dead clients. */
  heartbeatMs: number;
}

export type LiveEvent =
  | { type: 'ingestion'; data: LiveUpdate }
  | { type: 'heartbeat'; data: Record<string, never> };

@Injectable()
export class LiveUpdatesService implements OnModuleDestroy {
  private readonly closed = new Subject<void>();
  private readonly updates: Observable<LiveUpdate>;

  constructor(
    feed: IngestionFeed,
    @Inject(LIVE_UPDATES_OPTIONS) private readonly options: LiveUpdatesOptions,
  ) {
    this.updates = feed.progress().pipe(
      bufferTime(options.windowMs),
      filter((batch) => batch.length > 0),
      map(mergeProgress),
      share(),
    );
  }

  /** One stream per browser; it completes on shutdown so open connections do not hold the server. */
  events(): Observable<LiveEvent> {
    return merge(
      this.updates.pipe(
        map((data): LiveEvent => ({ type: 'ingestion', data })),
      ),
      interval(this.options.heartbeatMs).pipe(
        map((): LiveEvent => ({ type: 'heartbeat', data: {} })),
      ),
    ).pipe(takeUntil(this.closed));
  }

  onModuleDestroy(): void {
    this.closed.next();
    this.closed.complete();
  }
}
