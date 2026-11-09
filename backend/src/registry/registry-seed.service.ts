import { Injectable } from '@nestjs/common';
import { parseRegistry } from './registry-file.parser';
import { RegistryWriter } from './registry.writer';

export interface SeedReport {
  customers: number;
  stores: number;
  zones: number;
  devices: number;
  users: number;
}

@Injectable()
export class RegistrySeedService {
  constructor(private readonly writer: RegistryWriter) {}

  async seed(input: unknown): Promise<SeedReport> {
    const registry = parseRegistry(input);
    await this.writer.save(registry);
    return {
      customers: registry.customers.length,
      stores: registry.stores.length,
      zones: registry.zones.length,
      devices: registry.zones.filter((z) => z.deviceId !== null).length,
      users: registry.users.length,
    };
  }
}
