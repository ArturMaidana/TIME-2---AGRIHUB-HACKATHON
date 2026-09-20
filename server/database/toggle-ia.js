import { pool } from '../config/database.js';

async function main() {
  const arg = process.argv[2];
  if (!['on', 'off'].includes(arg)) {
    console.error('Uso: npm run ia:toggle -- on|off');
    process.exitCode = 1;
    return;
  }
  const ligar = arg === 'on';
  await pool.query('UPDATE configuracoes_indicadores SET usar_ia_generativa = $1', [ligar]);
  console.log(`IA generativa (Groq) ${ligar ? 'LIGADA' : 'DESLIGADA'} para todas as unidades.`);
  console.log(ligar
    ? 'As próximas análises vão tentar gerar resumo com IA (requer GROQ_API_KEY no .env).'
    : 'As análises voltam a usar só o resumo do motor determinístico.');
  await pool.end();
}

main();
