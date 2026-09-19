import { Activity, BrainCircuit, HeartPulse, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LineChart } from '../../components/LineChart.jsx';
import { Metric } from '../../components/Metric.jsx';
import { SectorOptions } from '../../components/SectorOptions.jsx';

const STATUS_TONE = { VERDE: 'good', AMARELO: 'watch', VERMELHO: 'alert' };

export function Dashboard({ auth }) {
  const [meta, setMeta] = useState();
  const [data, setData] = useState();
  const [sector, setSector] = useState('all');
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState();
  useEffect(() => { api('/api/meta', {}, auth.token).then(setMeta); }, [auth.token]);
  useEffect(() => { api(`/api/dashboard?sector=${sector}&days=${days}`, {}, auth.token).then(setData); }, [auth.token, sector, days]);
  useEffect(() => {
    if (!meta?.shifts?.length) return;
    const turno = meta.shifts[0].id;
    // `indices` e `analises` geram índices/alertas/planos como efeito colateral do
    // cálculo — precisam terminar ANTES de ler `alertas`, senão a leitura corre na
    // frente da escrita (Promise.all não garante ordem entre requisições distintas).
    Promise.all([
      api(`/api/v1/supervisor/indices?turno=${turno}${sector !== 'all' ? `&setor=${sector}` : ''}`, {}, auth.token),
      api('/api/v1/supervisor/analises?periodicidade=semanal', {}, auth.token),
    ]).then(([indicesRes]) => api('/api/v1/supervisor/alertas?status=ABERTO', {}, auth.token).then((alertasRes) => {
      setAnalytics({ indices: indicesRes.indices, alertas: alertasRes.alertas });
      return api(`/api/dashboard?sector=${sector}&days=${days}`, {}, auth.token).then(setData);
    }));
  }, [auth.token, meta, sector, days]);
  if (!data || !meta) return <div className="loading">Cruzando indicadores…</div>;
  const last = (metric) => Number(data.series.filter((row) => row.metric === metric).at(-1)?.average || 0);
  const hr = data.hr[0] || {};
  return <div className="content"><header className="page-head"><div><span className="overline">VISÃO DO SUPERVISOR</span><h1>Pulso da operação</h1><p>Bem-estar e indicadores estratégicos analisados em conjunto.</p></div><div className="filters">
    <select value={sector} onChange={(event) => setSector(event.target.value)}><option value="all">Todos os setores</option><SectorOptions sectors={meta.sectors} /></select>
    <select value={days} onChange={(event) => setDays(event.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select>
  </div></header>
    <section className="metrics"><Metric icon={Activity} label="ENERGIA" value={`${last('ENERGY').toFixed(1)}/5`} note="Estável no período" tone="green" /><Metric icon={HeartPulse} label="DOR / CANSAÇO" value={`${last('PHYSICAL').toFixed(1)}/5`} note="Requer acompanhamento" tone="orange" /><Metric icon={BrainCircuit} label="ANSIEDADE / ESTRESSE" value={`${last('STRESS').toFixed(1)}/5`} note="Dentro da faixa esperada" tone="blue" /><Metric icon={UsersRound} label="RESPOSTAS" value={Number(data.series.at(-1)?.responses || 0)} note="Sempre anônimas" tone="dark" /></section>
    {analytics && <section className="grid">
      <article className="card">
        <header><div><span className="overline">ÍNDICE DE ATENÇÃO</span><h2>Setores monitorados</h2></div></header>
        <div className="sector-table">
          <div className="sector-table-head"><span>Setor</span><span>Índice</span><span>Status</span><span>Amostra</span></div>
          {analytics.indices.map((row) => <div className="sector-table-row" key={row.id}>
            <strong>{meta.sectors.find((s) => s.id === row.setor_id)?.name || row.setor_id}</strong>
            <span><b className={STATUS_TONE[row.status] || 'watch'}>{row.score ?? '—'}</b></span>
            <span>{row.status || row.confiabilidade}</span>
            <span>{row.total_respostas} respostas ({row.confiabilidade.toLowerCase()})</span>
          </div>)}
        </div>
      </article>
      <article className="card">
        <header><div><span className="overline">ALERTAS ATIVOS</span><h2>{analytics.alertas.length} em aberto</h2></div></header>
        {analytics.alertas.length === 0 && <p>Nenhum alerta aberto no momento.</p>}
        {analytics.alertas.map((alerta) => <div className="alert-item" key={alerta.id}>
          <b className={alerta.nivel === 'VERMELHO' ? 'alert' : 'watch'}>{alerta.nivel}</b>
          <span>{alerta.motivo} — {alerta.setor_nome} ({alerta.turno_nome})</span>
        </div>)}
      </article>
    </section>}
    <section className="grid"><article className="card chart-card"><header><div><span className="overline">ACOMPANHAMENTO</span><h2>Evolução dos indicadores</h2></div></header><LineChart series={data.series} /></article>
      <article className="card ai"><div className="ai-tag"><Sparkles /> ANÁLISE DA IA • SEMANAL</div><span className="attention">Atenção {data.analysis.attention.toLowerCase()}</span><h2>{data.analysis.title}</h2><p>{data.analysis.summary}</p><h3>Plano de ação sugerido</h3>{data.analysis.actions.map((action, index) => <div className="action" key={action}><span>{index + 1}</span>{action}</div>)}<small>Análise simulada para o MVP. Apoia decisões, não realiza diagnóstico.</small></article>
    </section><section className="grid bottom"><article className="card hr-card"><header><div><span className="overline">DADOS DO RH</span><h2>Indicadores estratégicos</h2></div><span>Último período</span></header><div className="hr-metrics compact"><div><small>Faltas</small><strong>{hr.absences || 0}</strong></div><div><small>Afastamentos</small><strong>{hr.leaves || 0}</strong></div></div></article><article className="card monthly"><span className="overline">LEITURA MENSAL DA IA</span><h2>Visão consolidada</h2><p>{data.analysis.monthly}</p></article></section>
  </div>;
}
