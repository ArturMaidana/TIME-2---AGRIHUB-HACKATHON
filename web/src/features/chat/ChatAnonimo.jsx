import {
  Check, CheckCircle2, ChevronLeft, LogOut, MessageSquareText, Send, ShieldCheck, Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';
import { getSectorIcon, groupSectorsForDisplay } from '../../utils/sector-groups.js';

const STATUS_LABEL = {
  ABERTO: 'Aberto', EM_ANALISE: 'Em análise', TRATADO: 'Tratado', DESCARTADO: 'Descartado',
};
const STATUS_TONE = {
  ABERTO: 'watch', EM_ANALISE: 'watch', TRATADO: 'good', DESCARTADO: 'alert',
};

export function ChatAnonimo({ auth, onLogout }) {
  const [contexto, setContexto] = useState();
  const [mensagens, setMensagens] = useState();
  const [view, setView] = useState('list');
  const [setor, setSetor] = useState(null);
  const [tipo, setTipo] = useState('RECLAMACAO');
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api('/api/chat/contexto', {}, auth.token).then(setContexto); }, [auth.token]);

  function reloadMensagens() {
    return api('/api/chat/mensagens', {}, auth.token).then((res) => setMensagens(res.mensagens));
  }
  useEffect(() => { reloadMensagens(); }, [auth.token]);

  function startNova() {
    setSetor(null);
    setTipo('RECLAMACAO');
    setTexto('');
    setError('');
    setView('form');
  }

  async function enviar() {
    if (!setor || !texto.trim()) return;
    setSending(true);
    setError('');
    try {
      await api('/api/chat/mensagens', {
        method: 'POST',
        body: JSON.stringify({ setorId: setor.id, tipo, mensagem: texto.trim() }),
      }, auth.token);
      setSent(true);
      await reloadMensagens();
      setTimeout(() => { setSent(false); setView('list'); }, 1800);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar agora, tente de novo.');
    } finally {
      setSending(false);
    }
  }

  if (!contexto || !mensagens) return <div className="loading">Preparando o portal…</div>;

  return (
    <main className="totem chat-anon">
      <header className="totem-header">
        <Brand />
        <div className="totem-header-meta">
          <div className="chat-code-badge" title="Seu código anônimo — anote para acessar depois">
            <ShieldCheck size={15} /> <span>{auth.code}</span>
          </div>
          <button type="button" className="totem-logout-btn" onClick={onLogout} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {sent ? (
        <section className="thanks">
          <span className="thanks-icon-box"><CheckCircle2 size={48} strokeWidth={3} /></span>
          <h1>Enviado!</h1>
          <p>Sua mensagem chegou de forma anônima ao supervisor do setor. Volte quando quiser com o código
            <strong> {auth.code} </strong> para ver a resposta.</p>
        </section>
      ) : view === 'form' ? (
        <section className="totem-body chat-form-body">
          <button type="button" className="chat-back-btn" onClick={() => setView('list')}>
            <ChevronLeft size={16} /> Voltar
          </button>
          <span className="step">NOVA MENSAGEM</span>
          <h1>Em qual setor você trabalha?</h1>
          <p>A mensagem cai direto na notificação do supervisor responsável por esse setor.</p>

          <div className="totem-sector-groups horizontal">
            {groupSectorsForDisplay(contexto.sectors).map((group) => {
              const GroupIcon = group.icon;
              const tone = group.key === 'QUENTE' ? 'hot' : group.key === 'FRIA' ? 'cold' : 'admin';
              return (
                <div key={group.key} className="totem-category-block">
                  <div className="totem-category-label">
                    <GroupIcon size={14} style={{ color: group.color }} />
                    <span>{group.label}</span>
                  </div>
                  <div className="totem-sector-grid">
                    {group.items.map((item) => {
                      const SecIcon = getSectorIcon(item.name, item.category);
                      const isSelected = setor?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`totem-sector-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSetor(item)}
                        >
                          <div className="totem-sector-main">
                            <div className={`totem-sector-icon-box ${tone}`}>
                              <SecIcon size={20} />
                            </div>
                            <div className="totem-sector-info"><strong>{item.name}</strong></div>
                          </div>
                          <div className="totem-sector-check">
                            <Check size={16} strokeWidth={3} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <small className="chat-privacy-note">
            <Users size={14} /> Sua mensagem é associada só ao setor e turno, nunca a você — isso garante
            anonimato de verdade quando o setor/turno tem mais de 5 pessoas. Em equipes bem pequenas, poucas
            respostas podem tornar mais fácil adivinhar quem enviou.
          </small>

          {setor && (
            <div className="chat-compose">
              <div className="chat-type-toggle">
                <button type="button" className={tipo === 'RECLAMACAO' ? 'on' : ''} onClick={() => setTipo('RECLAMACAO')}>
                  Reclamação
                </button>
                <button type="button" className={tipo === 'SUGESTAO' ? 'on' : ''} onClick={() => setTipo('SUGESTAO')}>
                  Sugestão
                </button>
              </div>
              <div className="chat-textarea-wrap">
                <textarea
                  className="chat-textarea"
                  maxLength={2000}
                  rows={5}
                  placeholder="Escreva aqui, com calma. Ninguém saberá quem enviou."
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                />
                <small className="chat-char-count">{texto.length}/2000</small>
              </div>
              {error && <div className="error">{error}</div>}
              <button type="button" className="primary" disabled={sending || !texto.trim()} onClick={enviar}>
                <Send size={16} /> {sending ? 'Enviando…' : 'Enviar anonimamente'}
              </button>
            </div>
          )}

          <small className="totem-anon-notice">
            <ShieldCheck size={14} /> Nenhuma identificação pessoal é coletada — só o código {auth.code}
          </small>
        </section>
      ) : (
        <section className="totem-body chat-list-body">
          <span className="step">MINHAS MENSAGENS</span>
          <h1>Reclamações e sugestões</h1>
          <p>Guarde o código <strong>{auth.code}</strong> para voltar aqui e ver as respostas do supervisor.</p>

          <button type="button" className="primary chat-new-btn" onClick={startNova}>
            <MessageSquareText size={16} /> Nova mensagem
          </button>

          {mensagens.length === 0 && <p className="chat-empty">Você ainda não enviou nenhuma mensagem.</p>}

          <div className="chat-list">
            {mensagens.map((item) => (
              <article className="chat-item" key={item.id}>
                <header>
                  <span className={`chat-tipo-badge ${item.tipo === 'RECLAMACAO' ? 'alert' : 'good'}`}>
                    {item.tipo === 'RECLAMACAO' ? 'Reclamação' : 'Sugestão'}
                  </span>
                  <span>{item.setor_nome} · {item.turno_nome}</span>
                  <b className={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</b>
                </header>
                <p className="chat-item-mensagem">{item.mensagem}</p>
                {item.resposta_supervisor && (
                  <div className="chat-item-resposta">
                    <strong>Resposta do supervisor</strong>
                    <p>{item.resposta_supervisor}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <footer>
        Portal do funcionário
        <span>Código anônimo: {auth.code}</span>
      </footer>
    </main>
  );
}
