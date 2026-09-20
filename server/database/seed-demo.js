import { randomUUID } from 'node:crypto';
import { pool, execute } from '../config/database.js';
import { runMigrations } from './migrate.js';
import { seedDatabase, STANDARD_SECTORS } from './seed.js';
import { dateKeyOffset } from '../utils/date.js';

// Limpa tudo (igual ao db:rebuild) e povoa com histórico realista — nem tudo
// perfeito, nem nada alarmante, só uma operação normal com um par de setores
// pedindo atenção. Repetível: sempre parte do zero, nunca acumula em cima de si
// mesmo.
const UNIT_ID = 'u1';
const DIAS_DE_HISTORICO = 18;
const TURNOS = ['t1', 't2', 't3'];

// Setores fisicamente mais pesados (Bucharia suja, Gracharia) recebem um perfil
// levemente pior — o suficiente pra gerar um alerta AMARELO real, sem exagerar.
const SETORES_ATENCAO = new Set(['s8', 's9']);

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Nota central com ruído leve (soma de dois uniformes ~ aproxima uma gaussiana),
// arredondado e limitado à escala 1-5 do totem.
function pickScore(media) {
  const ruido = (Math.random() + Math.random() - 1) * 1.3;
  return clamp(Math.round(media + ruido), 1, 5);
}

async function limparDadosTransacionais() {
  const tabelas = [
    'acoes_plano', 'planos_acao', 'analises_periodicas', 'alertas', 'indices_setor',
    'requisicoes_totem', 'log_auditoria', 'hr_indicators', 'responses',
    'efetivos_setor_turno', 'configuracoes_indicadores',
    'totens', 'user_sectors', 'sectors', 'shifts', 'users', 'units',
  ];
  for (const tabela of tabelas) {
    await pool.query(`TRUNCATE TABLE ${tabela} CASCADE`).catch(() => {});
  }
}

function perfilDoSetor(sectorId) {
  return SETORES_ATENCAO.has(sectorId)
    ? { energia: 3.0, fisico: 3.3, estresse: 3.1 }
    : { energia: 4.1, fisico: 2.1, estresse: 2.0 };
}

async function seedRespostas() {
  const acumulador = new Map();
  const soma = (sectorId, shiftId, date, metric, score) => {
    const chave = [sectorId, shiftId, date, metric, score].join('|');
    acumulador.set(chave, (acumulador.get(chave) || 0) + 1);
  };

  for (let diasAtras = DIAS_DE_HISTORICO - 1; diasAtras >= 0; diasAtras--) {
    const date = dateKeyOffset(diasAtras);
    for (const [sectorId] of STANDARD_SECTORS) {
      const perfil = perfilDoSetor(sectorId);

      // Manhã e Tarde: cobertura normal, todo dia.
      for (const shiftId of ['t1', 't2']) {
        const respondentes = randInt(3, 7);
        for (let i = 0; i < respondentes; i++) {
          soma(sectorId, shiftId, date, 'ENERGY', pickScore(perfil.energia));
          soma(sectorId, shiftId, date, 'PHYSICAL', pickScore(perfil.fisico));
          soma(sectorId, shiftId, date, 'STRESS', pickScore(perfil.estresse));
        }
      }

      // Noite: cobertura esparsa (nem todo turno noturno é preenchido — realista).
      if (Math.random() < 0.35) {
        const respondentes = randInt(2, 4);
        for (let i = 0; i < respondentes; i++) {
          soma(sectorId, 't3', date, 'ENERGY', pickScore(perfil.energia));
          soma(sectorId, 't3', date, 'PHYSICAL', pickScore(perfil.fisico));
          soma(sectorId, 't3', date, 'STRESS', pickScore(perfil.estresse));
        }
      }
    }
  }

  for (const [chave, quantity] of acumulador) {
    const [sectorId, shiftId, date, metric, score] = chave.split('|');
    await execute(`
      INSERT INTO responses(id, unit_id, sector_id, shift_id, response_date, metric, score, quantity)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    `, [randomUUID(), UNIT_ID, sectorId, shiftId, date, metric, Number(score), quantity]);
  }

  return acumulador.size;
}

async function seedIndicadoresRh() {
  const semanas = [0, 7, 14];
  let total = 0;
  for (const [sectorId] of STANDARD_SECTORS) {
    const atencao = SETORES_ATENCAO.has(sectorId);
    for (const offset of semanas) {
      const period = dateKeyOffset(offset);
      const shiftId = TURNOS[randInt(0, 2)];
      const absences = atencao ? randInt(1, 3) : randInt(0, 1);
      const leaves = Math.random() < (atencao ? 0.4 : 0.15) ? 1 : 0;
      const overtimeHours = (atencao ? randInt(2, 8) : randInt(0, 4)) + (Math.random() < 0.5 ? 0 : 0.5);
      await execute(`
        INSERT INTO hr_indicators(id, unit_id, sector_id, shift_id, period, absences, leaves, overtime_hours, created_at)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [randomUUID(), UNIT_ID, sectorId, shiftId, period, absences, leaves, overtimeHours, new Date().toISOString()]);
      total += 1;
    }
  }
  return total;
}

async function main() {
  await limparDadosTransacionais();
  await runMigrations();
  await seedDatabase();
  const linhasRespostas = await seedRespostas();
  const linhasHr = await seedIndicadoresRh();
  console.log(`Banco limpo e populado com dados de demonstração:`);
  console.log(`  - ${DIAS_DE_HISTORICO} dias de histórico de respostas do totem (${linhasRespostas} linhas agregadas)`);
  console.log(`  - ${linhasHr} registros de indicadores do RH (faltas, afastamentos, horas extras)`);
  console.log(`  - Setores em atenção moderada (de propósito, pra ter algo real pra mostrar): Bucharia suja, Gracharia`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
