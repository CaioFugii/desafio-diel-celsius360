import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Env } from '../config/env';
import { RegistrySeedModule } from './registry-seed.module';
import { RegistrySeedService } from './services/registry-seed.service';

async function main() {
  const app = await NestFactory.createApplicationContext(RegistrySeedModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const dataDir = app
      .get(ConfigService<Env, true>)
      .get('DATA_DIR', { infer: true });
    const file = join(dataDir, 'cadastro.json');
    const input: unknown = JSON.parse(await readFile(file, 'utf8'));
    const report = await app.get(RegistrySeedService).seed(input);
    Logger.log(
      `registry seeded from ${file}: ${JSON.stringify(report)}`,
      'Seed',
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  Logger.error((err as Error).message, undefined, 'Seed');
  process.exit(1);
});
