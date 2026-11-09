import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IngestionModule } from './ingestion.module';
import { IngestionRunner } from './services/ingestion.runner';

async function main() {
  const app = await NestFactory.createApplicationContext(IngestionModule, {
    logger: ['error', 'warn', 'log'],
  });
  const stop = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      Logger.warn(
        `${signal} received, finishing the current batch`,
        'Ingestion',
      );
      stop.abort();
    });
  }
  try {
    const report = await app.get(IngestionRunner).run(stop.signal);
    Logger.log(
      `${report.aborted ? 'stopped' : 'finished'}: ${JSON.stringify(report)}`,
      'Ingestion',
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  Logger.error((err as Error).stack ?? String(err), undefined, 'Ingestion');
  process.exit(1);
});
