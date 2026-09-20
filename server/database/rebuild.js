import { pool } from '../config/database.js';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

// Ordem de dependência explícita, embora TRUNCATE ... CASCADE já propague por FK a
// partir de 'units' sozinho — listar tudo deixa claro, pra quem ler, o que este
// comando apaga (todo dado transacional/calculado) e o que sobrevive (nada: o
// cadastro mínimo é recriado do zero pelo seed logo em seguida).
const TABLES_IN_DEPENDENCY_ORDER = [
  'acoes_plano', 'planos_acao', 'analises_periodicas', 'alertas', 'indices_setor',
  'requisicoes_totem', 'log_auditoria', 'hr_indicators', 'responses',
  'efetivos_setor_turno', 'configuracoes_indicadores',
  'totens', 'user_sectors', 'sectors', 'shifts', 'users', 'units',
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
