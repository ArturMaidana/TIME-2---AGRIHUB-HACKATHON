import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSchema } from '../database/schema.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase } from '../database/seed.js';
import { appConfig } from './app-config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const databaseFile = appConfig.databasePath || resolve(root, 'data/agrihub.db');

export function openDatabase(file = databaseFile) {
  mkdirSync(dirname(file), { recursive: true });
  const connection = new DatabaseSync(file);
  connection.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  createSchema(connection);
  runMigrations(connection);
  seedDatabase(connection);
  return connection;
}

export const db = openDatabase();
