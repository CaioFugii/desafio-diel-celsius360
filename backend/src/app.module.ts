import { Module } from '@nestjs/common';
import { RegistryModule } from './registry/registry.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    RegistryModule,
    MonitoringModule,
  ],
})
export class AppModule {}
