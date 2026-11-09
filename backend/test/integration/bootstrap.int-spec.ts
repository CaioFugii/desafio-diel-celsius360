import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { dirname } from 'node:path';
import { Pool } from 'pg';
import { PG_POOL } from '../../src/database/database.module';
import { SCENARIO_LINES, registryInput, writeJsonl } from '../support/scenario';
import {
  TestDatabase,
  count,
  createTestDatabase,
} from '../support/test-database';

/**
 * Wires the standalone seed and ingestion modules exactly as their entrypoints
 * do, configured through environment variables.
 */
describe('standalone modules (seed and ingestion)', () => {
  let db: TestDatabase;
  const contexts: INestApplicationContext[] = [];

  async function compile(modulePath: string, exportName: string) {
    const imported = await import(modulePath);
    // Each context owns its pool, as in production, and ends it on close.
    const moduleRef = await Test.createTestingModule({
      imports: [imported[exportName]],
    })
      .overrideProvider(PG_POOL)
      .useValue(new Pool({ connectionString: db.url, max: 2 }))
      .compile();
    contexts.push(moduleRef);
    return moduleRef;
  }

  beforeAll(async () => {
    db = await createTestDatabase('bootstrap');
    const file = writeJsonl(SCENARIO_LINES, 'feed.jsonl');
    Object.assign(process.env, {
      DATA_DIR: dirname(file),
      INGEST_FILE: 'feed.jsonl',
      INGEST_PACKETS_PER_SECOND: '0',
      INGEST_BATCH_SIZE: '4',
    });
  });

  afterAll(async () => {
    try {
      for (const context of contexts) await context.close();
    } finally {
      await db.drop();
    }
  });

  it('seeds the registry through RegistrySeedModule', async () => {
    const moduleRef = await compile(
      '../../src/registry/registry-seed.module',
      'RegistrySeedModule',
    );
    const { RegistrySeedService } =
      await import('../../src/registry/services/registry-seed.service');

    const report = await moduleRef
      .get(RegistrySeedService)
      .seed(registryInput());

    expect(report.zones).toBe(25);
    expect(await count(db.pool, 'registry.devices')).toBe(25);
  });

  it('runs the configured ingestion through IngestionModule', async () => {
    const moduleRef = await compile(
      '../../src/ingestion/ingestion.module',
      'IngestionModule',
    );
    const { IngestionRunner } =
      await import('../../src/ingestion/services/ingestion.runner');

    const report = await moduleRef.get(IngestionRunner).run();

    expect(report).toMatchObject({
      source: 'feed.jsonl',
      lastLine: 9,
      packets: 8,
    });
    expect(await count(db.pool, 'telemetry.samples')).toBe(9);
  });
});
