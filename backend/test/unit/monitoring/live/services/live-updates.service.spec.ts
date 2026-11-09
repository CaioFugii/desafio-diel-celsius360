import { Observable, Subject } from 'rxjs';
import { IngestionFeed } from '../../../../../src/monitoring/live/interfaces/ingestion-feed.interface';
import {
  LiveEvent,
  LiveUpdatesService,
} from '../../../../../src/monitoring/live/services/live-updates.service';
import { IngestionProgress } from '../../../../../src/shared/events/ingestion-progress';

class SubjectFeed extends IngestionFeed {
  readonly source = new Subject<IngestionProgress>();
  subscriptions = 0;

  progress(): Observable<IngestionProgress> {
    return new Observable<IngestionProgress>((subscriber) => {
      this.subscriptions += 1;
      const inner = this.source.subscribe(subscriber);
      return () => {
        this.subscriptions -= 1;
        inner.unsubscribe();
      };
    });
  }
}

const progress = (lastLine: number, zoneIds: string[]): IngestionProgress => ({
  source: 'telemetrias.jsonl',
  lastLine,
  referenceTime: new Date(Date.UTC(2026, 1, 10, 12, 0, lastLine)),
  zoneIds,
});

describe('LiveUpdatesService', () => {
  let feed: SubjectFeed;
  let service: LiveUpdatesService;

  beforeEach(() => {
    jest.useFakeTimers();
    feed = new SubjectFeed();
    service = new LiveUpdatesService(feed, {
      windowMs: 1_000,
      heartbeatMs: 25_000,
    });
  });

  afterEach(() => jest.useRealTimers());

  function collect(): { events: LiveEvent[]; completed: () => boolean } {
    const events: LiveEvent[] = [];
    let done = false;
    service.events().subscribe({
      next: (e) => events.push(e),
      complete: () => (done = true),
    });
    return { events, completed: () => done };
  }

  it('merges the batches of each window into one update', () => {
    const { events } = collect();

    feed.source.next(progress(1, ['AMB-002']));
    feed.source.next(progress(2, ['AMB-001']));
    jest.advanceTimersByTime(1_000);
    jest.advanceTimersByTime(1_000);
    feed.source.next(progress(3, ['AMB-003']));
    jest.advanceTimersByTime(1_000);

    expect(events).toEqual([
      {
        type: 'ingestion',
        data: {
          referenceTime: progress(2, []).referenceTime,
          zoneIds: ['AMB-001', 'AMB-002'],
        },
      },
      {
        type: 'ingestion',
        data: {
          referenceTime: progress(3, []).referenceTime,
          zoneIds: ['AMB-003'],
        },
      },
    ]);
  });

  it('sends heartbeats while idle', () => {
    const { events } = collect();

    jest.advanceTimersByTime(50_000);

    expect(events).toEqual([
      { type: 'heartbeat', data: {} },
      { type: 'heartbeat', data: {} },
    ]);
  });

  it('shares one feed subscription among browsers and releases it when they leave', () => {
    const a = service.events().subscribe();
    const b = service.events().subscribe();
    expect(feed.subscriptions).toBe(1);

    a.unsubscribe();
    expect(feed.subscriptions).toBe(1);
    b.unsubscribe();
    expect(feed.subscriptions).toBe(0);
  });

  it('completes every open stream on shutdown', () => {
    const first = collect();
    const second = collect();

    service.onModuleDestroy();

    expect(first.completed()).toBe(true);
    expect(second.completed()).toBe(true);
    expect(feed.subscriptions).toBe(0);
  });
});
