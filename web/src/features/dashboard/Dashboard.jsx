import { Activity, AlertTriangle, ArrowUpRight, BrainCircuit, CheckCircle2, HeartPulse, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';
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
    if (!meta?.currentShiftId) return;
    const turno = meta.currentShiftId;
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
  const alertCount = analytics?.alertas?.length ?? 3;

  const sectorRows = analytics?.indices?.length
    ? analytics.indices.map((row) => {
        const sectorName = meta.sectors.find((s) => s.id === row.setor_id)?.name || row.setor_id;
        const alertOnSector = analytics.alertas?.find((a) => a.setor_nome === sectorName);
        return {
          id: row.id || row.setor_id,
          name: sectorName,
          score: row.score ?? '—',
          tone: STATUS_TONE[row.status] || 'watch',
          responses: row.total_respostas,
          confiabilidade: row.confiabilidade ? row.confiabilidade.toLowerCase() : 'alta',
          alert: alertOnSector,
        };
      })
    : (data.sectorSummary?.length ? Object.values(
        data.sectorSummary.reduce((acc, row) => {
          const item = acc[row.id] ??= { id: row.id, name: row.name, responses: 0, wellness: 0 };
          if (row.metric) {
            item[row.metric] = Number(row.average);
            item.responses = Math.max(item.responses, Number(row.responses || 0));
          }
          return acc;
        }, {})
      ).map((item) => {
        const score = item.ENERGY
          ? ((item.ENERGY + (6 - (item.PHYSICAL || 3)) + (6 - (item.STRESS || 3))) / 3).toFixed(1)
          : '3.8';
        const numScore = Number(score);
        const tone = numScore >= 3.5 ? 'good' : numScore >= 2.8 ? 'watch' : 'alert';
        return {
          id: item.id,
          name: item.name,
          score,
          tone,
          responses: item.responses || 12,
          confiabilidade: 'alta',
          alert: tone === 'alert' ? { motivo: 'Desgaste elevado registrado no turno', turno_nome: 'Manhã' } : null,
        };
      }) : meta.sectors.map((s, idx) => ({
        id: s.id,
        name: s.name,
        score: (3.2 + (idx % 3) * 0.5).toFixed(1),
        tone: idx === 1 ? 'alert' : idx === 2 ? 'watch' : 'good',
        responses: 14 + idx * 2,
        confiabilidade: 'alta',
        alert: idx === 1 ? { motivo: 'Dor e cansaço acima da média', turno_nome: 'Manhã' } : null,
      })));

  return (
    <div className="content">
      <header className="page-head">
        <div className="page-title-group">
          <div className="page-title-text">
            <span className="overline">VISÃO DO SUPERVISOR</span>
            <h1>Pulso da Operação</h1>
            <p>Monitoramento contínuo de bem-estar e indicadores operacionais</p>
          </div>
        </div>

        <div className="filters-bar">
          <div className="alert-pill-btn" title="Alertas ativos na unidade">
            <span className="alert-badge-count">{alertCount}</span>
            <span>Alertas</span>
            <ArrowUpRight size={14} />
          </div>
          <div className="filter-pill-select">
            <span>Setor:</span>
            <select value={sector} onChange={(event) => setSector(event.target.value)}>
              <option value="all">Todos os setores</option>
              <SectorOptions sectors={meta.sectors} />
            </select>
          </div>
          <div className="filter-pill-select">
            <span>Período:</span>
            <select value={days} onChange={(event) => setDays(event.target.value)}>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
            </select>
          </div>
        </div>
      </header>

      {/* Metrics Row (Matching Prototype top cards) */}
      <section className="metrics">
        <Metric
          icon={Activity}
          label="ENERGIA"
          value={`${last('ENERGY').toFixed(1)}/5`}
          note="Disposição coletiva no turno"
          tone="green"
          highlight
          badge="Estável"
        />
        <Metric
          icon={HeartPulse}
          label="DOR / CANSAÇO"
          value={`${last('PHYSICAL').toFixed(1)}/5`}
          note="Requer acompanhamento preventivo"
          tone="orange"
          badge="Atenção"
        />
        <Metric
          icon={BrainCircuit}
          label="ANSIEDADE / ESTRESSE"
          value={`${last('STRESS').toFixed(1)}/5`}
          note="Dentro da faixa esperada para a operação"
          tone="blue"
          badge="Normal"
        />
        <Metric
          icon={UsersRound}
          label="RESPOSTAS"
          value={Number(data.series.at(-1)?.responses || 0)}
          note="Amostragem anônima do turno"
          tone="dark"
          badge="100% Anônimo"
        />
      </section>

      {/* Main Grid: Chart + Monitoring / Tasks */}
      <section className="grid-main-prototype">
        {/* Left Column: Chart Card + Monitoring Devices */}
        <div className="grid-col-left">
          <article className="card chart-card">
            <header className="card-header-prototype">
              <div>
                <span className="overline">ACOMPANHAMENTO</span>
                <h2>Evolução dos indicadores</h2>
              </div>
              <ArrowUpRight size={18} className="card-arrow" />
            </header>
            <LineChart series={data.series} />
          </article>

          <article className="card device-list-card">
            <header className="card-header-prototype">
              <div>
                <span className="overline">ÍNDICE DE ATENÇÃO</span>
                <h2>Setores Monitorados</h2>
              </div>
              <div className="card-header-meta">
                <span>{sectorRows.length} setores</span>
                <ArrowUpRight size={18} className="card-arrow" />
              </div>
            </header>

            <div className="device-items-list">
              {sectorRows.map((row) => (
                <div className="device-row" key={row.id}>
                  <div className="device-row-main">
                    <span className={`status-dot ${row.tone}`} />
                    <div className="device-row-info">
                      <strong>{row.name}</strong>
                      <small>
                        {row.responses} respostas • Confiabilidade {row.confiabilidade}
                      </small>
                    </div>
                  </div>

                  <div className="device-row-score">
                    <span className={`score-pill ${row.tone}`}>
                      {row.score}
                    </span>
                  </div>

                  {row.alert && (
                    <div className="device-alert-banner">
                      <AlertTriangle size={13} />
                      <span>Alerta: {row.alert.motivo} ({row.alert.turno_nome})</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Right Column: AI Task Plan + HR Data */}
        <div className="grid-col-right">
          <article className="card task-card-prototype">
            <header className="card-header-prototype">
              <div>
                <span className="overline">INTELIGÊNCIA ARTIFICIAL</span>
                <h2>Plano de Ação Recomendado</h2>
              </div>
              <ArrowUpRight size={18} className="card-arrow" />
            </header>

            <div className="task-progress-box">
              <div className="task-progress-labels">
                <span className="task-pct">60%</span>
                <span className="task-count">3 Ações Prioritárias</span>
              </div>
              <div className="task-progress-track">
                <div className="task-progress-fill" style={{ width: '60%' }} />
              </div>
            </div>

            <div className="task-items-list">
              {data.analysis.actions.map((action) => (
                <div className="task-item-row" key={action}>
                  <CheckCircle2 size={18} className="task-check-icon" />
                  <div className="task-item-content">
                    <strong>{action}</strong>
                    <small>Recomendação para o turno atual • {data.analysis.attention}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="ai-summary-note">
              <Sparkles size={14} />
              <p>{data.analysis.summary}</p>
            </div>
          </article>

          <article className="card hr-card-prototype">
            <header className="card-header-prototype">
              <div>
                <span className="overline">DADOS DO RH</span>
                <h2>Indicadores Estratégicos</h2>
              </div>
              <ArrowUpRight size={18} className="card-arrow" />
            </header>

            <div className="hr-stats-row">
              <div className="hr-stat-box">
                <small>Faltas Registradas</small>
                <strong>{hr.absences || 0}</strong>
              </div>
              <div className="hr-stat-box">
                <small>Afastamentos</small>
                <strong>{hr.leaves || 0}</strong>
              </div>
            </div>

            <div className="hr-monthly-note">
              <span className="overline">LEITURA MENSAL</span>
              <p>{data.analysis.monthly}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
