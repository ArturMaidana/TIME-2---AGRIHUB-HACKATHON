import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrateFromSqlite } from '../server/database/migrate-from-sqlite.js';
import { appConfig } from '../server/config/app-config.js';

const { Pool } = pg;

function buildFixtureSqlite(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE units(id TEXT PRIMARY KEY, name TEXT, timezone TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY, unit_id TEXT, role TEXT, name TEXT, code TEXT);
    CREATE TABLE sectors(id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, category TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE user_sectors(user_id TEXT, sector_id TEXT);
    CREATE TABLE shifts(id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, start_time TEXT, end_time TEXT);
    CREATE TABLE totens(id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, credential TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE responses(id TEXT PRIMARY KEY, unit_id TEXT, sector_id TEXT, shift_id TEXT, response_date TEXT, metric TEXT, score INTEGER, quantity INTEGER);
    CREATE TABLE hr_indicators(id TEXT PRIMARY KEY, unit_id TEXT, sector_id TEXT, shift_id TEXT, period TEXT, absences INTEGER, leaves INTEGER, created_at TEXT);
  `);
  db.prepare('INSERT INTO units VALUES(?, ?, ?)').run('fx-unit', 'Unidade Fixture', 'America/Cuiaba');
  db.prepare('INSERT INTO shifts VALUES(?, ?, ?, ?, ?)').run('fx-shift', 'fx-unit', 'Manhã', '06:00', '14:00');
  db.prepare('INSERT INTO sectors(id, unit_id, name, category) VALUES(?, ?, ?, ?)').run('fx-sector', 'fx-unit', 'Setor Fixture', 'FRIA');
  db.prepare('INSERT INTO responses VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
    .run('fx-resp-1', 'fx-unit', 'fx-sector', 'fx-shift', '2026-09-01', 'ENERGY', 4, 3);
  db.close();
}

async function withThrowawayDatabase(run) {
  const adminPool = new Pool({ connectionString: appConfig.databaseUrl });
  const name = `agrihub_test_import_${Date.now()}`;
  await adminPool.query(`CREATE DATABASE ${name}`);
  const testPool = new Pool({ connectionString: appConfig.databaseUrl.replace(/\/[^/]+$/, `/${name}`) });
  try {
    await run(testPool);
  } finally {
    await testPool.end();
    await adminPool.query(`DROP DATABASE ${name}`);
    await adminPool.end();
  }
}

test('migra do SQLite para um Postgres vazio sem divergência de totais', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'agrihub-migrate-'));
  const sqlitePath = resolve(dir, 'fixture.db');
  buildFixtureSqlite(sqlitePath);

  await withThrowawayDatabase(async (pool) => {
    const report = await migrateFromSqlite(sqlitePath, { pool });
    assert.equal(report.units, 1);
    assert.equal(report.responses, 1);
    const row = (await pool.query('SELECT * FROM responses WHERE id = $1', ['fx-resp-1'])).rows[0];
    assert.equal(row.quantity, 3);
  });

  rmSync(dir, { recursive: true, force: true });
});
