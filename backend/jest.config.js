/** @type {import('jest').Config} */
const base = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  rootDir: '.',
};

module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/ingestion/main.ts',
    '!src/registry/seed.ts',
    '!src/database/migrate.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    global: { statements: 95, branches: 90, functions: 95, lines: 95 },
  },
  projects: [
    {
      ...base,
      displayName: 'unit',
      roots: ['<rootDir>/test/unit'],
      testRegex: '.*\\.spec\\.ts$',
    },
    {
      ...base,
      displayName: 'e2e',
      roots: ['<rootDir>/test'],
      testRegex: '.*\\.e2e-spec\\.ts$',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
    },
    {
      // Requires PostgreSQL/TimescaleDB: `docker compose up -d db`.
      ...base,
      displayName: 'integration',
      roots: ['<rootDir>/test'],
      testRegex: '.*\\.int-spec\\.ts$',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
    },
  ],
  testTimeout: 60_000,
};
