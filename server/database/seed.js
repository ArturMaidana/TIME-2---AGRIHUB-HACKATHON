import { randomUUID } from 'node:crypto';
import { queryOne, execute } from '../config/database.js';

export const STANDARD_SECTORS = [
  ['s1', 'Desossa', 'FRIA'], ['s2', 'Embalagem secundária', 'FRIA'],
  ['s3', 'Abate primeira fase', 'QUENTE'], ['s4', 'Expedição caixaria', 'FRIA'],
  ['s5', 'Abate segunda fase', 'QUENTE'], ['s6', 'Miúdos', 'QUENTE'],
  ['s7', 'Bucharia limpa', 'QUENTE'], ['s8', 'Bucharia suja', 'QUENTE'],
  ['s9', 'Gracharia', 'QUENTE'], ['s10', 'Expedição com osso', 'FRIA'],
];

const SHIFTS = [
  ['t1', 'Manhã', '06:00', '14:20'], ['t2', 'Tarde', '14:20', '22:35'],
  ['t3', 'Noite', '22:35', '06:00'],
];

async function seedResponses(sectorStart = 0) {
  const today = new Date();
  for (let day = 34; day >= 0; day -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - day);
    if (day !== 0 && [0, 6].includes(date.getDay())) continue;
    const dateKey = date.toISOString().slice(0, 10);
    for (let index = sectorStart; index < STANDARD_SECTORS.length; index += 1) {
      for (const metric of ['ENERGY', 'PHYSICAL', 'STRESS']) {
        const base = metric === 'ENERGY' ? 3.9 - index * 0.07 : 2 + index * 0.08;
        for (let score = 1; score <= 5; score += 1) {
          const quantity = Math.max(0, Math.round(8 - Math.abs(score - (base + Math.sin(day / 4) * 0.25)) * 3));
          if (!quantity) continue;
          await execute(`
            INSERT INTO responses(id, unit_id, sector_id, shift_id, response_date, metric, score, quantity)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (unit_id, sector_id, shift_id, response_date, metric, score) DO NOTHING
          `, [randomUUID(), 'u1', STANDARD_SECTORS[index][0], SHIFTS[day % 2][0], dateKey, metric, score, quantity]);
        }
      }
    }
  }
}

const EXAMPLE_ALERT_SECTOR = 's10';
const EXAMPLE_ALERT_SHIFT = 't1';

// Força um exemplo de alerta sempre visível na demo: substitui as respostas de
// "hoje" para um setor/turno por uma distribuição claramente ruim (índice cai
// para a faixa vermelha), independente do dia da semana em que o seed rodar.
async function seedExampleAlertToday() {
  const todayKey = new Date().toISOString().slice(0, 10);
  await execute(
    'DELETE FROM responses WHERE unit_id = $1 AND sector_id = $2 AND shift_id = $3 AND response_date = $4',
    ['u1', EXAMPLE_ALERT_SECTOR, EXAMPLE_ALERT_SHIFT, todayKey],
  );
  const distribution = {
    ENERGY: { 1: 9, 2: 6, 3: 2 },
    PHYSICAL: { 3: 1, 4: 6, 5: 10 },
    STRESS: { 3: 1, 4: 5, 5: 11 },
  };
  for (const [metric, scores] of Object.entries(distribution)) {
    for (const [score, quantity] of Object.entries(scores)) {
      await execute(`
        INSERT INTO responses(id, unit_id, sector_id, shift_id, response_date, metric, score, quantity)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (unit_id, sector_id, shift_id, response_date, metric, score) DO UPDATE SET quantity = $8
      `, [randomUUID(), 'u1', EXAMPLE_ALERT_SECTOR, EXAMPLE_ALERT_SHIFT, todayKey, metric, Number(score), quantity]);
    }
  }
}

export async function seedDatabase() {
  const existing = await queryOne('SELECT id FROM units LIMIT 1');
  if (!existing) {
    await execute('INSERT INTO units VALUES($1, $2, $3)', ['u1', 'Frigorífico Vale Verde', 'America/Cuiaba']);
    await execute('INSERT INTO users VALUES($1, $2, $3, $4, $5)', ['sup1', 'u1', 'SUPERVISOR', 'Marina Alves', 'SUPERVISOR']);
    await execute('INSERT INTO users VALUES($1, $2, $3, $4, $5)', ['rh1', 'u1', 'RH', 'Equipe de RH', 'RH2026']);
    for (const [id, name, category] of STANDARD_SECTORS) {
      await execute('INSERT INTO sectors(id, unit_id, name, category) VALUES($1, $2, $3, $4)', [id, 'u1', name, category]);
      await execute('INSERT INTO user_sectors VALUES($1, $2)', ['sup1', id]);
    }
    for (const shift of SHIFTS) {
      await execute('INSERT INTO shifts VALUES($1, $2, $3, $4, $5)', [shift[0], 'u1', shift[1], shift[2], shift[3]]);
    }
    await execute('INSERT INTO totens VALUES($1, $2, $3, $4, 1)', ['tot1', 'u1', 'Entrada principal', 'TOTEM-01']);
    await execute('INSERT INTO configuracoes_indicadores(id, unidade_id) VALUES($1, $2)', [randomUUID(), 'u1']);
    for (const [sectorId] of STANDARD_SECTORS) {
      for (const [shiftId] of SHIFTS) {
        await execute(`
          INSERT INTO efetivos_setor_turno(id, unidade_id, setor_id, turno_id, efetivo_esperado)
          VALUES($1, 'u1', $2, $3, 15)
        `, [randomUUID(), sectorId, shiftId]);
      }
    }
    await seedResponses();
    const today = new Date();
    for (let week = 4; week >= 0; week -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - week * 7);
      for (let index = 0; index < STANDARD_SECTORS.length; index += 1) {
        await execute(`
          INSERT INTO hr_indicators(id, unit_id, sector_id, shift_id, period, absences, leaves, created_at)
          VALUES($1, $2, $3, $4, $5, $6, $7, $8)
        `, [randomUUID(), 'u1', STANDARD_SECTORS[index][0], 't1', date.toISOString().slice(0, 10), 2 + index, index % 3, new Date().toISOString()]);
      }
    }
  } else {
    const count = await queryOne("SELECT COUNT(*)::int AS total FROM responses WHERE sector_id = 's5'");
    if (count.total === 0) await seedResponses(4);
  }
  await seedExampleAlertToday();
}
