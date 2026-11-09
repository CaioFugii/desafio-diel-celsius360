import { PgIngestionStatusReadModel } from '../../src/monitoring/ingestion-status/repositories/pg-ingestion-status.read-model';
import { PgReferenceClock } from '../../src/monitoring/repositories/pg-reference-clock';
import { PgNetworkReadModel } from '../../src/monitoring/stores/repositories/pg-network.read-model';
import { PgZonesReadModel } from '../../src/monitoring/zones/repositories/pg-zones.read-model';
import { OFFLINE_AFTER_MS } from '../../src/monitoring/domain/status';
import {
  SCENARIO_LINES,
  SCENARIO_NOW,
  ingest,
  seedRegistry,
  writeJsonl,
} from '../support/scenario';
import {
  TestDatabase,
  createTestDatabase,
  refreshAggregates,
} from '../support/test-database';

const at = (iso: string) => new Date(iso);
const RANGE = { from: at('2026-01-12T12:00:00Z'), to: SCENARIO_NOW };

describe('read models (PostgreSQL + continuous aggregates)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase('read');
    await seedRegistry(db.pool);
  });

  afterAll(() => db.drop());

  it('falls back to the wall clock before any ingestion', async () => {
    const before = Date.now();

    const now = await new PgReferenceClock(db.pool).now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
  });

  describe('after the scenario is ingested', () => {
    beforeAll(async () => {
      await ingest(db.pool, writeJsonl(SCENARIO_LINES));
      await refreshAggregates(db.pool);
    });

    it('uses the latest packet as "now"', async () => {
      expect(await new PgReferenceClock(db.pool).now()).toEqual(SCENARIO_NOW);
    });

    describe('PgNetworkReadModel', () => {
      const readModel = () => new PgNetworkReadModel(db.pool);

      it('returns every store with its zones, device state and comfort counts', async () => {
        const stores = await readModel().storeFacts({}, RANGE, '1m');

        expect(stores.map((s) => s.id)).toEqual([
          'LOJA-MG-001',
          'LOJA-PE-001',
          'LOJA-PR-001',
          'LOJA-RJ-001',
          'LOJA-SP-001',
        ]);
        const tijuca = stores.find((s) => s.id === 'LOJA-RJ-001');
        expect(tijuca).toMatchObject({
          name: 'Loja Tijuca',
          timezone: 'America/Sao_Paulo',
          customer: { id: 'CLI-001', name: 'Moda Carioca' },
        });
        expect(tijuca?.zones).toHaveLength(7);
        expect(tijuca?.zones[0]).toMatchObject({
          id: 'AMB-001',
          deviceId: 'IOT001',
          band: { min: 21, max: 25 },
          lastPacketAt: SCENARIO_NOW,
          lastTemperature: 23,
          businessHoursSamples: 7,
          withinSamples: 5,
        });
        expect(tijuca?.zones[2]).toMatchObject({
          id: 'AMB-003',
          lastPacketAt: null,
          businessHoursSamples: 0,
        });
      });

      it.each(['15m', '1h'] as const)(
        'gives the same counts from the %s aggregate',
        async (res) => {
          const stores = await readModel().storeFacts({}, RANGE, res);
          const zone = stores.find((s) => s.id === 'LOJA-RJ-001')?.zones[0];

          expect(zone).toMatchObject({
            businessHoursSamples: 7,
            withinSamples: 5,
          });
        },
      );

      it('filters by customer and by a case-insensitive search', async () => {
        const byCustomer = await readModel().storeFacts(
          { customerId: 'CLI-002' },
          RANGE,
          '1m',
        );
        const bySearch = await readModel().storeFacts(
          { search: 'PAULISTA' },
          RANGE,
          '1m',
        );
        const byCity = await readModel().storeFacts(
          { search: 'recife' },
          RANGE,
          '1m',
        );
        const literal = await readModel().storeFacts(
          { search: '%' },
          RANGE,
          '1m',
        );

        expect(byCustomer.map((s) => s.id)).toEqual([
          'LOJA-MG-001',
          'LOJA-PR-001',
        ]);
        expect(bySearch.map((s) => s.id)).toEqual(['LOJA-SP-001']);
        expect(byCity.map((s) => s.id)).toEqual(['LOJA-PE-001']);
        expect(literal).toEqual([]);
      });
    });

    describe('PgZonesReadModel', () => {
      const zones = () => new PgZonesReadModel(db.pool);

      it('finds a zone with its store, customer and device state', async () => {
        expect(await zones().findZone('AMB-001')).toMatchObject({
          id: 'AMB-001',
          name: 'Salão de vendas - Vitrine',
          band: { min: 21, max: 25 },
          deviceId: 'IOT001',
          lastSampleAt: SCENARIO_NOW,
          store: {
            id: 'LOJA-RJ-001',
            city: 'Rio de Janeiro',
            timezone: 'America/Sao_Paulo',
          },
          customer: { id: 'CLI-001' },
        });
        expect(await zones().findZone('AMB-404')).toBeNull();
      });

      it('returns the series per minute, including the bucket at "now"', async () => {
        const points = await zones().series('AMB-001', RANGE, '1m');

        expect(points).toEqual([
          {
            t: at('2026-01-12T12:30:00Z'),
            avg: 24,
            min: 24,
            max: 24,
            samples: 1,
          },
          {
            t: at('2026-01-12T13:04:00Z'),
            avg: 22.5,
            min: 22,
            max: 23,
            samples: 2,
          },
          {
            t: at('2026-01-12T13:05:00Z'),
            avg: 25,
            min: 24,
            max: 26,
            samples: 2,
          },
          {
            t: at('2026-01-12T13:07:00Z'),
            avg: 20,
            min: 20,
            max: 20,
            samples: 1,
          },
          {
            t: at('2026-01-12T14:00:00Z'),
            avg: 23,
            min: 23,
            max: 23,
            samples: 1,
          },
        ]);
      });

      it('composes coarser resolutions from the finer aggregates', async () => {
        const quarter = await zones().series('AMB-001', RANGE, '15m');
        const hour = await zones().series('AMB-001', RANGE, '1h');

        expect(
          quarter.map((p) => [p.t.toISOString(), p.avg, p.samples]),
        ).toEqual([
          ['2026-01-12T12:30:00.000Z', 24, 1],
          ['2026-01-12T13:00:00.000Z', 23, 5],
          ['2026-01-12T14:00:00.000Z', 23, 1],
        ]);
        expect(
          hour.map((p) => [p.t.toISOString(), p.min, p.max, p.samples]),
        ).toEqual([
          ['2026-01-12T12:00:00.000Z', 24, 24, 1],
          ['2026-01-12T13:00:00.000Z', 20, 26, 5],
          ['2026-01-12T14:00:00.000Z', 23, 23, 1],
        ]);
      });

      it('aggregates the period statistics', async () => {
        expect(await zones().stats('AMB-001', RANGE, '1m')).toEqual({
          samples: 7,
          avg: 23.14,
          min: 20,
          max: 26,
          businessHoursSamples: 7,
          within: 5,
          below: 1,
          above: 1,
        });
        expect(await zones().stats('AMB-003', RANGE, '1h')).toMatchObject({
          samples: 0,
          avg: null,
          min: null,
        });
      });

      it('finds gaps of at least the offline threshold, edges included', async () => {
        const gaps = await zones().gaps('AMB-001', RANGE, OFFLINE_AFTER_MS);

        expect(gaps).toEqual([
          { from: at('2026-01-12T12:00:00Z'), to: at('2026-01-12T12:30:00Z') },
          { from: at('2026-01-12T12:31:00Z'), to: at('2026-01-12T13:04:00Z') },
          { from: at('2026-01-12T13:08:00Z'), to: at('2026-01-12T14:00:00Z') },
        ]);
        expect(await zones().gaps('AMB-003', RANGE, OFFLINE_AFTER_MS)).toEqual([
          RANGE,
        ]);
      });

      it('counts the readings discarded in the range', async () => {
        expect(await zones().rejectedReadings('AMB-001', RANGE)).toBe(1);
        expect(await zones().rejectedReadings('AMB-002', RANGE)).toBe(0);
      });

      it('serves data newer than the last refresh (real-time aggregation)', async () => {
        await ingest(
          db.pool,
          writeJsonl(
            [
              JSON.stringify({
                dev_id: 'IOT003',
                timestamp: '2026-01-12T12:00:00',
                GMT: -3,
                samplingTime: 30,
                Temperature: [23.5],
              }),
            ],
            'late-feed.jsonl',
          ),
        );

        const points = await zones().series(
          'AMB-003',
          { from: RANGE.from, to: at('2026-01-12T15:00:00Z') },
          '1h',
        );

        expect(points).toEqual([
          {
            t: at('2026-01-12T15:00:00Z'),
            avg: 23.5,
            min: 23.5,
            max: 23.5,
            samples: 1,
          },
        ]);
      });
    });

    it('reports ingestion progress and data quality totals', async () => {
      const status = await new PgIngestionStatusReadModel(db.pool).status();

      expect(status.referenceTime).toEqual(at('2026-01-12T15:00:00Z'));
      expect(status.sources.map((s) => [s.source, s.lastLine])).toEqual([
        ['late-feed.jsonl', 1],
        ['telemetrias.jsonl', 9],
      ]);
      expect(status.totals).toEqual({
        rawPackets: 9,
        samples: 10,
        rejectedReadings: 1,
        invalidLines: 1,
      });
      expect(status.unregisteredDevices).toEqual(['IOT099']);
    });
  });
});
