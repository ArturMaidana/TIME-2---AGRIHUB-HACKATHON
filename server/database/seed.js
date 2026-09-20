import { randomUUID } from 'node:crypto';
import { queryOne, execute } from '../config/database.js';

export const STANDARD_SECTORS = [
  ['s1', 'Desossa', 'FRIA'], ['s2', 'Embalagem secundária', 'FRIA'],
  ['s3', 'Abate primeira fase', 'QUENTE'], ['s4', 'Expedição caixaria', 'FRIA'],
  ['s5', 'Abate segunda fase', 'QUENTE'], ['s6', 'Miúdos', 'QUENTE'],
  ['s7', 'Bucharia limpa', 'QUENTE'], ['s8', 'Bucharia suja', 'QUENTE'],
  ['s9', 'Gracharia', 'QUENTE'], ['s10', 'Expedição com osso', 'FRIA'],
  ['s11', 'Administrativo/Comercial', 'FRIA'],
];

const SHIFTS = [
  ['t1', 'Manhã', '06:00', '14:20'], ['t2', 'Tarde', '14:20', '22:35'],
  ['t3', 'Noite', '22:35', '06:00'],
];

const EFETIVO_ESPERADO_PADRAO = 5;

// Seed cadastral mínimo: unidade, setores, turnos, usuários, totem, configuração do
// índice e headcount esperado. Nenhuma resposta de totem, indicador de RH, índice,
// alerta, análise ou plano de ação é gerado aqui — essas tabelas só recebem linhas a
// partir de uso real do sistema. Ver docs/superpowers/specs/2026-09-19-banco-minimo-
// fluxo-real-design.md.
export async function seedDatabase() {
  const existing = await queryOne('SELECT id FROM units LIMIT 1');
  if (existing) return;

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
        VALUES($1, 'u1', $2, $3, $4)
      `, [randomUUID(), sectorId, shiftId, EFETIVO_ESPERADO_PADRAO]);
    }
  }
}
