export abstract class DatabaseHealth {
  /** Rejects when the database is unreachable. */
  abstract timescaleVersion(): Promise<string | null>;
}
