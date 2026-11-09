import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RegistryValidationError, parseRegistry } from './registry-file.parser';

const fixture = (): any =>
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'data', 'cadastro.json'),
      'utf8',
    ),
  );

function issuesOf(input: unknown): string[] {
  try {
    parseRegistry(input);
  } catch (err) {
    if (err instanceof RegistryValidationError) return err.issues;
    throw err;
  }
  return [];
}

describe('parseRegistry', () => {
  it('maps the provided cadastro.json to the domain model', () => {
    const registry = parseRegistry(fixture());

    expect(registry.customers).toHaveLength(2);
    expect(registry.stores).toHaveLength(5);
    expect(registry.zones).toHaveLength(25);
    expect(registry.users).toHaveLength(4);
    expect(registry.stores[0]).toMatchObject({
      id: 'LOJA-RJ-001',
      customerId: 'CLI-001',
      timezone: 'America/Sao_Paulo',
      businessHours: {
        mon: { open: '09:00', close: '20:00' },
        sat: { open: '09:00', close: '18:00' },
        sun: null,
      },
    });
    expect(registry.zones[0]).toMatchObject({
      id: 'AMB-001',
      storeId: 'LOJA-RJ-001',
      comfortBand: { min: 21, max: 25 },
      deviceId: 'IOT001',
    });
    expect(registry.users.find((u) => u.role === 'gerente_loja')).toMatchObject(
      {
        customerId: 'CLI-001',
        storeIds: ['LOJA-SP-001'],
      },
    );
  });

  it('inherits the store hours when a zone has none', () => {
    const input = fixture();
    delete input.ambientes[0].horario_funcionamento;

    const zone = parseRegistry(input).zones[0];

    expect(zone.businessHours).toEqual(
      parseRegistry(fixture()).stores[0].businessHours,
    );
  });

  it('rejects a non-object root', () => {
    expect(issuesOf([])).toEqual(['raiz: deve ser um objeto']);
  });

  it('reports broken references, invalid values and duplicates together', () => {
    const input = fixture();
    input.lojas[0].cliente_id = 'CLI-404';
    input.lojas[1].fuso_horario = 'Mars/Base';
    input.lojas[2].uf = 'pe';
    input.ambientes[0].loja_id = 'LOJA-404';
    input.ambientes[1].faixa_conforto_c = { min: 26, max: 20 };
    input.ambientes[2].horario_funcionamento.seg = ['22:00', '06:00'];
    input.ambientes[3].dev_id = 'IOT001';
    input.usuarios[0].cliente_id = 'CLI-001';
    input.usuarios[1].email = 'not-an-email';
    input.usuarios[2].lojas = ['LOJA-MG-001'];

    const issues = issuesOf(input);

    expect(issues).toEqual(
      expect.arrayContaining([
        'lojas[0].cliente_id: cliente desconhecido "CLI-404"',
        'lojas[1].fuso_horario: fuso horário desconhecido "Mars/Base"',
        'lojas[2].uf: deve ter duas letras maiúsculas',
        'ambientes[0].loja_id: loja desconhecida "LOJA-404"',
        'ambientes[1].faixa_conforto_c: min deve ser menor que max',
        'ambientes[2].horario_funcionamento: mon: fechamento (06:00) deve ser depois da abertura (22:00)',
        'ambientes.dev_id: id duplicado "IOT001"',
        'usuarios[0].cliente_id: admin_diel não pode pertencer a um cliente',
        'usuarios[1].email: e-mail inválido',
        'usuarios[2].lojas: a loja "LOJA-MG-001" pertence a outro cliente',
      ]),
    );
  });

  it('validates field types and role rules', () => {
    const input = fixture();
    input.clientes.push('oops');
    input.lojas[0].latitude = 'x';
    input.ambientes[0].horario_funcionamento = { seg: 'always' };
    input.usuarios[1].perfil = 'root';
    input.usuarios[3].cliente_id = null;
    input.usuarios[2].lojas = [];
    input.usuarios.push({ ...input.usuarios[0] });

    const issues = issuesOf(input);

    expect(issues).toEqual(
      expect.arrayContaining([
        'clientes[2]: deve ser um objeto',
        'lojas[0].latitude: deve ser um número entre -90 e 90',
        'ambientes[0].horario_funcionamento.dom: deve ser ["HH:MM", "HH:MM"] ou null',
        'usuarios[1].perfil: perfil desconhecido "root"',
        'usuarios[3].cliente_id: gestor_cliente exige um cliente',
        'usuarios[2].lojas: gerente_loja exige ao menos uma loja',
        'usuarios: id duplicado "USR-001"',
      ]),
    );
  });

  it('requires the top-level lists and object-shaped hours', () => {
    const input = fixture();
    delete input.usuarios;
    input.lojas[0].horario_funcionamento = null;

    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        'usuarios: deve ser uma lista',
        'lojas[0].horario_funcionamento: deve ser um objeto indexado por dia da semana (seg..dom)',
      ]),
    );
  });
});
