import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { appConfig } from '../config/app-config.js';

const { Pool } = pg;
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

let defaultPool;
function sharedPool() {
  defaultPool ??= new Pool({
    connectionString: appConfig.databaseUrl,
    ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false,
  });
  return defaultPool;
}

function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.up.sql'))
    .sort();
}

export async function runMigrations(pool = sharedPool()) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations(
      version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL
    )
  `);
  const applied = new Set(
    (await pool.query('SELECT version FROM schema_migrations')).rows.map((row) => row.version),
  );
  for (const file of migrationFiles()) {
    const version = Number(file.slice(0, 3));
    if (applied.has(version)) continue;
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES($1, $2, $3)',
        [version, file, new Date().toISOString()],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function rollbackLastMigration(pool = sharedPool()) {
  const last = await pool.query('SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1');
  if (last.rows.length === 0) return null;
  const { version, name } = last.rows[0];
  const sql = readFileSync(resolve(migrationsDir, name.replace('.up.sql', '.down.sql')), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { version, name };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(() => { console.log('Migrations aplicadas.'); return sharedPool().end(); })
    .catch((error) => { console.error(error); process.exit(1); });
}
