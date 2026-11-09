import {
  ZoneContext,
  ZoneDirectory,
} from '../interfaces/zone-directory.interface';

export class MapZoneDirectory implements ZoneDirectory {
  constructor(private readonly zones: ReadonlyMap<string, ZoneContext>) {}

  find(deviceId: string): ZoneContext | undefined {
    return this.zones.get(deviceId);
  }

  get size(): number {
    return this.zones.size;
  }
}
