// Applies db/migrations/*.sql in filename order against DATABASE_URL.
// Raw SQL, tracked in schema_migrations. Non-destructive: never drops anything.
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr';
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
await client.connect();

await client.query(`create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`);

const dir = join(root, 'db', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  const done = await client.query('select 1 from schema_migrations where name = $1', [file]);
  if (done.rowCount > 0) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(dir, file), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log(`apply ${file} OK`);
  } catch (e) {
    await client.query('rollback');
    console.error(`apply ${file} FAILED: ${e.message}`);
    process.exitCode = 1;
    break;
  }
}
await client.end();