import { WeeklyHours } from '../shared/time/weekly-schedule';
import { ComfortBand } from '../telemetry/domain/comfort';

export interface Customer {
  id: string;
  name: string;
  segment: string | null;
}

export interface Store {
  id: string;
  customerId: string;
  name: string;
  kind: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  timezone: string;
  businessHours: WeeklyHours;
}

export interface Zone {
  id: string;
  storeId: string;
  name: string;
  comfortBand: ComfortBand;
  businessHours: WeeklyHours;
  deviceId: string | null;
}

export const USER_ROLES = [
  'admin_diel',
  'gestor_cliente',
  'gerente_loja',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  customerId: string | null;
  storeIds: string[];
}

export interface Registry {
  customers: Customer[];
  stores: Store[];
  zones: Zone[];
  users: User[];
}
