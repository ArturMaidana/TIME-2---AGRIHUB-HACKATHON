import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/services/auth-service.js';
import { DashboardService } from '../server/services/dashboard-service.js';
import { TotemService } from '../server/services/totem-service.js';

test('serviço de autenticação separa supervisor e totem', async () => {
  assert.equal((await AuthService.authenticate({ type: 'SUPERVISOR', code: 'SUPERVISOR' })).role, 'SUPERVISOR');
  assert.equal((await AuthService.authenticate({ type: 'TOTEM', code: 'TOTEM-01' })).role, 'TOTEM');
  assert.equal(await AuthService.authenticate({ type: 'SUPERVISOR', code: 'invalido' }), null);
});

test('serviço do totem retorna setores padronizados e turno automático', async () => {
  const context = await TotemService.getContext('u1');
  assert.equal(context.sectors.length, 10);
  assert.ok(context.shift.id);
  assert.deepEqual(new Set(context.sectors.map((sector) => sector.category)), new Set(['QUENTE', 'FRIA']));
});

test('serviço do dashboard entrega as três camadas de análise mesmo sem histórico', async () => {
  const dashboard = await DashboardService.get({ unitId: 'u1', days: 30 });
  assert.ok(Array.isArray(dashboard.series));
  assert.equal(new Set(dashboard.sectorSummary.map((row) => row.id)).size, 10);
  assert.ok(Array.isArray(dashboard.analysis.actions));
  assert.ok(['BAIXA', 'MODERADA', 'ALTA'].includes(dashboard.analysis.attention));
});
