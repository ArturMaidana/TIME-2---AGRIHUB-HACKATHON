import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  DoorOpen,
  Factory,
  Flame,
  Info,
  MapPin,
  Package,
  Radio,
  ShieldCheck,
  Snowflake,
  Timer,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Metric } from '../../components/Metric.jsx';

// Lista de nomes e dados simulados realistas para a planta industrial
const BASE_NAMES = [
  'Ana Costa', 'Rafael Souza', 'Marta Lima', 'João Prado', 'Bruno Faria',
  'Carla Mendes', 'Diego Farias', 'Lia Santos', 'Gustavo Reis', 'Paula Nunes',
  'Edu Viana', 'Téo Barros', 'Henrique Cruz', 'Iara Alves', 'Miguel Dias',
  'Renata Alves', 'Carlos Eduardo', 'Juliana Ramos', 'Felipe Castro', 'Camila Rocha'
];

const ROLES = [
  'Operador de Desossa II', 'Magarefe Especialista', 'Operador de Embalagem',
  'Auxiliar de Produção', 'Operador de Máquinas', 'Inspetor de Qualidade',
  'Operador de Cortes', 'Controlador de Fluxo'
];

function getInitials(name) {
  const parts = name.split(' ');
  return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2).toUpperCase();
}

function generateSectorTeam(sectorId, sectorName, count = 16) {
  return BASE_NAMES.slice(0, count).map((name, index) => {
    const isOut = index >= count - 2;
    // Horário de entrada escalonado
    const entryMinOffset = (index * 3) % 25;
    const entryTotalMin = 6 * 60 + entryMinOffset;
    const entryH = String(Math.floor(entryTotalMin / 60)).padStart(2, '0');
    const entryM = String(entryTotalMin % 60).padStart(2, '0');
    const entryTime = `${entryH}:${entryM}`;

    // Tempo decorrido no setor
    const hoursIn = isOut ? 0 : 3 + Math.floor(index / 7);
    const minsIn = isOut ? 0 : (index * 8) % 60;
    const duration = isOut ? '0 min' : `${hoursIn}h ${String(minsIn).padStart(2, '0')}min`;

    const isCold = sectorName.toLowerCase().includes('desossa')
      || sectorName.toLowerCase().includes('embalagem')
      || sectorName.toLowerCase().includes('fria');

    return {
      id: `${sectorId}-${index + 1}`,
      matricula: `#${2040 + index * 17}`,
      name,
      initials: getInitials(name),
      role: ROLES[index % ROLES.length],
      present: !isOut,
      entryTime,
      duration,
      nr36Pausas: isOut ? '1 de 3 (Em pausa)' : '2 de 3 realizadas',
      catraca: `Catraca ${((index % 3) + 1).toString().padStart(2, '0')} • Ponto de Acesso`,
      temperatura: isCold ? '10°C (Sala Climatizada NR-36)' : '18°C (Área Geral)',
      proximaPausa: isOut ? 'Retorno em 10 min' : 'Em 35 min',
    };
  });
}

