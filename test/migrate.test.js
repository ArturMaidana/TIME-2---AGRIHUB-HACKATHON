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
    assert.deepEqual(versions, [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
  });
});

test('roda a migration duas vezes sem erro (idempotente)', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    await runMigrations(pool);
    const versions = (await pool.query('SELECT version FROM schema_migrations')).rows;
    assert.equal(versions.length, 5);
  });
});

test('reverte a última migration', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const result = await rollbackLastMigration(pool);
    assert.equal(result.version, 5);
    const columns = (await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hr_indicators'
    `)).rows.map((row) => row.column_name);
    assert.ok(!columns.includes('overtime_hours'));
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    assert.ok(tables.includes('alertas'));
    assert.ok(tables.includes('units'));
    assert.ok(tables.includes('reclamacoes_sugestoes'));
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
    assert.deepEqual(versions, [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
  });
});

test('aplica a migration do chat anônimo (papel FUNCIONARIO + reclamacoes_sugestoes)', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    assert.ok(tables.includes('reclamacoes_sugestoes'));
    const constraint = (await pool.query(`
      SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'users_role_check'
    `)).rows[0];
    assert.match(constraint.def, /FUNCIONARIO/);
  });
});

test('aplica a migration da IA generativa (flag + cache de resumo)', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const configColumns = (await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'configuracoes_indicadores'
    `)).rows.map((row) => row.column_name);
    assert.ok(configColumns.includes('usar_ia_generativa'));
    const analiseColumns = (await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'analises_periodicas'
    `)).rows.map((row) => row.column_name);
    assert.ok(analiseColumns.includes('resumo_ia'));
    assert.ok(analiseColumns.includes('hash_entrada'));
    assert.ok(analiseColumns.includes('gerado_por_ia'));
  });
});

test('aplica a migration de horas extras (novo dado do RH)', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const columns = (await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'hr_indicators'
    `)).rows.map((row) => row.column_name);
    assert.ok(columns.includes('overtime_hours'));
  });
});
