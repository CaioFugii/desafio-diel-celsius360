import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/database/database.module';

describe('GET /api/health (e2e)', () => {
  let app: INestApplication;
  const query = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue({ query, end: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when the database is up', async () => {
    query.mockResolvedValueOnce({ rows: [{ extversion: '2.17.2' }] });

    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body.database.status).toBe('up');
  });

  it('returns 503 when the database is down', async () => {
    query.mockRejectedValueOnce(new Error('down'));

    await request(app.getHttpServer()).get('/api/health').expect(503);
  });
});
