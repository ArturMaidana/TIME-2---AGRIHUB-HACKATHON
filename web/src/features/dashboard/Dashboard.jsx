import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Factory,
  Flame,
  HeartPulse,
  Layers,
  Package,
  Snowflake,
  Sparkles,
  TrendingUp,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';
import { LineChart } from '../../components/LineChart.jsx';
import { Metric } from '../../components/Metric.jsx';

const STATUS_TONE = { VERDE: 'good', AMARELO: 'watch', VERMELHO: 'alert' };

const PERIOD_OPTIONS = [
  {
    days: 7,
    title: 'Últimos 7 dias',
    badge: 'Tático / Semanal',
    desc: 'Visão recente para avaliar impactos imediatos no ritmo dos turnos',
    icon: Clock,
    className: 'period-7',
  },
  {
    days: 30,
    title: 'Últimos 30 dias',
    badge: 'Padrão Recomendado',
    desc: 'Base completa recomendada para cruzar bem-estar com dados do RH',
    icon: CalendarDays,
    className: 'period-30',
  },
  {
    days: 90,
    title: 'Últimos 90 dias',
    badge: 'Trimestral / Histórico',
    desc: 'Tendência consolidada para planejamento estratégico e sazonalidade',
    icon: TrendingUp,
    className: 'period-90',
  },
];

