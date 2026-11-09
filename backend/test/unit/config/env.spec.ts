import { validateEnv } from '../../../src/config/env';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    JWT_SECRET: 'a-secret-long-enough',
  };

  it('applies defaults and coerces numeric values', () => {
    const env = validateEnv({ ...base, PORT: '4000' });

    expect(env.PORT).toBe(4000);
    expect(env.JWT_EXPIRES_IN).toBe('8h');
  });

  it('applies ingestion defaults', () => {
    const env = validateEnv(base);

    expect(env).toMatchObject({
      INGEST_FILE: 'telemetrias.jsonl',
      INGEST_BATCH_SIZE: 500,
      INGEST_PACKETS_PER_SECOND: 300,
      INGEST_FROM_START: false,
    });
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    ['', false],
  ])('parses INGEST_FROM_START=%p as %p', (raw, expected) => {
    expect(
      validateEnv({ ...base, INGEST_FROM_START: raw }).INGEST_FROM_START,
    ).toBe(expected);
  });

  it('rejects an invalid boolean and an out-of-range batch size', () => {
    expect(() => validateEnv({ ...base, INGEST_FROM_START: 'yes' })).toThrow(
      /INGEST_FROM_START/,
    );
    expect(() => validateEnv({ ...base, INGEST_BATCH_SIZE: '0' })).toThrow(
      /INGEST_BATCH_SIZE/,
    );
  });

  it('rejects a missing database url', () => {
    expect(() => validateEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a short jwt secret', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });
});
