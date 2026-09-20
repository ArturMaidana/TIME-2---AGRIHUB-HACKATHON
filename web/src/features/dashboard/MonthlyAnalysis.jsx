import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Download,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LineChart } from '../../components/LineChart.jsx';
import { buildSectorRows } from './sector-utils.js';
import { downloadCsv, rowsToCsv } from '../../utils/csv.js';

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

export function MonthlyAnalysis({ auth }) {
  const [data, setData] = useState();
  const [planos, setPlanos] = useState([]);
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
    api('/api/v1/supervisor/analises?periodicidade=mensal', {}, auth.token)
      .then(() => api('/api/v1/supervisor/planos-acao', {}, auth.token))
      .then((res) => setPlanos(res.planos));
  }, [auth.token]);

  async function atualizarStatus(planoId, status) {
    await api(`/api/v1/supervisor/planos-acao/${planoId}`, { method: 'PATCH', body: JSON.stringify({ status }) }, auth.token);
    setPlanos((current) => current.map((plano) => (plano.id === planoId ? { ...plano, status } : plano)));
  }

  if (!data) return <div className="loading">Cruzando dados mensais…</div>;

  const currentPeriodObj = PERIOD_OPTIONS.find((p) => p.days === days) || PERIOD_OPTIONS[1];
  const ranked = buildSectorRows(data.sectorSummary).sort((a, b) => a.wellness - b.wellness);
  const hr = data.hr.reduce((total, item) => ({
    absences: total.absences + Number(item.absences),
    leaves: total.leaves + Number(item.leaves),
  }), { absences: 0, leaves: 0 });
  const responses = Math.round(data.series.reduce((sum, item) => sum + Number(item.responses), 0) / 3);
  const focus = ranked[0];

  function exportCsv() {
    const rows = [
      [`BEM-ESTAR POR SETOR (últimos ${days} dias)`],
      ['Setor', 'Categoria', 'Energia (1-5)', 'Dor/Cansaço (1-5)', 'Estresse (1-5)', 'Índice de Bem-estar (1-5)', 'Respostas anônimas'],
      ...ranked.map((row) => [
        row.name,
        row.category === 'QUENTE' ? 'Área Quente' : 'Área Fria',
        row.ENERGY?.toFixed(2) ?? '',
        row.PHYSICAL?.toFixed(2) ?? '',
        row.STRESS?.toFixed(2) ?? '',
        row.wellness.toFixed(2),
        row.responses,
      ]),
      [],
      ['INDICADORES ESTRATÉGICOS DE GESTÃO DE PESSOAS'],
      ['Setor', 'Turno', 'Período', 'Faltas', 'Afastamentos'],
      ...data.hr.map((item) => [item.sector, item.shift, item.period, item.absences, item.leaves]),
    ];

    downloadCsv(`bem-estar-indicadores-rh-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(rows));
  }

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <span className="overline">ANÁLISE MENSAL INTEGRADA</span>
          <h1>Bem-estar + indicadores estratégicos de Gestão de pessoas</h1>
          <p>A IA cruza os sinais anônimos com faltas e afastamentos do período.</p>
        </div>

        <div className="filters-bar">
          <button
            type="button"
            className="filter-pill-btn"
            onClick={() => setShowPeriodModal(true)}
            title="Filtrar por período de análise"
          >
            <span className="filter-pill-label">Período:</span>
            <span className="filter-pill-value">{currentPeriodObj.title}</span>
            <ChevronDown size={14} className="filter-pill-chevron" />
          </button>

          <button
            type="button"
            className="filter-pill-btn"
            onClick={exportCsv}
            title="Exportar os dados desta análise em CSV"
          >
            <Download size={14} />
            <span className="filter-pill-label">Exportar CSV</span>
          </button>
        </div>
      </header>

      <section className="monthly-summary">
        <article>
          <small>Respostas anônimas</small>
          <strong>{responses}</strong>
          <p>Base usada pela análise</p>
        </article>
        <article>
          <small>Faltas registradas</small>
          <strong>{hr.absences}</strong>
          <p>Dados agregados do RH</p>
        </article>
        <article>
          <small>Afastamentos</small>
          <strong>{hr.leaves}</strong>
          <p>Sem dados clínicos</p>
        </article>
        <article className="focus">
          <small>Setor prioritário</small>
          <strong>{focus?.name || '—'}</strong>
          <p>Menor índice no período</p>
        </article>
      </section>

      <section className="monthly-layout">
        <article className="card chart-card">
          <span className="overline">EVOLUÇÃO DO PERÍODO</span>
          <h2>Indicadores e comportamento coletivo</h2>
          <LineChart series={data.series} />
        </article>

        <article className="card ai monthly-ai">
          <div className="ai-tag">
            <Sparkles /> CRUZAMENTO DA IA
          </div>
          <h2>{data.analysis.title}</h2>
          <p>{data.analysis.monthly}</p>
          {data.analysis.poweredByAI && (
            <small className="ai-powered-badge">✨ Resumo gerado por IA (Groq)</small>
          )}

          <div className="correlation">
            <span>1</span>
            <div>
              <strong>Sinal observado</strong>
              <p>Dor e cansaço apresentaram piora no período.</p>
            </div>
          </div>
          <div className="correlation">
            <span>2</span>
            <div>
              <strong>Dado relacionado</strong>
              <p>Faltas aumentaram nos setores com menor índice.</p>
            </div>
          </div>
          <div className="correlation">
            <span>3</span>
            <div>
              <strong>Ação sugerida</strong>
              <p>Priorizar escuta e revisão de pausas em {focus?.name || 'setores críticos'}.</p>
            </div>
          </div>
          <small>Associação estatística simulada. Não representa causalidade ou diagnóstico.</small>
        </article>
      </section>

      <section className="card ranking">
        <header>
          <div>
            <span className="overline">PRIORIZAÇÃO</span>
            <h2>Setores que exigem acompanhamento</h2>
          </div>
        </header>
        <div>
          {ranked.slice(0, 5).map((row, index) => (
            <article key={row.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{row.name}</strong>
                <small> - {row.category === 'QUENTE' ? 'Área Quente' : 'Área Fria'}</small>
              </div>
              <b>{row.wellness.toFixed(1)}/5</b>
              <i><span style={{ width: `${row.wellness * 20}%` }} /></i>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <header>
          <div>
            <span className="overline">PLANOS DE AÇÃO</span>
            <h2>Sugeridos pela análise determinística</h2>
          </div>
        </header>
        {planos.length === 0 && <p>Nenhum plano gerado ainda.</p>}
        {planos.slice(0, 5).map((plano) => (
          <div className="plan-item" key={plano.id}>
            <div>
              <strong>{plano.setor_nome} - {plano.turno_nome}</strong>
              <ul>
                {plano.acoes.map((acao) => (
                  <li key={acao.id}>{acao.descricao}</li>
                ))}
              </ul>
            </div>
            <select
              value={plano.status}
              onChange={(event) => atualizarStatus(plano.id, event.target.value)}
            >
              <option value="PENDENTE">Pendente</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="DESCARTADO">Descartado</option>
            </select>
          </div>
        ))}
      </section>

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
                  <p>Selecione a janela de dias usada na análise integrada de bem-estar e RH</p>
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
                  const isSelected = days === opt.days;
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
                Período: <b>{currentPeriodObj.title}</b>
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
