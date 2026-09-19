import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../server/config/database.js';

async function withRollback(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await run(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

test('banco rejeita setor sem unidade relacionada', async () => {
  await withRollback(async (client) => {
    await assert.rejects(() => client.query(
      'INSERT INTO sectors(id, unit_id, name, category) VALUES($1, $2, $3, $4)',
      ['s-teste-fk', 'unidade-inexistente', 'Setor teste', 'FRIA'],
    ));
  });
});

test('banco valida categoria do setor', async () => {
  await withRollback(async (client) => {
    await assert.rejects(() => client.query(
      'INSERT INTO sectors(id, unit_id, name, category) VALUES($1, $2, $3, $4)',
      ['s-teste-categoria', 'u1', 'Setor teste', 'INVALIDA'],
    ));
  });
});
