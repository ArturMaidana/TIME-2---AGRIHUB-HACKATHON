import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/services/auth-service.js';
import { DashboardService } from '../server/services/dashboard-service.js';
import { TotemService } from '../server/services/totem-service.js';

test('serviço de autenticação separa supervisor e totem', () => {
  assert.equal(AuthService.authenticate({ type: 'SUPERVISOR', code: 'SUPERVISOR' }).role, 'SUPERVISOR');
  assert.equal(AuthService.authenticate({ type: 'TOTEM', code: 'TOTEM-01' }).role, 'TOTEM');
  assert.equal(AuthService.authenticate({ type: 'SUPERVISOR', code: 'invalido' }), null);
});

test('serviço do totem retorna setores padronizados e turno automático', () => {
  const context = TotemService.getContext('u1');
  assert.equal(context.sectors.length, 10);
  assert.ok(context.shift.id);
  assert.deepEqual(new Set(context.sectors.map((sector) => sector.category)), new Set(['QUENTE', 'FRIA']));
});

test('serviço do dashboard entrega as três camadas de análise', () => {
  const dashboard = DashboardService.get({ unitId: 'u1', days: 30 });
  assert.ok(dashboard.series.length > 0);
  assert.equal(new Set(dashboard.sectorSummary.map((row) => row.id)).size, 10);
  assert.ok(dashboard.analysis.actions.length > 0);
});
