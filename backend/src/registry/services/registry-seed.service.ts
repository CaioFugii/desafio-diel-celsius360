import { Injectable } from '@nestjs/common';
import { parseRegistry } from '../parsers/registry-file.parser';
import { RegistryWriter } from '../interfaces/registry-writer.interface';
import { SeedReport } from '../interfaces/seed-report.interface';

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
