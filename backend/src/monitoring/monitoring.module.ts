import { Module } from '@nestjs/common';
import { LocalTimeResolver } from '../shared/time/local-time';
import { ZoneEvaluator } from './domain/zone-evaluation';
import { IngestionStatusController } from './ingestion-status/controllers/ingestion-status.controller';
import { IngestionStatusReadModel } from './ingestion-status/interfaces/ingestion-status-read-model.interface';
import { PgIngestionStatusReadModel } from './ingestion-status/repositories/pg-ingestion-status.read-model';
import { PgReferenceClock } from './repositories/pg-reference-clock';
import { ReferenceClock } from './interfaces/reference-clock.interface';
import { NetworkReadModel } from './stores/interfaces/network-read-model.interface';
import { PgNetworkReadModel } from './stores/repositories/pg-network.read-model';
import { NetworkService } from './stores/services/network.service';
import { StoresController } from './stores/controllers/stores.controller';
import { ZoneSeriesService } from './zones/services/zone-series.service';
import { ZoneSummaryService } from './zones/services/zone-summary.service';
import { ZonesController } from './zones/controllers/zones.controller';
import { PgZonesReadModel } from './zones/repositories/pg-zones.read-model';
import { ZonesReadModel } from './zones/interfaces/zones-read-model.interface';

@Module({
  controllers: [StoresController, ZonesController, IngestionStatusController],
  providers: [
    NetworkService,
    ZoneSeriesService,
    ZoneSummaryService,
    {
      provide: ZoneEvaluator,
      useFactory: () => new ZoneEvaluator(new LocalTimeResolver()),
    },
    { provide: ReferenceClock, useClass: PgReferenceClock },
    { provide: NetworkReadModel, useClass: PgNetworkReadModel },
    { provide: ZonesReadModel, useClass: PgZonesReadModel },
    { provide: IngestionStatusReadModel, useClass: PgIngestionStatusReadModel },
  ],
})
export class MonitoringModule {}
