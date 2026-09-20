import { SupervisorAnalyticsService } from '../services/supervisor-analytics-service.js';
import { json, parseBody } from '../utils/http.js';
import { dateKey } from '../utils/date.js';

function scopedSectorIds(_session, url) {
  const requested = url.searchParams.get('setor');
  if (requested && requested !== 'all') return [requested];
  return null;
}

export async function getIndices(_request, response, { session, url }) {
  const tipoPeriodo = url.searchParams.get('periodo') || 'DIARIO';
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  const turnoId = url.searchParams.get('turno');
  const rows = await SupervisorAnalyticsService.indices({
    unidadeId: session.unitId, setorIds: scopedSectorIds(session, url), turnoId, tipoPeriodo, dataPeriodo,
  });
  json(response, 200, { indices: rows });
}

export async function getComparativo(_request, response, { session, url }) {
  const setorId = url.searchParams.get('setor');
  const turnoId = url.searchParams.get('turno');
  const tipoPeriodo = url.searchParams.get('periodo') || 'DIARIO';
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  if (!setorId || !turnoId) return json(response, 422, { error: 'Informe setor e turno' });
  json(response, 200, await SupervisorAnalyticsService.comparativo({
    unidadeId: session.unitId, setorId, turnoId, tipoPeriodo, dataPeriodo,
  }));
}

export async function getParticipacao(_request, response, { session, url }) {
  const setorId = url.searchParams.get('setor');
  const turnoId = url.searchParams.get('turno');
  const tipoPeriodo = url.searchParams.get('periodo') || 'DIARIO';
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  if (!setorId || !turnoId) return json(response, 422, { error: 'Informe setor e turno' });
  json(response, 200, await SupervisorAnalyticsService.participacao({
    unidadeId: session.unitId, setorId, turnoId, tipoPeriodo, dataPeriodo,
  }));
}

export async function getAlertas(_request, response, { session, url }) {
  const status = url.searchParams.get('status');
  const setorIds = scopedSectorIds(session, url);
  const rows = await SupervisorAnalyticsService.alertas({ unidadeId: session.unitId, setorIds, status });
  json(response, 200, { alertas: rows });
}

export async function patchAlerta(request, response, { session, url }) {
  const id = url.pathname.split('/').pop();
  const body = await parseBody(request);
  const result = await SupervisorAnalyticsService.atualizarAlerta({ unidadeId: session.unitId, id, status: body.status });
  json(response, result.ok ? 200 : 422, result);
}

export async function getAnalises(_request, response, { session, url }) {
  const periodicidade = url.searchParams.get('periodicidade') === 'mensal' ? 'MENSAL' : 'SEMANAL';
  const setorIds = scopedSectorIds(session, url);
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  const rows = await SupervisorAnalyticsService.analises({ unidadeId: session.unitId, periodicidade, setorIds, dataPeriodo });
  json(response, 200, { analises: rows });
}

export async function getPlanosAcao(_request, response, { session, url }) {
  const setorIds = scopedSectorIds(session, url);
  const rows = await SupervisorAnalyticsService.planosAcao({ unidadeId: session.unitId, setorIds });
  json(response, 200, { planos: rows });
}

export async function patchPlanoAcao(request, response, { session, url }) {
  const id = url.pathname.split('/').pop();
  const body = await parseBody(request);
  const result = await SupervisorAnalyticsService.atualizarPlanoAcao({ unidadeId: session.unitId, id, status: body.status });
  json(response, result.ok ? 200 : 422, result);
}

export async function getNotificacoes(_request, response, { session, url }) {
  const status = url.searchParams.get('status');
  const setorIds = scopedSectorIds(session, url);
  const rows = await SupervisorAnalyticsService.notificacoes({ unidadeId: session.unitId, setorIds, status });
  json(response, 200, { notificacoes: rows });
}

export async function patchNotificacao(request, response, { session, url }) {
  const id = url.pathname.split('/').pop();
  const body = await parseBody(request);
  const result = await SupervisorAnalyticsService.atualizarNotificacao({
    unidadeId: session.unitId, id, status: body.status, resposta: body.resposta,
  });
  json(response, result.ok ? 200 : 422, result);
}
