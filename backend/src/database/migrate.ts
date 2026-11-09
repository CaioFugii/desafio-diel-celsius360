import { join } from 'node:path';
import { runMigrations } from './migrator';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const dir = join(__dirname, '..', '..', 'migrations');
  const { applied, skipped } = await runMigrations(databaseUrl, dir, (m) =>
    console.log(`[migrate] ${m}`),
  );
  console.log(
    `[migrate] done: ${applied.length} applied, ${skipped.length} already up to date`,
  );
}

main().catch((err) => {
  console.error('[migrate]', err);
  process.exit(1);
});
