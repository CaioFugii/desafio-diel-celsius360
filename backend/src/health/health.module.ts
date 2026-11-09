import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { DatabaseHealth } from './interfaces/database-health.interface';
import { PgDatabaseHealth } from './repositories/pg-database-health';
import { HealthService } from './services/health.service';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: DatabaseHealth, useClass: PgDatabaseHealth },
  ],
})
export class HealthModule {}
