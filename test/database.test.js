import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../server/database/schema.js';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  createSchema(db);
  db.prepare('INSERT INTO units VALUES(?, ?, ?)').run('u1', 'Unidade teste', 'America/Cuiaba');
  return db;
}

test('banco rejeita setor sem unidade relacionada', () => {
  const db = database();
  assert.throws(() => db.prepare('INSERT INTO sectors(id, unit_id, name, category) VALUES(?, ?, ?, ?)')
    .run('s1', 'inexistente', 'Setor', 'FRIA'));
  db.close();
});

test('banco valida categoria e notas da pesquisa', () => {
  const db = database();
  assert.throws(() => db.prepare('INSERT INTO sectors(id, unit_id, name, category) VALUES(?, ?, ?, ?)')
    .run('s1', 'u1', 'Setor', 'INVALIDA'));
  db.close();
});
