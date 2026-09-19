import { Activity, BrainCircuit, HeartPulse, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LineChart } from '../../components/LineChart.jsx';
import { Metric } from '../../components/Metric.jsx';
import { SectorOptions } from '../../components/SectorOptions.jsx';

export function Dashboard({ auth }) {
  const [meta, setMeta] = useState();
  const [data, setData] = useState();
  const [sector, setSector] = useState('all');
  const [days, setDays] = useState(30);
  useEffect(() => { api('/api/meta', {}, auth.token).then(setMeta); }, [auth.token]);
  useEffect(() => { api(`/api/dashboard?sector=${sector}&days=${days}`, {}, auth.token).then(setData); }, [auth.token, sector, days]);
  if (!data || !meta) return <div className="loading">Cruzando indicadores…</div>;
  const last = (metric) => data.series.filter((row) => row.metric === metric).at(-1)?.average || 0;
  const hr = data.hr[0] || {};
  return <div className="content"><header className="page-head"><div><span className="overline">VISÃO DO SUPERVISOR</span><h1>Pulso da operação</h1><p>Bem-estar e indicadores estratégicos analisados em conjunto.</p></div><div className="filters">
    <select value={sector} onChange={(event) => setSector(event.target.value)}><option value="all">Todos os setores</option><SectorOptions sectors={meta.sectors} /></select>
    <select value={days} onChange={(event) => setDays(event.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select>
  </div></header>
    <section className="metrics"><Metric icon={Activity} label="ENERGIA" value={`${last('ENERGY').toFixed(1)}/5`} note="Estável no período" tone="green" /><Metric icon={HeartPulse} label="DOR / CANSAÇO" value={`${last('PHYSICAL').toFixed(1)}/5`} note="Requer acompanhamento" tone="orange" /><Metric icon={BrainCircuit} label="ANSIEDADE / ESTRESSE" value={`${last('STRESS').toFixed(1)}/5`} note="Dentro da faixa esperada" tone="blue" /><Metric icon={UsersRound} label="RESPOSTAS" value={data.series.at(-1)?.responses || 0} note="Sempre anônimas" tone="dark" /></section>
    <section className="grid"><article className="card chart-card"><header><div><span className="overline">ACOMPANHAMENTO</span><h2>Evolução dos indicadores</h2></div></header><LineChart series={data.series} /></article>
      <article className="card ai"><div className="ai-tag"><Sparkles /> ANÁLISE DA IA • SEMANAL</div><span className="attention">Atenção {data.analysis.attention.toLowerCase()}</span><h2>{data.analysis.title}</h2><p>{data.analysis.summary}</p><h3>Plano de ação sugerido</h3>{data.analysis.actions.map((action, index) => <div className="action" key={action}><span>{index + 1}</span>{action}</div>)}<small>Análise simulada para o MVP. Apoia decisões, não realiza diagnóstico.</small></article>
    </section><section className="grid bottom"><article className="card hr-card"><header><div><span className="overline">DADOS DO RH</span><h2>Indicadores estratégicos</h2></div><span>Último período</span></header><div className="hr-metrics compact"><div><small>Faltas</small><strong>{hr.absences || 0}</strong></div><div><small>Afastamentos</small><strong>{hr.leaves || 0}</strong></div></div></article><article className="card monthly"><span className="overline">LEITURA MENSAL DA IA</span><h2>Visão consolidada</h2><p>{data.analysis.monthly}</p></article></section>
  </div>;
}
