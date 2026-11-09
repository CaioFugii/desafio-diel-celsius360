import { LocalTimeResolver } from '../../shared/time/local-time';
import { classifyComfort } from '../../telemetry/domain/comfort';
import { ReadingQualityPolicy } from '../../telemetry/domain/reading-quality';
import {
  TelemetryPacket,
  timedReadings,
} from '../../telemetry/domain/telemetry-packet';
import { ZoneDirectory } from '../interfaces/zone-directory.interface';
import {
  EnrichedSample,
  RejectedSample,
  EnrichedPacket,
} from '../interfaces/enriched-packet.interface';

export class PacketEnricher {
  constructor(
    private readonly directory: ZoneDirectory,
    private readonly quality: ReadingQualityPolicy,
    private readonly localTime: LocalTimeResolver,
  ) {}

  enrich(packet: TelemetryPacket): EnrichedPacket {
    const zone = this.directory.find(packet.deviceId);
    if (!zone) return { packet, zoneId: null, samples: [], rejected: [] };

    const samples: EnrichedSample[] = [];
    const rejected: RejectedSample[] = [];
    for (const { ts, value } of timedReadings(packet)) {
      const reason = this.quality.assess(value);
      if (reason) {
        rejected.push({
          ts,
          deviceId: packet.deviceId,
          temperature:
            typeof value === 'number' && Number.isFinite(value) ? value : null,
          reason,
        });
        continue;
      }
      const temperature = value as number;
      const local = this.localTime.resolve(ts, zone.timeZone);
      samples.push({
        ts,
        deviceId: packet.deviceId,
        zoneId: zone.zoneId,
        temperature,
        businessHours: zone.schedule.isOpen(local.weekday, local.minuteOfDay),
        comfort: classifyComfort(temperature, zone.band),
      });
    }
    return { packet, zoneId: zone.zoneId, samples, rejected };
  }
}
