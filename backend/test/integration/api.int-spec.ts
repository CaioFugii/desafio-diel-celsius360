import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PG_POOL } from '../../src/database/database.module';
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

describe('HTTP API over a real database', () => {
  let db: TestDatabase;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    db = await createTestDatabase('api');
    await seedRegistry(db.pool);
    await ingest(db.pool, writeJsonl(SCENARIO_LINES));
    await refreshAggregates(db.pool);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(db.pool)
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await db.drop();
  });

  describe('GET /api/stores', () => {
    it('lists the network with status, indicators and a summary', async () => {
      const res = await http().get('/api/stores?period=1d').expect(200);

      expect(res.body).toMatchObject({
        referenceTime: SCENARIO_NOW.toISOString(),
        period: { key: '1d', to: SCENARIO_NOW.toISOString() },
        page: 1,
        pageSize: 20,
        total: 5,
        summary: {
          stores: 5,
          zones: 25,
          zonesOnline: 3,
          zonesOutOfRange: 1,
          storesByStatus: { online: 0, partial: 2, offline: 0, no_data: 3 },
        },
      });
      const paulista = res.body.items.find((s: any) => s.id === 'LOJA-SP-001');
      expect(paulista).toMatchObject({
        status: 'partial',
        zonesOutOfRange: 1,
        comfortPct: 0,
      });
      expect(paulista.zones[0]).toMatchObject({
        id: 'AMB-008',
        deviceStatus: 'online',
        condition: 'above',
        currentTemperature: 30,
        isOpen: true,
      });
    });

    it('filters, sorts and paginates', async () => {
      const bySearch = await http()
        .get('/api/stores?search=tijuca')
        .expect(200);
      const byStatus = await http()
        .get('/api/stores?status=no_data&sort=name&order=desc')
        .expect(200);
      const page = await http()
        .get('/api/stores?pageSize=2&page=3')
        .expect(200);

      expect(bySearch.body.items.map((s: any) => s.id)).toEqual([
        'LOJA-RJ-001',
      ]);
      expect(byStatus.body.items.map((s: any) => s.name)).toEqual([
        'Loja Boa Viagem',
        'Agência Savassi',
        'Agência Batel',
      ]);
      expect(page.body).toMatchObject({ total: 5, page: 3 });
      expect(page.body.items).toHaveLength(1);
    });

    it.each([
      'period=2d',
      'status=broken',
      'sort=random',
      'page=0',
      'pageSize=101',
      'unknown=1',
    ])('rejects an invalid query (%s)', async (query) => {
      await http().get(`/api/stores?${query}`).expect(400);
    });
  });

  describe('GET /api/zones/:id/series', () => {
    it('returns the aggregated series and gaps of the period', async () => {
      const res = await http()
        .get('/api/zones/AMB-001/series?period=1d')
        .expect(200);

      expect(res.body).toMatchObject({
        zoneId: 'AMB-001',
        resolution: '1m',
        bucketSeconds: 60,
        comfortBand: { min: 21, max: 25 },
      });
      expect(res.body.points).toHaveLength(5);
      expect(res.body.gaps).toHaveLength(3);
    });

    it('accepts an explicit range and picks the resolution from its length', async () => {
      const res = await http()
        .get(
          '/api/zones/AMB-001/series?from=2026-01-01T00:00:00Z&to=2026-01-13T00:00:00Z',
        )
        .expect(200);

      expect(res.body.resolution).toBe('1h');
      expect(res.body.points.map((p: any) => p.samples)).toEqual([1, 5, 1]);
    });

    it('validates the range and the zone', async () => {
      await http()
        .get('/api/zones/AMB-001/series?from=2026-01-01T00:00:00Z')
        .expect(400);
      await http()
        .get('/api/zones/AMB-001/series?from=yesterday&to=today')
        .expect(400);
      await http().get('/api/zones/AMB-404/series').expect(404);
    });
  });

  describe('GET /api/zones/:id/summary', () => {
    it('returns the current state and the period indicators', async () => {
      const res = await http()
        .get('/api/zones/AMB-001/summary?period=1d')
        .expect(200);

      expect(res.body).toMatchObject({
        zone: { id: 'AMB-001', comfortBand: { min: 21, max: 25 } },
        store: { id: 'LOJA-RJ-001' },
        device: { id: 'IOT001', status: 'online' },
        current: { temperature: 23, condition: 'within', isOpen: true },
        indicators: {
          comfortPct: 71.4,
          belowPct: 14.3,
          abovePct: 14.3,
          businessHoursSamples: 7,
          gaps: 3,
          gapMinutes: 1435,
          rejectedReadings: 1,
        },
      });
    });

    it('returns 404 for an unknown zone', async () => {
      await http().get('/api/zones/AMB-404/summary').expect(404);
    });
  });

  it('GET /api/customers lists customers', async () => {
    const res = await http().get('/api/customers').expect(200);

    expect(res.body.map((c: any) => c.id)).toEqual(['CLI-002', 'CLI-001']);
  });

  it('GET /api/ingestion/status reports the ingestion', async () => {
    const res = await http().get('/api/ingestion/status').expect(200);

    expect(res.body).toMatchObject({
      referenceTime: SCENARIO_NOW.toISOString(),
      totals: { rawPackets: 8, samples: 9 },
      unregisteredDevices: ['IOT099'],
    });
  });

  it('serves the OpenAPI document', async () => {
    const res = await http().get('/api/docs-json').expect(200);

    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/stores',
        '/api/zones/{zoneId}/series',
        '/api/zones/{zoneId}/summary',
        '/api/customers',
        '/api/ingestion/status',
      ]),
    );
  });
});