export function SectorPresence({ auth }) {
  const [meta, setMeta] = useState();
  const [activeSectorId, setActiveSectorId] = useState('s1');
  const [teamsBySector, setTeamsBySector] = useState({});
  const [currentTime, setCurrentTime] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showSectorModal, setShowSectorModal] = useState(false);

  // Fecha modais com a tecla Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowSectorModal(false);
        setSelectedPerson(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Carrega setores da API
  useEffect(() => {
    api('/api/meta', {}, auth.token).then((data) => {
      setMeta(data);
      if (data.sectors?.length) {
        const initialTeams = {};
        data.sectors.forEach((sec, idx) => {
          const count = idx === 0 ? 16 : idx === 1 ? 12 : idx === 2 ? 10 : 8;
          initialTeams[sec.id] = generateSectorTeam(sec.id, sec.name, count);
        });
        setTeamsBySector(initialTeams);
        setActiveSectorId(data.sectors[0].id);
      }
    });
  }, [auth.token]);

  // Relógio ao vivo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!meta || !meta.sectors?.length) {
    return <div className="loading">Carregando controle de presença…</div>;
  }

  const sectors = meta.sectors;
  const activeSector = sectors.find((s) => s.id === activeSectorId) || sectors[0];
  const currentTeam = teamsBySector[activeSector.id] || [];

  const presentCount = currentTeam.filter((p) => p.present).length;
  const outCount = currentTeam.filter((p) => !p.present).length;
  const totalCount = currentTeam.length;

  return (
    <div className="content presence-content">
      {/* Top Header unificado com o padrão do sistema */}
      <header className="page-head">
        <div className="page-title-group">
          <div className="page-title-text">
            <span className="overline">CONTROLE DE ACESSO & FLUXO</span>
            <h1>Presença em Tempo Real</h1>
            <p>Monitoramento de colaboradores e tempo de permanência nos setores frigoríficos</p>
          </div>
        </div>

        <div className="filters-bar">
          <div className="alert-pill-btn" title="Status dos leitores biométricos">
            <Radio size={13} className="pulse-radio" />
            <span>Ao vivo {currentTime}</span>
            <ArrowUpRight size={14} />
          </div>

          {/* Botão Interativo: Filtro de Setor */}
          <button
            type="button"
            className="filter-pill-btn"
            onClick={() => setShowSectorModal(true)}
            title="Clique para selecionar o setor"
          >
            <span className="filter-pill-label">Setor:</span>
            <span className="filter-pill-value">{activeSector.name}</span>
            <ChevronDown size={14} className="filter-pill-chevron" />
          </button>
        </div>
      </header>

      {/* Linha de Métricas Unificadas (Estilo Greenhouse Monitoring) */}
      <section className="metrics">
        <Metric
          icon={Users}
          label="PRESENTES NO SETOR"
          value={`${presentCount} / ${totalCount}`}
          note="Colaboradores ativos no setor neste momento"
          tone="green"
          highlight
          badge="Dentro do setor"
        />
        <Metric
          icon={DoorOpen}
          label="FORA DO SETOR"
          value={outCount}
          note="Em pausa térmica NR-36 ou refeitório"
          tone="orange"
          badge="Pausa NR-36"
        />
        <Metric
          icon={Timer}
          label="TEMPO MÉDIO DE SALA"
          value="3h 42min"
          note="Permanência contínua dentro da sala climatizada"
          tone="blue"
          badge="Conforme"
        />
        <Metric
          icon={ShieldCheck}
          label="ESCALA DO TURNO"
          value={totalCount}
          note="Colaboradores escalados para o turno"
          tone="dark"
          badge="100% Escala"
        />
      </section>

      {/* Card Principal: Equipe no Setor */}
      <article className="card presence-team-card-unified">
        <header className="card-header-prototype">
          <div>
            <span className="overline">
              <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
              {activeSector.name.toUpperCase()} • BLOCO B
            </span>
            <h2>Equipe no setor</h2>
            <p className="card-subtitle-note">
              Clique em um colaborador para abrir os detalhes de entrada e tempo de permanência.
            </p>
          </div>
          <div className="card-header-meta">
            <span className="presence-counter-badge">
              {presentCount} presentes • {outCount} em pausa
            </span>
            <ArrowUpRight size={18} className="card-arrow" />
          </div>
        </header>

        <div className="presence-collaborators-grid">
          {currentTeam.map((person) => (
            <div
              key={person.id}
              className={`collaborator-card-unified ${person.present ? 'is-inside' : 'is-outside'}`}
              onClick={() => setSelectedPerson(person)}
              role="button"
              tabIndex={0}
              title={`Clique para ver detalhes de ${person.name}`}
            >
              <div className="collaborator-avatar">
                <img
                  src="/funciononario.png"
                  alt={person.name}
                  className={`collaborator-avatar-img ${person.present ? 'img-present' : 'img-out'}`}
                />
              </div>

              <div className="collaborator-info">
                <strong className="collaborator-name">{person.name}</strong>
                <span className="collaborator-role">{person.role}</span>
              </div>

              <div className="collaborator-meta-row">
                <span className="collaborator-time-tag">
                  <Clock size={11} />
                  {person.present ? person.duration : 'Fora'}
                </span>
                <span className={`collaborator-status-pill ${person.present ? 'pill-green' : 'pill-gray'}`}>
                  {person.present ? 'Presente' : 'Em pausa'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Card Secundário: Outros Setores da Fábrica */}
      <article className="card other-sectors-card-unified">
        <header className="card-header-prototype">
          <div>
            <span className="overline">VISÃO GERAL DA PLANTA</span>
            <h2>Outros setores da fábrica</h2>
          </div>
          <div className="card-header-meta">
            <span>{sectors.length} setores monitorados</span>
          </div>
        </header>

        <div className="other-sectors-unified-grid">
          {sectors.map((sec) => {
            const team = teamsBySector[sec.id] || [];
            const pCount = team.filter((p) => p.present).length;
            const tCount = team.length;
            const isSelected = sec.id === activeSector.id;

            return (
              <div
                key={sec.id}
                className={`other-sector-btn-card ${isSelected ? 'is-active-sector' : ''}`}
                onClick={() => setActiveSectorId(sec.id)}
                role="button"
                tabIndex={0}
              >
                <div className="other-sector-top-row">
                  <span className="other-sec-dot" />
                  <strong>{sec.name}</strong>
                </div>
                <div className="other-sec-bottom-row">
                  <span className="other-sec-presence-val">
                    <b>{pCount}</b> de {tCount} presentes
                  </span>
                  <span className="other-sec-pct">
                    {tCount > 0 ? Math.round((pCount / tCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {/* MODAL DE DETALHES DO COLABORADOR */}
      {selectedPerson && (
        <div
          className="presence-modal-backdrop"
          onClick={() => setSelectedPerson(null)}
        >
          <div
            className="presence-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="modal-top-row">
              <div className="modal-person-header">
                <div className="modal-avatar">
                  <img
                    src="/funciononario.png"
                    alt={selectedPerson.name}
                    className="modal-avatar-img"
                  />
                </div>
                <div>
                  <h3>{selectedPerson.name}</h3>
                  <p>{selectedPerson.role} • {selectedPerson.matricula}</p>
                </div>
              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedPerson(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Status Pill */}
            <div className="modal-status-banner">
              <span className={`modal-status-badge ${selectedPerson.present ? 'badge-green' : 'badge-gray'}`}>
                {selectedPerson.present ? (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Presente no setor no momento</span>
                  </>
                ) : (
                  <>
                    <DoorOpen size={15} />
                    <span>Fora do setor (Pausa térmica NR-36)</span>
                  </>
                )}
              </span>
            </div>

            {/* Grid com detalhes de tempo e permanência */}
            <div className="modal-details-grid">
              <div className="modal-detail-item">
                <div className="detail-icon-box">
                  <Clock size={18} />
                </div>
                <div>
                  <small>Hora de Entrada</small>
                  <strong>{selectedPerson.entryTime}</strong>
                </div>
              </div>

              <div className="modal-detail-item">
                <div className="detail-icon-box">
                  <Timer size={18} />
                </div>
                <div>
                  <small>Tempo no Setor</small>
                  <strong>{selectedPerson.duration}</strong>
                </div>
              </div>

              <div className="modal-detail-item">
                <div className="detail-icon-box">
                  <Coffee size={18} />
                </div>
                <div>
                  <small>Pausas NR-36</small>
                  <strong>{selectedPerson.nr36Pausas}</strong>
                </div>
              </div>

              <div className="modal-detail-item">
                <div className="detail-icon-box">
                  <MapPin size={18} />
                </div>
                <div>
                  <small>Ponto de Acesso</small>
                  <strong>{selectedPerson.catraca}</strong>
                </div>
              </div>
            </div>

            {/* Informação sobre NR-36 e ambiente */}
            <div className="modal-info-box">
              <Info size={16} />
              <p>
                <strong>Ambiente:</strong> {selectedPerson.temperatura}.
                {selectedPerson.present
                  ? ` Próxima pausa térmica recomendada: ${selectedPerson.proximaPausa}.`
                  : ' Colaborador em intervalo regulamentar.'}
              </p>
            </div>

            {/* Footer do Modal */}
            <div className="modal-footer">
              <button
                type="button"
                className="primary modal-action-btn"
                onClick={() => setSelectedPerson(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE SELEÇÃO DE SETOR */}
      {showSectorModal && (
        <div
          className="filter-modal-backdrop"
          onClick={() => setShowSectorModal(false)}
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
                  <h3>Selecionar Setor</h3>
                  <p>Escolha o setor frigorífico para acompanhar a equipe e fluxo de saída em tempo real</p>
                </div>
              </div>
              <button
                type="button"
                className="filter-modal-close-btn"
                onClick={() => setShowSectorModal(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="filter-modal-body">
              {/* Área Quente */}
              {sectors.filter((s) => s.category === 'QUENTE').length > 0 && (
                <>
                  <div className="filter-modal-section-title">
                    <Flame size={13} style={{ color: '#d96324' }} />
                    <span>Área Quente (Processamento Inicial)</span>
                  </div>
                  <div className="filter-options-grid">
                    {sectors
                      .filter((s) => s.category === 'QUENTE')
                      .map((sec) => {
                        const isSelected = activeSectorId === sec.id;
                        const team = teamsBySector[sec.id] || [];
                        const pCount = team.filter((p) => p.present).length;
                        const tCount = team.length;

                        return (
                          <div
                            key={sec.id}
                            className={`filter-option-card ${isSelected ? 'is-active' : ''}`}
                            onClick={() => {
                              setActiveSectorId(sec.id);
                              setShowSectorModal(false);
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
                                <p><b>{pCount}</b> de {tCount} colaboradores presentes</p>
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

              {/* Área Fria */}
              {sectors.filter((s) => s.category === 'FRIA').length > 0 && (
                <>
                  <div className="filter-modal-section-title">
                    <Snowflake size={13} style={{ color: '#2b7bc4' }} />
                    <span>Área Fria (Climatizada NR-36 / Expedição)</span>
                  </div>
                  <div className="filter-options-grid">
                    {sectors
                      .filter((s) => s.category === 'FRIA')
                      .map((sec) => {
                        const isSelected = activeSectorId === sec.id;
                        const team = teamsBySector[sec.id] || [];
                        const pCount = team.filter((p) => p.present).length;
                        const tCount = team.length;
                        const lower = sec.name.toLowerCase();
                        const SecIcon = lower.includes('embalagem') ? Package
                          : (lower.includes('expedição') || lower.includes('expedicao')) ? Truck
                          : Snowflake;

                        return (
                          <div
                            key={sec.id}
                            className={`filter-option-card ${isSelected ? 'is-active' : ''}`}
                            onClick={() => {
                              setActiveSectorId(sec.id);
                              setShowSectorModal(false);
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
                                <p><b>{pCount}</b> de {tCount} colaboradores presentes</p>
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
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Setor selecionado: <b>{activeSector.name}</b>
              </span>
              <button
                type="button"
                className="filter-modal-btn-done"
                onClick={() => setShowSectorModal(false)}
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
