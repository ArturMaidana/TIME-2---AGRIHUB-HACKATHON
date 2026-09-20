import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Factory,
  Flame,
  LogOut,
  Maximize,
  Minimize,
  Package,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';

const moods = [
  { emoji: '😣', score: 1, label: 'Péssimo' },
  { emoji: '😕', score: 2, label: 'Ruim' },
  { emoji: '😐', score: 3, label: 'Neutro' },
  { emoji: '🙂', score: 4, label: 'Bom' },
  { emoji: '😄', score: 5, label: 'Ótimo' },
];

const questions = [
  {
    key: 'ENERGY',
    title: 'Como está seu nível de energia hoje?',
    shortTitle: '2. Nível de Energia',
    low: 'Muito baixo',
    high: 'Muito alto',
  },
  {
    key: 'PHYSICAL',
    title: 'Como está seu nível de dor ou cansaço físico?',
    shortTitle: '3. Dor / Cansaço Físico',
    low: 'Nenhum',
    high: 'Muito intenso',
  },
  {
    key: 'STRESS',
    title: 'Como está seu nível de ansiedade ou estresse?',
    shortTitle: '4. Ansiedade / Estresse',
    low: 'Nenhum',
    high: 'Muito intenso',
  },
];

function getSectorIcon(sectorName = '', category = '') {
  const lower = sectorName.toLowerCase();
  if (lower.includes('embalagem')) return Package;
  if (lower.includes('expedição') || lower.includes('expedicao')) return Truck;
  if (category === 'QUENTE' || lower.includes('abate')) return Flame;
  if (category === 'FRIA') return Snowflake;
  return Factory;
}

