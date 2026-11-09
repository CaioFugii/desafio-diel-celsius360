import { Module } from '@nestjs/common';
import { LocalTimeResolver } from '../shared/time/local-time';
import { ZoneEvaluator } from './domain/zone-evaluation';
import { IngestionStatusController } from './ingestion-status/ingestion-status.controller';
import {
  IngestionStatusReadModel,
  PgIngestionStatusReadModel,
} from './ingestion-status/ingestion-status.read-model';
import { PgReferenceClock, ReferenceClock } from './reference-clock';
import {
  NetworkReadModel,
  PgNetworkReadModel,
} from './stores/network.read-model';
import { NetworkService } from './stores/network.service';
import { StoresController } from './stores/stores.controller';
import { ZoneSeriesService } from './zones/zone-series.service';
import { ZoneSummaryService } from './zones/zone-summary.service';
import { ZonesController } from './zones/zones.controller';
import { PgZonesReadModel, ZonesReadModel } from './zones/zones.read-model';

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
