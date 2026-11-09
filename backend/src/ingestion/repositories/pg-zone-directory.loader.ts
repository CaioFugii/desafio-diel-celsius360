import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { WeeklyHours, WeeklySchedule } from '../../shared/time/weekly-schedule';
import { ZoneDirectoryLoader } from '../interfaces/zone-directory.interface';
import { MapZoneDirectory } from './map-zone-directory';

interface DeviceZoneRow {
  device_id: string;
  zone_id: string;
  comfort_min: string;
  comfort_max: string;
  business_hours: WeeklyHours;
  timezone: string;
}

@Injectable()
export class PgZoneDirectoryLoader extends ZoneDirectoryLoader {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async load(): Promise<MapZoneDirectory> {
    const { rows } = await this.pool.query<DeviceZoneRow>(
      `SELECT d.id AS device_id, z.id AS zone_id, z.comfort_min, z.comfort_max,
              z.business_hours, s.timezone
       FROM registry.devices d
       JOIN registry.zones z ON z.id = d.zone_id
       JOIN registry.stores s ON s.id = z.store_id`,
    );
    return new MapZoneDirectory(
      new Map(
        rows.map((r) => [
          r.device_id,
          {
            zoneId: r.zone_id,
            band: { min: Number(r.comfort_min), max: Number(r.comfort_max) },
            schedule: WeeklySchedule.from(r.business_hours),
            timeZone: r.timezone,
          },
        ]),
      ),
    );
  }
}
