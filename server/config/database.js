import pg from 'pg';
import { appConfig } from './app-config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: appConfig.databaseUrl,
  ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false,
});

export async function queryAll(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryOne(text, params = []) {
  const rows = await queryAll(text, params);
  return rows[0] ?? null;
}

export async function execute(text, params = []) {
  const result = await pool.query(text, params);
  return result.rowCount;
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
