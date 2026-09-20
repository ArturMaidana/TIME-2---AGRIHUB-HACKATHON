import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { buildSectorRows } from './sector-utils.js';

const STATUS_TONE = { VERDE: 'good', AMARELO: 'watch', VERMELHO: 'alert' };

export function SectorIndicators({ auth }) {
  const [data, setData] = useState();
  const [meta, setMeta] = useState();
  const [indices, setIndices] = useState([]);
  useEffect(() => { api('/api/dashboard?days=30', {}, auth.token).then(setData); }, [auth.token]);
  useEffect(() => { api('/api/meta', {}, auth.token).then(setMeta); }, [auth.token]);
  useEffect(() => {
    if (!meta?.currentShiftId) return;
    api(`/api/v1/supervisor/indices?turno=${meta.currentShiftId}`, {}, auth.token).then((res) => setIndices(res.indices));
  }, [auth.token, meta]);
  if (!data || !meta) return <div className="loading">Carregando indicadores…</div>;

  const indiceBySector = Object.fromEntries(indices.map((row) => [row.setor_id, row]));
  const rows = buildSectorRows(data.sectorSummary)
    .map((row) => ({ ...row, indice: indiceBySector[row.id] }))
    .sort((a, b) => (a.indice?.score ?? 100) - (b.indice?.score ?? 100));

  return <div className="content"><header className="page-head"><div><span className="overline">INDICADORES POR SETOR</span><h1>Saúde das equipes</h1><p>Comparativo dos últimos 30 dias por área e setor, ordenado por nível de atenção.</p></div><div className="period-badge"><CalendarDays />Últimos 30 dias</div></header>
    {['QUENTE', 'FRIA'].map((category) => <section className="sector-report" key={category}><header><div><span className={`area-mark ${category.toLowerCase()}`} /><div><span className="overline">{category === 'QUENTE' ? 'ÁREA QUENTE' : 'ÁREA FRIA'}</span><h2>{category === 'QUENTE' ? 'Processamento inicial' : 'Processamento e expedição'}</h2></div></div><span>{rows.filter((row) => row.category === category).length} setores</span></header>
      <div className="sector-table"><div className="sector-table-head"><span>Setor</span><span>Energia</span><span>Dor / cansaço</span><span>Estresse</span><span>Índice de atenção</span><span>Amostra</span></div>
        {rows.filter((row) => row.category === category).map((row) => <div className="sector-table-row" key={row.id}>
          <strong>{row.name}</strong><span>{row.ENERGY?.toFixed(1) || '—'}</span><span>{row.PHYSICAL?.toFixed(1) || '—'}</span><span>{row.STRESS?.toFixed(1) || '—'}</span>
          <span><b className={STATUS_TONE[row.indice?.status] || 'watch'}>{row.indice?.score ?? '—'}</b></span>
          <span>{row.indice ? `${row.indice.total_respostas} (${row.indice.confiabilidade.toLowerCase()})` : '—'}</span>
        </div>)}
      </div></section>)}
  </div>;
}
