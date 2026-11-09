import { DatabaseHealth } from '../../../../src/health/interfaces/database-health.interface';
import { HealthService } from '../../../../src/health/services/health.service';

class StubDatabaseHealth extends DatabaseHealth {
  timescaleVersion = jest.fn<Promise<string | null>, []>();
}

describe('HealthService', () => {
  let database: StubDatabaseHealth;
  let service: HealthService;

  beforeEach(() => {
    database = new StubDatabaseHealth();
    service = new HealthService(database);
  });

  it('reports ok with the timescaledb version when the database answers', async () => {
    database.timescaleVersion.mockResolvedValue('2.17.2');

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.database).toEqual({ status: 'up', timescaledb: '2.17.2' });
  });

  it('omits the version when the extension is not installed', async () => {
    database.timescaleVersion.mockResolvedValue(null);

    const report = await service.check();

    expect(report.database).toEqual({ status: 'up', timescaledb: undefined });
  });

  it('reports degraded when the database is unreachable', async () => {
    database.timescaleVersion.mockRejectedValue(
      new Error('connect ECONNREFUSED'),
    );

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.database).toEqual({
      status: 'down',
      error: 'connect ECONNREFUSED',
    });
  });
});
