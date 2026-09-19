import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { runMigrations } from './migrate.js';
import { appConfig } from '../config/app-config.js';

const { Pool } = pg;
const TABLES = ['units', 'users', 'sectors', 'user_sectors', 'shifts', 'totens', 'responses', 'hr_indicators'];

function defaultPool() {
  return new Pool({
    connectionString: appConfig.databaseUrl,
    ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false,
  });
}

async function importTable(client, sqlite, table) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${table}(${columns.join(', ')}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`,
      columns.map((column) => row[column]),
    );
  }
  return rows.length;
}

async function validate(sqlitePath, pool) {
  const sqlite = new DatabaseSync(sqlitePath);
  try {
    for (const table of TABLES) {
      const sourceCount = sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
      const destCount = (await pool.query(`SELECT COUNT(*)::int AS total FROM ${table}`)).rows[0].total;
      if (sourceCount !== destCount) {
        throw new Error(`Divergência em ${table}: origem=${sourceCount} destino=${destCount}`);
      }
    }
    const sourceTotals = sqlite.prepare(`
      SELECT sector_id, SUM(quantity) AS total FROM responses GROUP BY sector_id ORDER BY sector_id
    `).all();
    const destTotals = (await pool.query(`
      SELECT sector_id, SUM(quantity)::int AS total FROM responses GROUP BY sector_id ORDER BY sector_id
    `)).rows;
    if (JSON.stringify(sourceTotals) !== JSON.stringify(destTotals)) {
      throw new Error('Divergência nos totais agregados de respostas por setor');
    }
  } finally {
    sqlite.close();
  }
}

export async function migrateFromSqlite(sqlitePath, { pool } = {}) {
  if (!existsSync(sqlitePath)) throw new Error(`Arquivo SQLite não encontrado: ${sqlitePath}`);
  copyFileSync(sqlitePath, `${sqlitePath}.pre-migration-backup`);

  const ownedPool = pool ?? defaultPool();
  await runMigrations(ownedPool);

  const sqlite = new DatabaseSync(sqlitePath);
  const client = await ownedPool.connect();
  const report = {};
  try {
    await client.query('BEGIN');
    for (const table of TABLES) report[table] = await importTable(client, sqlite, table);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    sqlite.close();
  }

  await validate(sqlitePath, ownedPool);
  if (!pool) await ownedPool.end();
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateFromSqlite(process.argv[2] || './data/agrihub.db')
    .then((report) => console.log('Migração concluída:', report))
    .catch((error) => { console.error('Migração falhou:', error.message); process.exit(1); });
}
