import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runMigrations, rollbackLastMigration } from '../server/database/migrate.js';
import { appConfig } from '../server/config/app-config.js';

const { Pool } = pg;

async function withThrowawayDatabase(run) {
  const adminPool = new Pool({ connectionString: appConfig.databaseUrl });
  const name = `agrihub_test_migrate_${Date.now()}`;
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

test('aplica a migration base e registra a versão', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    assert.ok(tables.includes('units'));
    assert.ok(tables.includes('responses'));
    const versions = (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows;
    assert.deepEqual(versions, [{ version: 1 }, { version: 2 }]);
  });
});

test('roda a migration duas vezes sem erro (idempotente)', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    await runMigrations(pool);
    const versions = (await pool.query('SELECT version FROM schema_migrations')).rows;
    assert.equal(versions.length, 2);
  });
});

test('reverte a última migration', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const result = await rollbackLastMigration(pool);
    assert.equal(result.version, 2);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    assert.ok(!tables.includes('alertas'));
    assert.ok(tables.includes('units'));
  });
});

test('aplica a migration de analytics após a baseline', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    for (const table of [
      'configuracoes_indicadores', 'efetivos_setor_turno', 'indices_setor', 'alertas',
      'analises_periodicas', 'planos_acao', 'acoes_plano', 'log_auditoria', 'requisicoes_totem',
    ]) {
      assert.ok(tables.includes(table), `esperava a tabela ${table}`);
    }
    const versions = (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows;
    assert.deepEqual(versions, [{ version: 1 }, { version: 2 }]);
  });
});
