import { Test } from '@nestjs/testing';
import { PG_POOL } from '../database/database.module';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const query = jest.fn();
  let service: HealthService;

  beforeEach(async () => {
    query.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PG_POOL, useValue: { query } }],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it('reports ok with the timescaledb version when the database answers', async () => {
    query.mockResolvedValue({ rows: [{ extversion: '2.17.2' }] });

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.database).toEqual({ status: 'up', timescaledb: '2.17.2' });
  });

  it('reports degraded when the database is unreachable', async () => {
    query.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.database).toEqual({
      status: 'down',
      error: 'connect ECONNREFUSED',
    });
  });
});
