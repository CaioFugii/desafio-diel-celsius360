import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRegistry } from '../../src/registry/parsers/registry-file.parser';
import { PgRegistryWriter } from '../../src/registry/repositories/pg-registry.writer';
import { IngestionReport } from '../../src/ingestion/interfaces/ingestion-runner.interface';
import { IngestionRunner } from '../../src/ingestion/services/ingestion.runner';
import { PacketEnricher } from '../../src/ingestion/services/packet-enricher';
import { UnthrottledPacer } from '../../src/ingestion/services/pacer';
import { PgIngestionStore } from '../../src/ingestion/repositories/pg-ingestion.store';
import { PgIngestionNotifier } from '../../src/ingestion/repositories/pg-ingestion.notifier';
import { JsonlFileSource } from '../../src/ingestion/repositories/jsonl-file.source';
import { PgZoneDirectoryLoader } from '../../src/ingestion/repositories/pg-zone-directory.loader';
import { LocalTimeResolver } from '../../src/shared/time/local-time';
import { Ds18b20QualityPolicy } from '../../src/telemetry/domain/reading-quality';

export const REGISTRY_FILE = join(
  __dirname,
  '..',
  '..',
  '..',
  'data',
  'cadastro.json',
);

export function registryInput(): any {
  return JSON.parse(readFileSync(REGISTRY_FILE, 'utf8'));
}

export async function seedRegistry(pool: Pool): Promise<void> {
  await new PgRegistryWriter(pool).save(parseRegistry(registryInput()));
}

const line = (dev: string, ts: string, readings: unknown[], extra = {}) =>
  JSON.stringify({
    dev_id: dev,
    timestamp: ts,
    GMT: -3,
    samplingTime: 30,
    Temperature: readings,
    ...extra,
  });

/**
 * Monday 2026-01-12, local time UTC-3. AMB-001 (IOT001, band 21-25, open 09-20) gets
 * a broker duplicate, an error code, a late packet and a 52-minute outage.
 */
export const SCENARIO_LINES = [
  line('IOT001', '2026-01-12T10:05:30', [22, 23, 24, 26]),
  line('IOT001', '2026-01-12T10:05:30', [22, 23, 24, 26]),
  line('IOT001', '2026-01-12T10:07:30', [-127, 20]),
  line('IOT099', '2026-01-12T10:08:00', [23]),
  'not json',
  line('IOT001', '2026-01-12T11:00:00', [23]),
  line('IOT001', '2026-01-12T09:30:00', [24], { saved_data: true }),
  line('IOT002', '2026-01-12T11:00:00', [22]),
  line('IOT008', '2026-01-12T11:00:00', [30]),
];

/** Instant of the latest packet in the scenario ("now"). */
export const SCENARIO_NOW = new Date('2026-01-12T14:00:00Z');

export function writeJsonl(
  lines: string[],
  name = 'telemetrias.jsonl',
): string {
  const file = join(mkdtempSync(join(tmpdir(), 'c360-')), name);
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

export async function ingest(
  pool: Pool,
  file: string,
  options: { fromStart?: boolean; batchSize?: number } = {},
): Promise<IngestionReport> {
  const runner = new IngestionRunner(
    new JsonlFileSource(file),
    new PgIngestionStore(pool),
    new PgIngestionNotifier(pool),
    new PacketEnricher(
      await new PgZoneDirectoryLoader(pool).load(),
      new Ds18b20QualityPolicy(),
      new LocalTimeResolver(),
    ),
    new UnthrottledPacer(),
    {
      batchSize: options.batchSize ?? 3,
      fromStart: options.fromStart ?? false,
      progressEvery: 1_000,
    },
    { log: () => undefined },
  );
  return runner.run();
}
