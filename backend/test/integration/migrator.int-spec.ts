import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMigrations } from '../../src/database/migrator';
import { TestDatabase, createTestDatabase } from '../support/test-database';

describe('runMigrations', () => {
  let db: TestDatabase;
  let dir: string;

  beforeAll(async () => {
    db = await createTestDatabase('migrator');
    dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  });

  afterAll(() => db.drop());

  it('applies new files in order and skips the ones already applied', async () => {
    writeFileSync(
      join(dir, '0001_a.sql'),
      'CREATE TABLE mig_a (id int PRIMARY KEY);',
    );
    writeFileSync(
      join(dir, '0002_b.sql'),
      'CREATE TABLE mig_b (id int REFERENCES mig_a (id));',
    );
    writeFileSync(join(dir, 'README.md'), 'ignored');
    const log = jest.fn();

    const first = await runMigrations(db.url, dir, log);
    const second = await runMigrations(db.url, dir);

    expect(first).toMatchObject({ applied: ['0001_a.sql', '0002_b.sql'] });
    expect(second).toMatchObject({
      applied: [],
      skipped: expect.arrayContaining(['0001_a.sql']),
    });
    expect(log).toHaveBeenCalledWith('applied 0001_a.sql');
  });

  it('rolls back a failing file and reports which one failed', async () => {
    writeFileSync(
      join(dir, '0003_bad.sql'),
      'CREATE TABLE mig_c (id int); SELECT broken;',
    );

    await expect(runMigrations(db.url, dir)).rejects.toThrow(
      /Migration 0003_bad.sql failed/,
    );

    const { rows } = await db.pool.query("SELECT to_regclass('mig_c') AS t");
    expect(rows[0].t).toBeNull();
  });
});