export function Totem({ auth, onLogout }) {
  const [data, setData] = useState();
  const [sector, setSector] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sent, setSent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(orientation: portrait)').matches;
  });

  // Sincroniza estado de tela cheia com a API do navegador
  useEffect(() => {
    const onFullscreenChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  // Detecta mudança de orientação (vertical vs horizontal)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = (e) => setIsPortrait(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    api('/api/totem', {}, auth.token).then(setData);
  }, [auth.token]);

  const toggleFullscreen = () => {
    const docEl = document.documentElement;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (!fsEl) {
      if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
      else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  };

  async function submitResponses(targetSector, targetAnswers) {
    if (!targetSector || !targetAnswers.ENERGY || !targetAnswers.PHYSICAL || !targetAnswers.STRESS) return;
    await api('/api/totem/responses', {
      method: 'POST',
      body: JSON.stringify({
        sectorId: targetSector.id,
        answers: targetAnswers,
        idempotencyKey: crypto.randomUUID(),
      }),
    }, auth.token);
    setSent(true);
    setTimeout(() => {
      setSector(null);
      setStep(0);
      setAnswers({});
      setSent(false);
    }, 2200);
  }

  // Resposta em modo horizontal (um passo por vez)
  function answerStepHorizontal(score) {
    const next = { ...answers, [questions[step].key]: score };
    setAnswers(next);
    if (step < 2) {
      setStep(step + 1);
    } else {
      submitResponses(sector, next);
    }
  }

  if (!data) return <div className="loading">Preparando o totem…</div>;

  // Verifica se o formulário vertical está completo
  const isVerticalComplete = Boolean(
    sector && answers.ENERGY && answers.PHYSICAL && answers.STRESS
  );

  const answeredCount = (sector ? 1 : 0)
    + (answers.ENERGY ? 1 : 0)
    + (answers.PHYSICAL ? 1 : 0)
    + (answers.STRESS ? 1 : 0);

  return (
    <main className={`totem ${isFullscreen ? 'is-fullscreen' : ''} ${isPortrait ? 'is-portrait' : 'is-landscape'}`}>
      {/* Botão flutuante discreto para sair de tela cheia quando a topbar está oculta */}
      {isFullscreen && (
        <button
          type="button"
          className="totem-fs-floating"
          onClick={toggleFullscreen}
          title="Sair da Tela Cheia"
          aria-label="Sair da Tela Cheia"
        >
          <Minimize size={18} />
        </button>
      )}

      {/* Topbar verde com logo - OCULTADA em tela cheia como solicitado */}
      {!isFullscreen && (
        <header className="totem-header">
          <Brand />
          <div className="totem-header-meta">
            <div className="totem-shift-pill">
              <Clock3 size={15} />
              <span>{data.shift.name} • {data.shift.start_time}–{data.shift.end_time}</span>
            </div>

            <button
              type="button"
              className="totem-fs-btn"
              onClick={toggleFullscreen}
              title="Entrar em Tela Cheia (Modo Totem)"
            >
              <Maximize size={16} />
              <span>Tela Cheia</span>
            </button>

            <button
              type="button"
              className="totem-logout-btn"
              onClick={onLogout}
              title="Encerrar Sessão do Totem"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
      )}

      {/* TELA DE SUCESSO / AGRADECIMENTO */}
      {sent ? (
        <section className="thanks">
          <span className="thanks-icon-box">
            <Check size={48} strokeWidth={3} />
          </span>
          <h1>Obrigado por responder!</h1>
          <p>Suas respostas foram registradas de forma 100% anônima e somadas ao pulso do setor.</p>
        </section>
      ) : isPortrait ? (
        /* =====================================================================
           MODO VERTICAL: TODOS OS PASSOS NA MESMA TELA
           ===================================================================== */
        <div className="totem-vertical-scroll">
          <div className="totem-vertical-header-title">
            <span className="step">CHECK-IN DE BEM-ESTAR • TOTEM INDUSTRIAL</span>
            <h1>Pulso do Turno</h1>
            <p>Selecione seu setor e avalie seus indicadores. Resposta 100% anônima.</p>
          </div>

          {/* 1. SELEÇÃO DE SETOR */}
          <section className="totem-section-box">
            <div className="totem-section-header">
              <h3>
                <Factory size={20} className="totem-section-icon" />
                1. Em qual setor você trabalha?
              </h3>
              <span className={`totem-section-badge ${sector ? 'done' : ''}`}>
                {sector ? sector.name : 'Pendente'}
              </span>
            </div>

            <div className="totem-sector-groups">
              {['QUENTE', 'FRIA'].map((category) => {
                const categorySectors = data.sectors.filter((item) => item.category === category);
                if (!categorySectors.length) return null;

                return (
                  <div key={category} className="totem-category-block">
                    <div className="totem-category-label">
                      {category === 'QUENTE' ? (
                        <>
                          <Flame size={14} style={{ color: '#d96324' }} />
                          <span>Área Quente (Processamento Inicial)</span>
                        </>
                      ) : (
                        <>
                          <Snowflake size={14} style={{ color: '#2b7bc4' }} />
                          <span>Área Fria (Climatizada NR-36 / Expedição)</span>
                        </>
                      )}
                    </div>

                    <div className="totem-sector-grid">
                      {categorySectors.map((item) => {
                        const isSelected = sector?.id === item.id;
                        const SecIcon = getSectorIcon(item.name, item.category);

                        return (
                          <div
                            key={item.id}
                            className={`totem-sector-card ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => setSector(item)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="totem-sector-main">
                              <div className={`totem-sector-icon-box ${item.category === 'QUENTE' ? 'hot' : 'cold'}`}>
                                <SecIcon size={22} />
                              </div>
                              <div className="totem-sector-info">
                                <strong>{item.name}</strong>
                                <span className={item.category === 'QUENTE' ? 'hot' : 'cold'}>
                                  {item.category === 'QUENTE' ? 'Área Quente' : 'Área Fria'}
                                </span>
                              </div>
                            </div>

                            <div className="totem-sector-check">
                              <Check size={16} strokeWidth={3} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2, 3, 4. PERGUNTAS DE INDICADORES */}
          {questions.map((q) => {
            const currentScore = answers[q.key];

            return (
              <section className="totem-section-box" key={q.key}>
                <div className="totem-section-header">
                  <div>
                    <h3>{q.shortTitle}</h3>
                    <p className="totem-section-subtitle">{q.title}</p>
                  </div>
                  <span className={`totem-section-badge ${currentScore ? 'done' : ''}`}>
                    {currentScore ? `${currentScore}/5` : 'Pendente'}
                  </span>
                </div>

                <div className="moods moods-vertical">
                  {moods.map((m) => {
                    const isSelected = currentScore === m.score;

                    return (
                      <button
                        type="button"
                        key={m.score}
                        className={`mood-btn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: m.score }))}
                      >
                        <span className="mood-emoji">{m.emoji}</span>
                        <b className="mood-score">{m.score}</b>
                        <small className="mood-label">{m.label}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* 5. CONFIRMAÇÃO */}
          <div className="totem-confirm-bar">
            <small className="totem-progress-note">
              {isVerticalComplete ? (
                <span><Sparkles size={14} style={{ display: 'inline', marginRight: 4 }} /> Tudo pronto para enviar seu check-in anônimo!</span>
              ) : (
                `Preencha todas as 4 etapas acima (${answeredCount} de 4 prontas)`
              )}
            </small>

            <button
              type="button"
              className="totem-confirm-btn"
              disabled={!isVerticalComplete}
              onClick={() => submitResponses(sector, answers)}
            >
              <CheckCircle2 size={22} />
              <span>Confirmar Check-in</span>
            </button>

            <small className="totem-anon-notice">
              <ShieldCheck size={14} /> Pesquisa 100% anônima • Nenhuma identificação pessoal é registrada
            </small>
          </div>
        </div>
      ) : (
        /* =====================================================================
           MODO HORIZONTAL: UM PASSO POR VEZ (WIZARD)
           ===================================================================== */
        !sector ? (
          /* Passo 1 Horizontal: Selecionar Setor */
          <section className="totem-body">
            <span className="step">PASSO 1 DE 4 • SELEÇÃO DE SETOR</span>
            <h1>Em qual setor você trabalha?</h1>
            <p>Toque no seu setor para começar. Check-in 100% anônimo.</p>

            <div className="totem-sector-groups horizontal">
              {['QUENTE', 'FRIA'].map((category) => {
                const categorySectors = data.sectors.filter((item) => item.category === category);
                if (!categorySectors.length) return null;

                return (
                  <div key={category} className="totem-category-block">
                    <div className="totem-category-label">
                      {category === 'QUENTE' ? (
                        <>
                          <Flame size={14} style={{ color: '#d96324' }} />
                          <span>Área Quente</span>
                        </>
                      ) : (
                        <>
                          <Snowflake size={14} style={{ color: '#2b7bc4' }} />
                          <span>Área Fria</span>
                        </>
                      )}
                    </div>

                    <div className="totem-sector-grid">
                      {categorySectors.map((item) => {
                        const SecIcon = getSectorIcon(item.name, item.category);

                        return (
                          <div
                            key={item.id}
                            className="totem-sector-card"
                            onClick={() => {
                              setSector(item);
                              setStep(0);
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="totem-sector-main">
                              <div className={`totem-sector-icon-box ${item.category === 'QUENTE' ? 'hot' : 'cold'}`}>
                                <SecIcon size={22} />
                              </div>
                              <div className="totem-sector-info">
                                <strong>{item.name}</strong>
                                <span className={item.category === 'QUENTE' ? 'hot' : 'cold'}>
                                  {item.category === 'QUENTE' ? 'Área Quente' : 'Área Fria'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={18} className="totem-sector-chevron" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <small className="totem-anon-notice">
              <ShieldCheck size={14} /> Pesquisa 100% anônima • Nenhuma identificação pessoal é coletada
            </small>
          </section>
        ) : (
          /* Passos 2, 3, 4 Horizontal: Indicadores um por vez */
          <section className="totem-body">
            <div className="totem-wizard-nav">
              <span className="step">
                PERGUNTA {step + 1} DE 3 • {sector.name}
              </span>
            </div>

            <div className="question-dots">
              <i className={step >= 0 ? 'on' : ''} />
              <i className={step >= 1 ? 'on' : ''} />
              <i className={step >= 2 ? 'on' : ''} />
            </div>

            <h1>{questions[step].title}</h1>
            <p>Toque na opção que melhor representa você agora.</p>

            <div className="moods">
              {moods.map((m) => (
                <button
                  type="button"
                  key={m.score}
                  className="mood-btn"
                  onClick={() => answerStepHorizontal(m.score)}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <b className="mood-score">{m.score}</b>
                  <small className="mood-label">
                    {m.score === 1 ? questions[step].low : m.score === 5 ? questions[step].high : m.label}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )
      )}

      {/* Footer do Totem (apenas quando não em tela cheia) */}
      {!isFullscreen && (
        <footer>
          Totem: {auth.name}
          <span>O turno é identificado automaticamente pelo horário</span>
        </footer>
      )}
    </main>
  );
}
