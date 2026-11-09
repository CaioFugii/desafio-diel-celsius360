import { isValidTimeZone } from '../shared/time/local-time';
import {
  WEEKDAYS,
  WeeklyHours,
  WeeklySchedule,
  Weekday,
} from '../shared/time/weekly-schedule';
import {
  Registry,
  Customer,
  Store,
  USER_ROLES,
  User,
  UserRole,
  Zone,
} from './registry.types';

export class RegistryValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Cadastro inválido (${issues.length} problemas):\n- ${issues.join('\n- ')}`,
    );
  }
}

type Json = Record<string, unknown>;

const FILE_WEEKDAYS: Record<Weekday, string> = {
  sun: 'dom',
  mon: 'seg',
  tue: 'ter',
  wed: 'qua',
  thu: 'qui',
  fri: 'sex',
  sat: 'sab',
};

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads fields while collecting every problem, so one run reports the whole file. */
class FieldReader {
  readonly issues: string[] = [];

  issue(path: string, message: string): void {
    this.issues.push(`${path}: ${message}`);
  }

  list(root: Json, key: string): Json[] {
    const value = root[key];
    if (!Array.isArray(value)) {
      this.issue(key, 'deve ser uma lista');
      return [];
    }
    return value.filter((item, i) => {
      if (isObject(item)) return true;
      this.issue(`${key}[${i}]`, 'deve ser um objeto');
      return false;
    });
  }

  text(obj: Json, key: string, path: string): string {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    this.issue(`${path}.${key}`, 'deve ser um texto não vazio');
    return '';
  }

  optionalText(obj: Json, key: string, path: string): string | null {
    if (obj[key] === undefined || obj[key] === null) return null;
    return this.text(obj, key, path);
  }

  number(
    obj: Json,
    key: string,
    path: string,
    min: number,
    max: number,
  ): number {
    const value = obj[key];
    if (typeof value === 'number' && value >= min && value <= max) return value;
    this.issue(`${path}.${key}`, `deve ser um número entre ${min} e ${max}`);
    return 0;
  }

  hours(value: unknown, path: string): WeeklyHours | null {
    if (!isObject(value)) {
      this.issue(
        path,
        'deve ser um objeto indexado por dia da semana (seg..dom)',
      );
      return null;
    }
    const hours = {} as WeeklyHours;
    for (const day of WEEKDAYS) {
      const window = value[FILE_WEEKDAYS[day]];
      if (window === null) {
        hours[day] = null;
      } else if (
        Array.isArray(window) &&
        window.length === 2 &&
        window.every((t) => typeof t === 'string')
      ) {
        hours[day] = { open: window[0], close: window[1] };
      } else {
        this.issue(
          `${path}.${FILE_WEEKDAYS[day]}`,
          'deve ser ["HH:MM", "HH:MM"] ou null',
        );
        return null;
      }
    }
    try {
      WeeklySchedule.from(hours);
    } catch (err) {
      this.issue(path, (err as Error).message);
      return null;
    }
    return hours;
  }

  unique(ids: string[], kind: string): void {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) this.issue(kind, `id duplicado "${id}"`);
      seen.add(id);
    }
  }
}

function parseCustomers(r: FieldReader, root: Json): Customer[] {
  return r.list(root, 'clientes').map((c, i) => {
    const path = `clientes[${i}]`;
    return {
      id: r.text(c, 'id', path),
      name: r.text(c, 'nome', path),
      segment: r.optionalText(c, 'segmento', path),
    };
  });
}

function parseStores(
  r: FieldReader,
  root: Json,
  customerIds: Set<string>,
): Store[] {
  return r.list(root, 'lojas').map((s, i) => {
    const path = `lojas[${i}]`;
    const customerId = r.text(s, 'cliente_id', path);
    if (customerId && !customerIds.has(customerId)) {
      r.issue(`${path}.cliente_id`, `cliente desconhecido "${customerId}"`);
    }
    const timezone = r.text(s, 'fuso_horario', path);
    if (timezone && !isValidTimeZone(timezone)) {
      r.issue(
        `${path}.fuso_horario`,
        `fuso horário desconhecido "${timezone}"`,
      );
    }
    const state = r.text(s, 'uf', path);
    if (state && !/^[A-Z]{2}$/.test(state))
      r.issue(`${path}.uf`, 'deve ter duas letras maiúsculas');
    return {
      id: r.text(s, 'id', path),
      customerId,
      name: r.text(s, 'nome', path),
      kind: r.optionalText(s, 'tipo', path),
      city: r.text(s, 'cidade', path),
      state,
      latitude: r.number(s, 'latitude', path, -90, 90),
      longitude: r.number(s, 'longitude', path, -180, 180),
      timezone,
      businessHours:
        r.hours(s.horario_funcionamento, `${path}.horario_funcionamento`) ??
        ({} as WeeklyHours),
    };
  });
}

function parseZones(
  r: FieldReader,
  root: Json,
  stores: Map<string, Store>,
): Zone[] {
  return r.list(root, 'ambientes').map((z, i) => {
    const path = `ambientes[${i}]`;
    const storeId = r.text(z, 'loja_id', path);
    const store = stores.get(storeId);
    if (storeId && !store)
      r.issue(`${path}.loja_id`, `loja desconhecida "${storeId}"`);

    const band = isObject(z.faixa_conforto_c) ? z.faixa_conforto_c : {};
    const min = r.number(band, 'min', `${path}.faixa_conforto_c`, -20, 60);
    const max = r.number(band, 'max', `${path}.faixa_conforto_c`, -20, 60);
    if (min >= max)
      r.issue(`${path}.faixa_conforto_c`, 'min deve ser menor que max');

    const businessHours =
      z.horario_funcionamento === undefined
        ? store?.businessHours
        : r.hours(z.horario_funcionamento, `${path}.horario_funcionamento`);

    return {
      id: r.text(z, 'id', path),
      storeId,
      name: r.text(z, 'nome', path),
      comfortBand: { min, max },
      businessHours: businessHours ?? ({} as WeeklyHours),
      deviceId: r.optionalText(z, 'dev_id', path),
    };
  });
}

function parseUsers(
  r: FieldReader,
  root: Json,
  customerIds: Set<string>,
  stores: Map<string, Store>,
): User[] {
  return r.list(root, 'usuarios').map((u, i) => {
    const path = `usuarios[${i}]`;
    const role = r.text(u, 'perfil', path) as UserRole;
    if (role && !USER_ROLES.includes(role))
      r.issue(`${path}.perfil`, `perfil desconhecido "${role}"`);

    const customerId = r.optionalText(u, 'cliente_id', path);
    if (role === 'admin_diel' && customerId) {
      r.issue(
        `${path}.cliente_id`,
        'admin_diel não pode pertencer a um cliente',
      );
    }
    if (role !== 'admin_diel' && !customerId) {
      r.issue(`${path}.cliente_id`, `${role} exige um cliente`);
    }
    if (customerId && !customerIds.has(customerId)) {
      r.issue(`${path}.cliente_id`, `cliente desconhecido "${customerId}"`);
    }

    const storeIds = Array.isArray(u.lojas)
      ? u.lojas.filter((s): s is string => typeof s === 'string')
      : [];
    if (role === 'gerente_loja' && storeIds.length === 0) {
      r.issue(`${path}.lojas`, 'gerente_loja exige ao menos uma loja');
    }
    for (const storeId of storeIds) {
      const store = stores.get(storeId);
      if (!store) r.issue(`${path}.lojas`, `loja desconhecida "${storeId}"`);
      else if (store.customerId !== customerId) {
        r.issue(
          `${path}.lojas`,
          `a loja "${storeId}" pertence a outro cliente`,
        );
      }
    }

    const email = r.text(u, 'email', path);
    if (email && !/^[^@\s]+@[^@\s]+$/.test(email))
      r.issue(`${path}.email`, 'e-mail inválido');

    return {
      id: r.text(u, 'id', path),
      name: r.text(u, 'nome', path),
      email,
      role,
      customerId,
      storeIds,
    };
  });
}

/** Validates `cadastro.json` (Portuguese keys) and maps it to the domain model. */
export function parseRegistry(input: unknown): Registry {
  const r = new FieldReader();
  if (!isObject(input))
    throw new RegistryValidationError(['raiz: deve ser um objeto']);

  const customers = parseCustomers(r, input);
  const customerIds = new Set(customers.map((c) => c.id));
  const stores = parseStores(r, input, customerIds);
  const storesById = new Map(stores.map((s) => [s.id, s]));
  const zones = parseZones(r, input, storesById);
  const users = parseUsers(r, input, customerIds, storesById);

  r.unique(
    customers.map((c) => c.id),
    'clientes',
  );
  r.unique(
    stores.map((s) => s.id),
    'lojas',
  );
  r.unique(
    zones.map((z) => z.id),
    'ambientes',
  );
  r.unique(
    users.map((u) => u.id),
    'usuarios',
  );
  r.unique(
    users.map((u) => u.email.toLowerCase()),
    'usuarios.email',
  );
  r.unique(
    zones.flatMap((z) => (z.deviceId ? [z.deviceId] : [])),
    'ambientes.dev_id',
  );

  if (r.issues.length > 0) throw new RegistryValidationError(r.issues);
  return { customers, stores, zones, users };
}
