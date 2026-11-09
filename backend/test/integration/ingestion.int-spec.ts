import { appendFileSync } from 'node:fs';
import { PgIngestionStore } from '../../src/ingestion/repositories/pg-ingestion.store';
import {
  SCENARIO_LINES,
  SCENARIO_NOW,
  ingest,
  seedRegistry,
  writeJsonl,
} from '../support/scenario';
import {
  TestDatabase,
  count,
  createTestDatabase,
} from '../support/test-database';

describe('ingestion (PostgreSQL)', () => {
  let db: TestDatabase;
  let file: string;

  const totals = async () => ({
    raw: await count(db.pool, 'raw.packets'),
    invalid: await count(db.pool, 'raw.rejected_lines'),
    samples: await count(db.pool, 'telemetry.samples'),
    rejected: await count(db.pool, 'telemetry.rejected_samples'),
  });

  beforeAll(async () => {
    db = await createTestDatabase('ingestion');
    await seedRegistry(db.pool);
    file = writeJsonl(SCENARIO_LINES);
  });

  afterAll(() => db.drop());

  it('stores raw packets as they arrived and the treated series without duplicates', async () => {
    const report = await ingest(db.pool, file);

    expect(report).toMatchObject({
      lastLine: 9,
      packets: 8,
      invalidLines: 1,
      unknownDevicePackets: 1,
      rejectedSamples: 1,
      referenceTime: SCENARIO_NOW,
      aborted: false,
    });
    // the broker duplicate is kept in raw (two lines) but not in the series
    expect(await totals()).toEqual({
      raw: 8,
      invalid: 1,
      samples: 9,
      rejected: 1,
    });
  });

  it('enriches each sample with business hours and comfort', async () => {
    const { rows } = await db.pool.query(
      `SELECT ts, temperature, business_hours, comfort FROM telemetry.samples
       WHERE device_id = 'IOT001' ORDER BY ts`,
    );

    expect(
      rows.map((r) => [
        r.ts.toISOString(),
        r.temperature,
        r.business_hours,
        r.comfort,
      ]),
    ).toEqual([
      ['2026-01-12T12:30:00.000Z', 24, true, 0],
      ['2026-01-12T13:04:00.000Z', 22, true, 0],
      ['2026-01-12T13:04:30.000Z', 23, true, 0],
      ['2026-01-12T13:05:00.000Z', 24, true, 0],
      ['2026-01-12T13:05:30.000Z', 26, true, 1],
      ['2026-01-12T13:07:30.000Z', 20, true, -1],
      ['2026-01-12T14:00:00.000Z', 23, true, 0],
    ]);
  });

  it('records the reason of every discarded line and reading', async () => {
    const lines = await db.pool.query(
      'SELECT line_no, reason FROM raw.rejected_lines',
    );
    const readings = await db.pool.query(
      'SELECT device_id, ts, temperature, reason FROM telemetry.rejected_samples',
    );

    expect(lines.rows).toEqual([{ line_no: 5, reason: 'invalid_json' }]);
    expect(readings.rows).toEqual([
      {
        device_id: 'IOT001',
        ts: new Date('2026-01-12T13:07:00Z'),
        temperature: -127,
        reason: 'sensor_error_code',
      },
    ]);
  });

  it('keeps the latest state per device even when late packets arrive afterwards', async () => {
    const { rows } = await db.pool.query(
      `SELECT device_id, first_packet_at, last_packet_at, last_sample_at, last_temperature
       FROM ingestion.device_state WHERE device_id IN ('IOT001', 'IOT099') ORDER BY device_id`,
    );

    expect(rows).toEqual([
      {
        device_id: 'IOT001',
        first_packet_at: new Date('2026-01-12T12:30:00Z'),
        last_packet_at: SCENARIO_NOW,
        last_sample_at: SCENARIO_NOW,
        last_temperature: 23,
      },
      {
        device_id: 'IOT099',
        first_packet_at: new Date('2026-01-12T13:08:00Z'),
        last_packet_at: new Date('2026-01-12T13:08:00Z'),
        last_sample_at: null,
        last_temperature: null,
      },
    ]);
  });

  it('checkpoints the last line and the reference time', async () => {
    const checkpoint = await new PgIngestionStore(db.pool).checkpoint(
      'telemetrias.jsonl',
    );

    expect(checkpoint).toMatchObject({
      lastLine: 9,
      referenceTime: SCENARIO_NOW,
    });
    expect(checkpoint?.completedAt).toBeInstanceOf(Date);
  });

  it('can be replayed from the start without duplicating or corrupting data', async () => {
    const before = await totals();
    const state = await db.pool.query(
      'SELECT * FROM ingestion.device_state ORDER BY device_id',
    );

    const report = await ingest(db.pool, file, {
      fromStart: true,
      batchSize: 2,
    });

    expect(report.resumedAfterLine).toBe(0);
    expect(await totals()).toEqual(before);
    const after = await db.pool.query(
      'SELECT * FROM ingestion.device_state ORDER BY device_id',
    );
    const withoutUpdatedAt = (row: Record<string, unknown>) => {
      const copy = { ...row };
      delete copy.updated_at;
      return copy;
    };
    expect(after.rows.map(withoutUpdatedAt)).toEqual(
      state.rows.map(withoutUpdatedAt),
    );
  });

  it('resumes after the checkpoint when the source grows', async () => {
    appendFileSync(
      file,
      JSON.stringify({
        dev_id: 'IOT001',
        timestamp: '2026-01-12T11:06:00',
        GMT: -3,
        samplingTime: 30,
        Temperature: [24],
      }) + '\n',
    );

    const report = await ingest(db.pool, file);

    expect(report).toMatchObject({
      resumedAfterLine: 9,
      lines: 1,
      lastLine: 10,
    });
    expect(report.referenceTime).toEqual(new Date('2026-01-12T14:06:00Z'));
    expect((await totals()).samples).toBe(10);
  });

  it('persists a batch atomically: one bad packet keeps the whole batch out', async () => {
    const store = new PgIngestionStore(db.pool);
    const before = await totals();
    const checkpoint = await store.checkpoint('telemetrias.jsonl');
    const sample = {
      ts: new Date('2026-01-13T13:00:00Z'),
      deviceId: 'IOT001',
      zoneId: 'AMB-001',
      temperature: 22,
      businessHours: true,
      comfort: 'within' as const,
    };
    const enriched = (text: string) => ({
      lineNo: 99,
      text,
      enriched: {
        packet: {
          deviceId: 'IOT001',
          sentAt: sample.ts,
          gmtOffsetHours: -3,
          samplingSeconds: 30,
          readings: [22],
          savedData: false,
          payload: {},
        },
        zoneId: 'AMB-001',
        samples: [sample],
        rejected: [],
      },
    });

    await expect(
      store.persist({
        source: 'telemetrias.jsonl',
        lastLine: 99,
        packets: [enriched('{"ok":true}'), enriched('{broken')],
        invalidLines: [
          { lineNo: 98, text: 'x\u0000y', reason: 'invalid_json' },
        ],
      }),
    ).rejects.toThrow(/json/i);

    expect(await totals()).toEqual(before);
    expect((await store.checkpoint('telemetrias.jsonl'))?.lastLine).toBe(
      checkpoint?.lastLine,
    );
  });

  it('stores invalid lines even when they contain NUL bytes', async () => {
    await new PgIngestionStore(db.pool).persist({
      source: 'nul.jsonl',
      lastLine: 1,
      packets: [],
      invalidLines: [{ lineNo: 1, text: 'x\u0000y', reason: 'invalid_json' }],
    });

    const { rows } = await db.pool.query(
      "SELECT line FROM raw.rejected_lines WHERE source = 'nul.jsonl'",
    );
    expect(rows).toEqual([{ line: 'xy' }]);
  });

  it('does not move the reference time backwards when only old packets arrive', async () => {
    const store = new PgIngestionStore(db.pool);
    const before = await store.checkpoint('telemetrias.jsonl');

    await ingest(
      db.pool,
      writeJsonl(SCENARIO_LINES.slice(6, 7), 'telemetrias.jsonl'),
      {
        fromStart: true,
      },
    );

    expect(
      (await store.checkpoint('telemetrias.jsonl'))?.referenceTime,
    ).toEqual(before?.referenceTime);
  });
});
