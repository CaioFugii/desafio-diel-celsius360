import { LocalTimeResolver } from '../../../../src/shared/time/local-time';
import { Ds18b20QualityPolicy } from '../../../../src/telemetry/domain/reading-quality';
import { IngestionOptions } from '../../../../src/ingestion/interfaces/ingestion-runner.interface';
import { IngestionRunner } from '../../../../src/ingestion/services/ingestion.runner';
import {
  Checkpoint,
  IngestionBatch,
  IngestionStore,
} from '../../../../src/ingestion/interfaces/ingestion-store.interface';
import { IngestionNotifier } from '../../../../src/ingestion/interfaces/ingestion-notifier.interface';
import { PacketEnricher } from '../../../../src/ingestion/services/packet-enricher';
import { IngestionProgress } from '../../../../src/shared/events/ingestion-progress';
import { Pacer } from '../../../../src/ingestion/interfaces/pacer.interface';
import {
  SourceLine,
  TelemetrySource,
} from '../../../../src/ingestion/interfaces/telemetry-source.interface';
import {
  directoryOf,
  packetLine,
  zoneContext,
} from '../../support/ingestion.fixtures';

class ArraySource implements TelemetrySource {
  readonly name = 'test.jsonl';

  constructor(private readonly texts: string[]) {}

  async *read(afterLine: number): AsyncIterable<SourceLine> {
    for (const [i, text] of this.texts.entries()) {
      if (i + 1 > afterLine) yield { lineNo: i + 1, text };
    }
  }
}

class InMemoryStore extends IngestionStore {
  batches: IngestionBatch[] = [];
  events: string[] = [];

  constructor(private saved: Checkpoint | null = null) {
    super();
  }

  async checkpoint(): Promise<Checkpoint | null> {
    return this.saved;
  }

  async markStarted(): Promise<void> {
    this.events.push('started');
  }

  async persist(batch: IngestionBatch): Promise<void> {
    this.batches.push(batch);
    this.events.push(`persist:${batch.lastLine}`);
  }

  async markCompleted(): Promise<void> {
    this.events.push('completed');
  }
}

class RecordingNotifier extends IngestionNotifier {
  notified: Array<{ progress: IngestionProgress; persistedBatches: number }> =
    [];

  constructor(private readonly store: InMemoryStore) {
    super();
  }

  async batchCommitted(progress: IngestionProgress): Promise<void> {
    this.notified.push({
      progress,
      persistedBatches: this.store.batches.length,
    });
  }
}

class RecordingPacer implements Pacer {
  throttled: number[] = [];

  start(): void {}

  async throttle(processed: number): Promise<void> {
    this.throttled.push(processed);
  }
}

const lines = [
  packetLine('IOT001', '2026-01-12T09:00:00', [22, 23]),
  packetLine('IOT001', '2026-01-12T09:06:00', [23, -127]),
  'garbage',
  packetLine('IOT099', '2026-01-12T09:07:00', [24]),
  packetLine('IOT001', '2026-01-12T08:00:00', [21], { saved_data: true }),
];

function runner(
  store: InMemoryStore,
  pacer = new RecordingPacer(),
  options: Partial<IngestionOptions> = {},
  texts = lines,
  notifier = new RecordingNotifier(store),
) {
  return new IngestionRunner(
    new ArraySource(texts),
    store,
    notifier,
    new PacketEnricher(
      directoryOf({ IOT001: zoneContext() }),
      new Ds18b20QualityPolicy(),
      new LocalTimeResolver(),
    ),
    pacer,
    { batchSize: 2, fromStart: false, progressEvery: 2, ...options },
    { log: jest.fn() },
  );
}

const checkpointAt = (lastLine: number): Checkpoint => ({
  source: 'test.jsonl',
  lastLine,
  referenceTime: new Date('2026-01-12T12:06:00Z'),
  startedAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
});

describe('IngestionRunner', () => {
  it('processes the source in order, in batches, and reports what happened', async () => {
    const store = new InMemoryStore();
    const pacer = new RecordingPacer();

    const report = await runner(store, pacer).run();

    expect(store.events).toEqual([
      'started',
      'persist:2',
      'persist:4',
      'persist:5',
      'completed',
    ]);
    expect(pacer.throttled).toEqual([2, 2, 1]);
    expect(report).toEqual({
      source: 'test.jsonl',
      resumedAfterLine: 0,
      lastLine: 5,
      lines: 5,
      packets: 4,
      invalidLines: 1,
      unknownDevicePackets: 1,
      samples: 4,
      rejectedSamples: 1,
      // the late (saved_data) packet does not move "now" backwards
      referenceTime: new Date('2026-01-12T12:07:00Z'),
      aborted: false,
    });
  });

  it('keeps invalid lines with the reason, next to the valid packets of the batch', async () => {
    const store = new InMemoryStore();

    await runner(store).run();

    expect(store.batches[1].invalidLines).toEqual([
      { lineNo: 3, text: 'garbage', reason: 'invalid_json' },
    ]);
    expect(store.batches[1].packets.map((p) => p.lineNo)).toEqual([4]);
  });

  it('notifies each committed batch with the zones it touched and the current "now"', async () => {
    const store = new InMemoryStore();
    const notifier = new RecordingNotifier(store);

    await runner(store, undefined, {}, lines, notifier).run();

    expect(notifier.notified).toEqual([
      {
        persistedBatches: 1,
        progress: {
          source: 'test.jsonl',
          lastLine: 2,
          referenceTime: new Date('2026-01-12T12:06:00Z'),
          zoneIds: ['AMB-001'],
        },
      },
      {
        persistedBatches: 2,
        progress: {
          source: 'test.jsonl',
          lastLine: 4,
          referenceTime: new Date('2026-01-12T12:07:00Z'),
          zoneIds: [],
        },
      },
      {
        persistedBatches: 3,
        progress: {
          source: 'test.jsonl',
          lastLine: 5,
          referenceTime: new Date('2026-01-12T12:07:00Z'),
          zoneIds: ['AMB-001'],
        },
      },
    ]);
  });

  it('resumes after the stored checkpoint', async () => {
    const store = new InMemoryStore(checkpointAt(4));

    const report = await runner(store).run();

    expect(report.resumedAfterLine).toBe(4);
    expect(report.lines).toBe(1);
    expect(store.events).toEqual(['started', 'persist:5', 'completed']);
    expect(report.referenceTime).toEqual(new Date('2026-01-12T12:06:00Z'));
  });

  it('replays everything when asked to start over', async () => {
    const store = new InMemoryStore(checkpointAt(4));

    const report = await runner(store, undefined, { fromStart: true }).run();

    expect(report.resumedAfterLine).toBe(0);
    expect(report.lines).toBe(5);
  });

  it('stops after the current batch when aborted and does not mark completion', async () => {
    const store = new InMemoryStore();
    const stop = new AbortController();
    const pacer = new RecordingPacer();
    pacer.throttle = async (n) => {
      pacer.throttled.push(n);
      stop.abort();
    };

    const report = await runner(store, pacer).run(stop.signal);

    expect(report.aborted).toBe(true);
    expect(store.events).toEqual(['started', 'persist:2']);
  });

  it('rejects a batch size below one', () => {
    expect(() =>
      runner(new InMemoryStore(), undefined, { batchSize: 0 }),
    ).toThrow(/batchSize/);
  });

  it('completes without persisting when there is nothing new', async () => {
    const store = new InMemoryStore();

    const report = await runner(store, undefined, {}, []).run();

    expect(store.events).toEqual(['started', 'completed']);
    expect(report.lines).toBe(0);
  });
});
