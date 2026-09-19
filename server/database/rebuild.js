import { pool } from '../config/database.js';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

const TABLES_IN_DEPENDENCY_ORDER = [
  'hr_indicators', 'responses', 'totens', 'user_sectors', 'sectors', 'shifts', 'users', 'units',
];

async function main() {
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    await pool.query(`TRUNCATE TABLE ${table} CASCADE`).catch(() => {});
  }
  await runMigrations();
  await seedDatabase();
  console.log('Banco recriado e populado no PostgreSQL.');
  await pool.end();
}

main();
