import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { buildSectorRows } from './sector-utils.js';

const STATUS_TONE = { VERDE: 'good', AMARELO: 'watch', VERMELHO: 'alert' };

const PERIOD_OPTIONS = [
  {
    days: 7,
    title: 'Últimos 7 dias',
    badge: 'Tático / Semanal',
    desc: 'Visão recente para avaliar oscilações rápidas nos turnos',
    icon: Clock,
    className: 'period-7',
  },
  {
    days: 30,
    title: 'Últimos 30 dias',
    badge: 'Padrão Recomendado',
    desc: 'Base recomendada para cruzar índices de atenção por setor',
    icon: CalendarDays,
    className: 'period-30',
  },
  {
    days: 90,
    title: 'Últimos 90 dias',
    badge: 'Trimestral / Histórico',
    desc: 'Tendência consolidada para planejamento estratégico',
    icon: TrendingUp,
    className: 'period-90',
  },
];

export function SectorIndicators({ auth }) {
  const [data, setData] = useState();
  const [meta, setMeta] = useState();
  const [indices, setIndices] = useState([]);
  const [days, setDays] = useState(30);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Fecha modal com a tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowPeriodModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    api(`/api/dashboard?days=${days}`, {}, auth.token).then(setData);
  }, [auth.token, days]);

  useEffect(() => {
    api('/api/meta', {}, auth.token).then(setMeta);
  }, [auth.token]);

  useEffect(() => {
    if (!meta?.currentShiftId) return;
    api(`/api/v1/supervisor/indices?turno=${meta.currentShiftId}`, {}, auth.token)
      .then((res) => setIndices(res.indices));
  }, [auth.token, meta]);

  if (!data || !meta) return <div className="loading">Carregando indicadores…</div>;

  const indiceBySector = Object.fromEntries(indices.map((row) => [row.setor_id, row]));
  const rows = buildSectorRows(data.sectorSummary)
    .map((row) => ({ ...row, indice: indiceBySector[row.id] }))
    .sort((a, b) => (a.indice?.score ?? 100) - (b.indice?.score ?? 100));

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <span className="overline">INDICADORES POR SETOR</span>
          <h1>Saúde das equipes</h1>
          <p>Comparativo dos últimos {days} dias por área e setor, ordenado por nível de atenção.</p>
        </div>

        <div className="filters-bar">
          <button
            type="button"
            className="filter-pill-btn"
            onClick={() => setShowPeriodModal(true)}
            title="Alterar período de análise"
          >
            <span className="filter-pill-label">Período:</span>
            <span className="filter-pill-value">{days} dias</span>
            <ChevronDown size={14} className="filter-pill-chevron" />
          </button>
        </div>
      </header>

      {['QUENTE', 'FRIA'].map((category) => (
        <section className="sector-report" key={category}>
          <header>
            <div>
              <span className={`area-mark ${category.toLowerCase()}`} />
              <div>
                <span className="overline">{category === 'QUENTE' ? 'ÁREA QUENTE' : 'ÁREA FRIA'}</span>
                <h2>{category === 'QUENTE' ? 'Processamento inicial' : 'Processamento e expedição'}</h2>
              </div>
            </div>
            <span>{rows.filter((row) => row.category === category).length} setores</span>
          </header>

          <div className="sector-table">
            <div className="sector-table-head">
              <span>Setor</span>
              <span>Energia</span>
              <span>Dor / cansaço</span>
              <span>Estresse</span>
              <span>Índice de atenção</span>
              <span>Amostra</span>
            </div>
            {rows.filter((row) => row.category === category).map((row) => (
              <div className="sector-table-row" key={row.id}>
                <strong>{row.name}</strong>
                <span>{row.ENERGY?.toFixed(1) || '—'}</span>
                <span>{row.PHYSICAL?.toFixed(1) || '—'}</span>
                <span>{row.STRESS?.toFixed(1) || '—'}</span>
                <span><b className={STATUS_TONE[row.indice?.status] || 'watch'}>{row.indice?.score ?? '—'}</b></span>
                <span>{row.indice ? `${row.indice.total_respostas} (${row.indice.confiabilidade.toLowerCase()})` : '—'}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* MODAL DE SELEÇÃO DE PERÍODO */}
      {showPeriodModal && (
        <div
          className="filter-modal-backdrop"
          onClick={() => setShowPeriodModal(false)}
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
                  <p>Defina o intervalo de tempo para análise dos indicadores por setor</p>
                </div>
              </div>
              <button
                type="button"
                className="filter-modal-close-btn"
                onClick={() => setShowPeriodModal(false)}
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
                        setShowPeriodModal(false);
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
                Período selecionado: <b>{days} dias</b>
              </span>
              <button
                type="button"
                className="filter-modal-btn-done"
                onClick={() => setShowPeriodModal(false)}
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
