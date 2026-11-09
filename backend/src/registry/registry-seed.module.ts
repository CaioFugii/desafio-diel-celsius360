import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { DatabaseModule } from '../database/database.module';
import { RegistrySeedService } from './registry-seed.service';
import { RegistryWriter, PgRegistryWriter } from './registry.writer';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [
    RegistrySeedService,
    { provide: RegistryWriter, useClass: PgRegistryWriter },
  ],
})
export class RegistrySeedModule {}
