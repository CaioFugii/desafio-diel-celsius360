import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { AppConfigModule } from '../config/app-config.module';
import { Env } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { LocalTimeResolver } from '../shared/time/local-time';
import { Ds18b20QualityPolicy } from '../telemetry/domain/reading-quality';
import { IngestionRunner } from './services/ingestion.runner';
import { IngestionStore } from './interfaces/ingestion-store.interface';
import { PacketEnricher } from './services/packet-enricher';
import { pacerFor } from './services/pacer';
import { PgIngestionStore } from './repositories/pg-ingestion.store';
import { JsonlFileSource } from './repositories/jsonl-file.source';
import { PgZoneDirectoryLoader } from './repositories/pg-zone-directory.loader';
import { ZoneDirectoryLoader } from './interfaces/zone-directory.interface';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [
    { provide: IngestionStore, useClass: PgIngestionStore },
    { provide: ZoneDirectoryLoader, useClass: PgZoneDirectoryLoader },
    {
      provide: IngestionRunner,
      inject: [ConfigService, IngestionStore, ZoneDirectoryLoader],
      useFactory: async (
        config: ConfigService<Env, true>,
        store: IngestionStore,
        loader: ZoneDirectoryLoader,
      ) => {
        const logger = new Logger('Ingestion');
        const directory = await loader.load();
        logger.log(`zone directory loaded: ${directory.size} devices`);
        return new IngestionRunner(
          new JsonlFileSource(
            join(
              config.get('DATA_DIR', { infer: true }),
              config.get('INGEST_FILE', { infer: true }),
            ),
          ),
          store,
          new PacketEnricher(
            directory,
            new Ds18b20QualityPolicy(),
            new LocalTimeResolver(),
          ),
          pacerFor(config.get('INGEST_PACKETS_PER_SECOND', { infer: true })),
          {
            batchSize: config.get('INGEST_BATCH_SIZE', { infer: true }),
            fromStart: config.get('INGEST_FROM_START', { infer: true }),
            progressEvery: 10_000,
          },
          logger,
        );
      },
    },
  ],
})
export class IngestionModule {}
