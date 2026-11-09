import { join } from 'node:path';
import { Client, Pool } from 'pg';
import { runMigrations } from '../../src/database/migrator';

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgres://celsius:celsius_local@localhost:5434/postgres';

export interface TestDatabase {
  pool: Pool;
  url: string;
  drop(): Promise<void>;
}

async function admin<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** A fresh, migrated database per test file, so files can run in parallel. */
export async function createTestDatabase(
  prefix: string,
): Promise<TestDatabase> {
  const name = `c360_test_${prefix}_${process.pid}`.toLowerCase();
  await admin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${name}`);
  });
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  await runMigrations(
    url.toString(),
    join(__dirname, '..', '..', 'migrations'),
  );

  const pool = new Pool({ connectionString: url.toString(), max: 5 });
  return {
    pool,
    url: url.toString(),
    drop: async () => {
      await pool.end().catch(() => undefined);
      await admin((c) =>
        c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`),
      );
    },
  };
}

/** Materializes every level so assertions do not depend on background jobs. */
export async function refreshAggregates(pool: Pool): Promise<void> {
  for (const view of ['zone_1m', 'zone_15m', 'zone_1h']) {
    await pool.query(
      `CALL refresh_continuous_aggregate('telemetry.${view}', NULL, NULL)`,
    );
  }
}

export async function count(pool: Pool, table: string): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}