export function Dashboard({ auth }) {
  const [meta, setMeta] = useState();
  const [data, setData] = useState();
  const [sector, setSector] = useState('all');
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState();
  const [filterModal, setFilterModal] = useState(null); // 'sector' | 'period' | null

  // Fechar modal ao pressionar a tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFilterModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

          {/* Botão Interativo: Filtro de Setor */}
          <button
            type="button"
            className="filter-pill-btn"
            onClick={() => setFilterModal('sector')}
            title="Filtrar por setor da fábrica"
          >
            <span className="filter-pill-label">Setor:</span>
            <span className="filter-pill-value">
              {sector === 'all'
                ? 'Todos os setores'
                : meta.sectors?.find((s) => s.id === sector)?.name || sector}
            </span>
            <ChevronDown size={14} className="filter-pill-chevron" />
          </button>

          {/* Botão Interativo: Filtro de Período */}
          <button
            type="button"
            className="filter-pill-btn"
            onClick={() => setFilterModal('period')}
            title="Alterar período de análise"
          >
            <span className="filter-pill-label">Período:</span>
            <span className="filter-pill-value">{days} dias</span>
            <ChevronDown size={14} className="filter-pill-chevron" />
          </button>
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

      {/* =====================================================================
          MODAL DE SELEÇÃO DE SETOR
          ===================================================================== */}
      {filterModal === 'sector' && (
        <div
          className="filter-modal-backdrop"
          onClick={() => setFilterModal(null)}
        >
          <div
            className="filter-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="filter-modal-header">
              <div className="filter-modal-title-group">
                <div className="filter-modal-icon-badge">
                  <Factory size={22} />
                </div>
                <div>
                  <h3>Filtrar por Setor</h3>
                  <p>Selecione uma área da planta industrial ou veja todos os setores consolidados</p>
                </div>
              </div>
              <button
                type="button"
                className="filter-modal-close-btn"
                onClick={() => setFilterModal(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="filter-modal-body">
              {/* Opção Todos os Setores */}
              <div className="filter-modal-section-title">
                <Layers size={13} />
                <span>Visão Geral</span>
              </div>
              <div className="filter-options-grid">
                <div
                  className={`filter-option-card ${sector === 'all' ? 'is-active' : ''}`}
                  onClick={() => {
                    setSector('all');
                    setFilterModal(null);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="filter-option-main">
                    <div className="filter-option-icon-box all">
                      <Layers size={20} />
                    </div>
                    <div className="filter-option-text">
                      <strong>Todos os setores</strong>
                      <p>Visão consolidada de todas as áreas quentes e frias da planta</p>
                    </div>
                  </div>
                  <div className="filter-option-right">
                    <span className="filter-option-badge all">Planta Completa</span>
                    <div className="filter-option-check">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Opções Área Quente */}
              {meta.sectors.filter((s) => s.category === 'QUENTE').length > 0 && (
                <>
                  <div className="filter-modal-section-title">
                    <Flame size={13} style={{ color: '#d96324' }} />
                    <span>Área Quente (Processamento Inicial)</span>
                  </div>
                  <div className="filter-options-grid">
                    {meta.sectors
                      .filter((s) => s.category === 'QUENTE')
                      .map((sec) => {
                        const isSelected = sector === sec.id;
                        return (
                          <div
                            key={sec.id}
                            className={`filter-option-card ${isSelected ? 'is-active' : ''}`}
                            onClick={() => {
                              setSector(sec.id);
                              setFilterModal(null);
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="filter-option-main">
                              <div className="filter-option-icon-box hot">
                                <Flame size={20} />
                              </div>
                              <div className="filter-option-text">
                                <strong>{sec.name}</strong>
                                <p>Processamento térmico, abate e triagem inicial</p>
                              </div>
                            </div>
                            <div className="filter-option-right">
                              <span className="filter-option-badge hot">Área Quente</span>
                              <div className="filter-option-check">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}

              {/* Opções Área Fria */}
              {meta.sectors.filter((s) => s.category === 'FRIA').length > 0 && (
                <>
                  <div className="filter-modal-section-title">
                    <Snowflake size={13} style={{ color: '#2b7bc4' }} />
                    <span>Área Fria (Climatizada NR-36 / Expedição)</span>
                  </div>
                  <div className="filter-options-grid">
                    {meta.sectors
                      .filter((s) => s.category === 'FRIA')
                      .map((sec) => {
                        const isSelected = sector === sec.id;
                        const lower = sec.name.toLowerCase();
                        const SecIcon = lower.includes('embalagem') ? Package
                          : (lower.includes('expedição') || lower.includes('expedicao')) ? Truck
                          : Snowflake;

                        return (
                          <div
                            key={sec.id}
                            className={`filter-option-card ${isSelected ? 'is-active' : ''}`}
                            onClick={() => {
                              setSector(sec.id);
                              setFilterModal(null);
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="filter-option-main">
                              <div className="filter-option-icon-box cold">
                                <SecIcon size={20} />
                              </div>
                              <div className="filter-option-text">
                                <strong>{sec.name}</strong>
                                <p>Cortes, desossa, embalagem e armazenagem refrigerada</p>
                              </div>
                            </div>
                            <div className="filter-option-right">
                              <span className="filter-option-badge cold">Área Fria</span>
                              <div className="filter-option-check">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>

            <footer className="filter-modal-footer">
              {sector !== 'all' ? (
                <button
                  type="button"
                  className="filter-modal-btn-clear"
                  onClick={() => {
                    setSector('all');
                    setFilterModal(null);
                  }}
                >
                  Limpar Filtro (Todos)
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {meta.sectors.length} setores disponíveis
                </span>
              )}
              <button
                type="button"
                className="filter-modal-btn-done"
                onClick={() => setFilterModal(null)}
              >
                Concluir
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DE SELEÇÃO DE PERÍODO
          ===================================================================== */}
      {filterModal === 'period' && (
        <div
          className="filter-modal-backdrop"
          onClick={() => setFilterModal(null)}
        >
          <div
            className="filter-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <header className="filter-modal-header">
              <div className="filter-modal-title-group">
                <div className="filter-modal-icon-badge period">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <h3>Filtrar por Período</h3>
                  <p>Defina o intervalo de tempo para análise dos indicadores operacionais</p>
                </div>
              </div>
              <button
                type="button"
                className="filter-modal-close-btn"
                onClick={() => setFilterModal(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="filter-modal-body">
              <div className="filter-options-grid">
                {PERIOD_OPTIONS.map((opt) => {
                  const isSelected = Number(days) === opt.days;
                  const IconComponent = opt.icon;

                  return (
                    <div
                      key={opt.days}
                      className={`filter-option-card ${isSelected ? 'is-active' : ''}`}
                      onClick={() => {
                        setDays(opt.days);
                        setFilterModal(null);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="filter-option-main">
                        <div className={`filter-option-icon-box ${opt.className}`}>
                          <IconComponent size={20} />
                        </div>
                        <div className="filter-option-text">
                          <strong>{opt.title}</strong>
                          <p>{opt.desc}</p>
                        </div>
                      </div>
                      <div className="filter-option-right">
                        <span className="filter-option-badge">{opt.badge}</span>
                        <div className="filter-option-check">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <footer className="filter-modal-footer">
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Período atual: <b>{days} dias</b>
              </span>
              <button
                type="button"
                className="filter-modal-btn-done"
                onClick={() => setFilterModal(null)}
              >
                Concluir
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
