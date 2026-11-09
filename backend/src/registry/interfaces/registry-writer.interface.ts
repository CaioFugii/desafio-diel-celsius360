import { Registry } from './registry.interface';

export abstract class RegistryWriter {
  /** Inserts or updates every entity; running it twice leaves the same state. */
  abstract save(registry: Registry): Promise<void>;
}
