import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PG_POOL } from '../../src/database/database.module';
import { PgIngestionNotifier } from '../../src/ingestion/repositories/pg-ingestion.notifier';
import { IngestionFeed } from '../../src/monitoring/live/interfaces/ingestion-feed.interface';
import { PgIngestionFeed } from '../../src/monitoring/live/repositories/pg-ingestion.feed';
import { LIVE_UPDATES_OPTIONS } from '../../src/monitoring/live/services/live-updates.service';
import {
  SCENARIO_LINES,
  ingest,
  seedRegistry,
  writeJsonl,
} from '../support/scenario';
import { TestDatabase, createTestDatabase } from '../support/test-database';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function listeners(db: TestDatabase): Promise<number> {
  const { rows } = await db.pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND query LIKE 'LISTEN%'`,
  );
  return rows[0].n;
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out');
    await sleep(50);
  }
}

describe('real-time updates over a real database', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase('live');
    await seedRegistry(db.pool);
  });

  afterAll(async () => {
    await db.drop();
  });

  it('delivers every committed batch to the listener and closes it when nobody listens', async () => {
    const feed = new PgIngestionFeed(db.url);
    const received = firstValueFrom(feed.progress().pipe(take(3), toArray()));
    await waitFor(async () => (await listeners(db)) === 1);

    await ingest(db.pool, writeJsonl(SCENARIO_LINES.slice(0, 9)), {
      batchSize: 3,
    });

    const events = await received;
    expect(events.map((e) => e.lastLine)).toEqual([3, 6, 9]);
    expect(events[0]).toMatchObject({
      source: 'telemetrias.jsonl',
      referenceTime: expect.any(Date),
    });
    expect(events.flatMap((e) => e.zoneIds ?? [])).not.toHaveLength(0);
    await waitFor(async () => (await listeners(db)) === 0);
  });

  describe('GET /api/events', () => {
    let app: INestApplication;
    let baseUrl: string;
    let closed = false;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PG_POOL)
        .useValue(db.pool)
        .overrideProvider(IngestionFeed)
        .useValue(new PgIngestionFeed(db.url))
        .overrideProvider(LIVE_UPDATES_OPTIONS)
        .useValue({ windowMs: 100, heartbeatMs: 60_000 })
        .compile();
      app = configureApp(moduleRef.createNestApplication());
      await app.listen(0, '127.0.0.1');
      const { port } = app.getHttpServer().address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      if (!closed) await app.close();
    });

    it('streams ingestion updates as Server-Sent Events', async () => {
      const abort = new AbortController();
      const res = await fetch(`${baseUrl}/api/events`, {
        signal: abort.signal,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      await waitFor(async () => (await listeners(db)) === 1);
      await new PgIngestionNotifier(db.pool).batchCommitted({
        source: 'telemetrias.jsonl',
        lastLine: 42,
        referenceTime: new Date('2026-01-12T14:00:00Z'),
        zoneIds: ['AMB-001'],
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('\n\n')) {
        const { value } = await reader.read();
        text += decoder.decode(value, { stream: true });
      }
      abort.abort();

      expect(text).toContain('event: ingestion');
      const data = /data: (.*)/.exec(text)?.[1];
      expect(JSON.parse(data!)).toEqual({
        referenceTime: '2026-01-12T14:00:00.000Z',
        zoneIds: ['AMB-001'],
      });
    });

    it('ends open streams on shutdown instead of holding the server', async () => {
      const res = await fetch(`${baseUrl}/api/events`);
      const reader = res.body!.getReader();
      const ended = (async () => {
        for (;;) if ((await reader.read()).done) return true;
      })();

      await app.close();
      closed = true;

      await expect(ended).resolves.toBe(true);
    });
  });
});
