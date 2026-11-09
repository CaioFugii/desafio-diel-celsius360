import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RegistryValidationError } from './registry-file.parser';
import { RegistrySeedService } from './registry-seed.service';
import { Registry } from './registry.types';
import { RegistryWriter } from './registry.writer';

class InMemoryRegistryWriter extends RegistryWriter {
  saved: Registry[] = [];

  async save(registry: Registry): Promise<void> {
    this.saved.push(registry);
  }
}

const fixture = () =>
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'data', 'cadastro.json'),
      'utf8',
    ),
  );

describe('RegistrySeedService', () => {
  it('parses the file, saves it and reports what was seeded', async () => {
    const writer = new InMemoryRegistryWriter();

    const report = await new RegistrySeedService(writer).seed(fixture());

    expect(report).toEqual({
      customers: 2,
      stores: 5,
      zones: 25,
      devices: 25,
      users: 4,
    });
    expect(writer.saved).toHaveLength(1);
  });

  it('does not write anything when the file is invalid', async () => {
    const writer = new InMemoryRegistryWriter();
    const input = fixture();
    input.lojas[0].cliente_id = 'nope';

    await expect(
      new RegistrySeedService(writer).seed(input),
    ).rejects.toBeInstanceOf(RegistryValidationError);
    expect(writer.saved).toHaveLength(0);
  });
});
