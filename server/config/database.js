import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSchema } from '../database/schema.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase } from '../database/seed.js';
import { appConfig } from './app-config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const file = appConfig.databasePath || resolve(root, 'data/agrihub.db');
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
createSchema(db);
runMigrations(db);
seedDatabase(db);
