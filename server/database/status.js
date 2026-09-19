import { pool } from '../config/database.js';
import { appConfig } from '../config/app-config.js';

const TABLES = ['units', 'users', 'sectors', 'shifts', 'totens', 'responses', 'hr_indicators'];

async function main() {
  const counts = {};
  for (const table of TABLES) {
    counts[table] = (await pool.query(`SELECT COUNT(*)::int AS total FROM ${table}`)).rows[0].total;
  }
  console.log(JSON.stringify({ database: appConfig.databaseUrl, counts }, null, 2));
  await pool.end();
}

main();
