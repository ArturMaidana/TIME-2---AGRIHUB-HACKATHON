import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { buildSectorRows } from './sector-utils.js';

export function SectorIndicators({ auth }) {
  const [data, setData] = useState();
  useEffect(() => { api('/api/dashboard?days=30', {}, auth.token).then(setData); }, [auth.token]);
  if (!data) return <div className="loading">Carregando indicadores…</div>;
  const rows = buildSectorRows(data.sectorSummary);
  return <div className="content"><header className="page-head"><div><span className="overline">INDICADORES POR SETOR</span><h1>Saúde das equipes</h1><p>Comparativo dos últimos 30 dias por área e setor.</p></div><div className="period-badge"><CalendarDays />Últimos 30 dias</div></header>
    {['QUENTE', 'FRIA'].map((category) => <section className="sector-report" key={category}><header><div><span className={`area-mark ${category.toLowerCase()}`} /><div><span className="overline">{category === 'QUENTE' ? 'ÁREA QUENTE' : 'ÁREA FRIA'}</span><h2>{category === 'QUENTE' ? 'Processamento inicial' : 'Processamento e expedição'}</h2></div></div><span>{rows.filter((row) => row.category === category).length} setores</span></header>
      <div className="sector-table"><div className="sector-table-head"><span>Setor</span><span>Energia</span><span>Dor / cansaço</span><span>Estresse</span><span>Índice de bem-estar</span><span>Respostas</span></div>
        {rows.filter((row) => row.category === category).map((row) => <div className="sector-table-row" key={row.id}><strong>{row.name}</strong><span>{row.ENERGY?.toFixed(1) || '—'}</span><span>{row.PHYSICAL?.toFixed(1) || '—'}</span><span>{row.STRESS?.toFixed(1) || '—'}</span><span><b className={row.wellness >= 3.6 ? 'good' : row.wellness >= 3 ? 'watch' : 'alert'}>{row.wellness ? row.wellness.toFixed(1) : '—'}</b></span><span>{row.responses}</span></div>)}
      </div></section>)}
  </div>;
}
