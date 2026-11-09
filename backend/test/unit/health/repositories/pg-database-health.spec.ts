import { Pool } from 'pg';
import { PgDatabaseHealth } from '../../../../src/health/repositories/pg-database-health';

describe('PgDatabaseHealth', () => {
  const query = jest.fn();
  const health = new PgDatabaseHealth({ query } as unknown as Pool);

  beforeEach(() => query.mockReset());

  it('returns the installed timescaledb version', async () => {
    query.mockResolvedValue({ rows: [{ extversion: '2.17.2' }] });

    await expect(health.timescaleVersion()).resolves.toBe('2.17.2');
  });

  it('returns null when the extension is missing', async () => {
    query.mockResolvedValue({ rows: [{ extversion: null }] });

    await expect(health.timescaleVersion()).resolves.toBeNull();
  });

  it('propagates connection errors', async () => {
    query.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(health.timescaleVersion()).rejects.toThrow('ECONNREFUSED');
  });
});
