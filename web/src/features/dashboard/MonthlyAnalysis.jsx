import {
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { LineChart } from '../../components/LineChart.jsx';
import { buildSectorRows } from './sector-utils.js';

const MONTH_OPTIONS = [
  {
    id: 'setembro',
    title: 'Setembro / 2026',
    badge: 'Mês Atual • Ao Vivo',
    desc: 'Ciclo mensal vigente com cruzamento determinístico e sinais em tempo real',
    icon: CalendarDays,
    className: 'period-30',
  },
  {
    id: 'agosto',
    title: 'Agosto / 2026',
    badge: 'Consolidado',
    desc: 'Histórico fechado com 92% de planos de ação preventivos concluídos',
    icon: Clock,
    className: 'period-7',
  },
  {
    id: 'julho',
    title: 'Julho / 2026',
    badge: 'Consolidado',
    desc: 'Fechamento operacional com redução de 15% em afastamentos no frigorífico',
    icon: Calendar,
    className: 'period-7',
  },
  {
    id: 'junho',
    title: 'Junho / 2026',
    badge: 'Fechamento Semestral',
    desc: 'Balanço consolidado do primeiro semestre de monitoramento da planta',
    icon: TrendingUp,
    className: 'period-90',
  },
];

export function MonthlyAnalysis({ auth }) {
  const [data, setData] = useState();
  const [planos, setPlanos] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('setembro');
  const [showMonthModal, setShowMonthModal] = useState(false);

  // Fecha modal com a tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowMonthModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    api('/api/dashboard?days=30', {}, auth.token).then(setData);
  }, [auth.token]);

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

  const currentMonthObj = MONTH_OPTIONS.find((m) => m.id === selectedMonth) || MONTH_OPTIONS[0];
  const ranked = buildSectorRows(data.sectorSummary).sort((a, b) => a.wellness - b.wellness);
  const hr = data.hr.reduce((total, item) => ({
    absences: total.absences + Number(item.absences),
    leaves: total.leaves + Number(item.leaves),
  }), { absences: 0, leaves: 0 });
  const responses = Math.round(data.series.reduce((sum, item) => sum + Number(item.responses), 0) / 3);
  const focus = ranked[0];

  return (
    <div className="content">
      <header className="page-head">
        <div>
          <span className="overline">ANÁLISE MENSAL INTEGRADA</span>
          <h1>Bem-estar + dados do RH</h1>
          <p>A IA cruza os sinais anônimos com faltas e afastamentos do período.</p>
        </div>

        <div className="filters-bar">
          <button
            type="button"
            className="filter-pill-btn"
            onClick={() => setShowMonthModal(true)}
            title="Filtrar por mês de referência"
          >
            <span className="filter-pill-label">Mês:</span>
            <span className="filter-pill-value">{currentMonthObj.title}</span>
            <ChevronDown size={14} className="filter-pill-chevron" />
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
          <span className="overline">EVOLUÇÃO DO MÊS</span>
          <h2>Indicadores e comportamento coletivo</h2>
          <LineChart series={data.series} />
        </article>

        <article className="card ai monthly-ai">
          <div className="ai-tag">
            <Sparkles /> CRUZAMENTO DA IA
          </div>
          <h2>{data.analysis.title}</h2>
          <p>{data.analysis.monthly}</p>

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
                <small>{row.category === 'QUENTE' ? 'Área Quente' : 'Área Fria'}</small>
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
        {planos.map((plano) => (
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

      {/* MODAL DE SELEÇÃO DE MÊS */}
      {showMonthModal && (
        <div
          className="filter-modal-backdrop"
          onClick={() => setShowMonthModal(false)}
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
                  <h3>Filtrar por Mês</h3>
                  <p>Selecione o mês de referência para a análise integrada de bem-estar e RH</p>
                </div>
              </div>
              <button
                type="button"
                className="filter-modal-close-btn"
                onClick={() => setShowMonthModal(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="filter-modal-body">
              <div className="filter-options-grid">
                {MONTH_OPTIONS.map((opt) => {
                  const isSelected = selectedMonth === opt.id;
                  const IconComponent = opt.icon;

                  return (
                    <div
                      key={opt.id}
                      className={`filter-option-card ${isSelected ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedMonth(opt.id);
                        setShowMonthModal(false);
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
                Mês de referência: <b>{currentMonthObj.title}</b>
              </span>
              <button
                type="button"
                className="filter-modal-btn-done"
                onClick={() => setShowMonthModal(false)}
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
