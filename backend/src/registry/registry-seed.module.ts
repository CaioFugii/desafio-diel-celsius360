import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { DatabaseModule } from '../database/database.module';
import { RegistrySeedService } from './services/registry-seed.service';
import { RegistryWriter } from './interfaces/registry-writer.interface';
import { PgRegistryWriter } from './repositories/pg-registry.writer';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [
    RegistrySeedService,
    { provide: RegistryWriter, useClass: PgRegistryWriter },
  ],
})
export class RegistrySeedModule {}
