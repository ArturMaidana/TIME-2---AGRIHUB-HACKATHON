import { CalendarDays, MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const STATUS_LABEL = {
  ABERTO: 'Aberto', EM_ANALISE: 'Em análise', TRATADO: 'Tratado', DESCARTADO: 'Descartado',
};
const STATUS_TONE = {
  ABERTO: 'watch', EM_ANALISE: 'watch', TRATADO: 'good', DESCARTADO: 'alert',
};

export function Notifications({ auth }) {
  const [notificacoes, setNotificacoes] = useState();
  const [respostas, setRespostas] = useState({});

  function reload() {
    return api('/api/v1/supervisor/notificacoes', {}, auth.token).then((res) => setNotificacoes(res.notificacoes));
  }
  useEffect(() => { reload(); }, [auth.token]);

  async function atualizar(id, status) {
    await api(`/api/v1/supervisor/notificacoes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resposta: respostas[id] }),
    }, auth.token);
    await reload();
    setRespostas((current) => ({ ...current, [id]: '' }));
  }

  if (!notificacoes) return <div className="loading">Carregando notificações…</div>;

  return <div className="content">
    <header className="page-head">
      <div>
        <span className="overline">NOTIFICAÇÕES</span>
        <h1>Reclamações e sugestões</h1>
        <p>Mensagens anônimas dos funcionários, escopadas pelos seus setores.</p>
      </div>
      <div className="period-badge"><CalendarDays />{notificacoes.length} no total</div>
    </header>

    {notificacoes.length === 0 && (
      <div className="card">
        <p className="chat-empty"><MessageSquareText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Nenhuma reclamação ou sugestão recebida ainda.</p>
      </div>
    )}

    <div className="chat-list">
      {notificacoes.map((item) => (
        <article className="chat-item chat-notif-item" key={item.id}>
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
              <strong>Sua resposta</strong>
              <p>{item.resposta_supervisor}</p>
            </div>
          )}
          <div className="chat-notif-reply">
            <textarea
              placeholder="Responder (opcional)…"
              value={respostas[item.id] ?? ''}
              onChange={(event) => setRespostas((current) => ({ ...current, [item.id]: event.target.value }))}
            />
            <div className="chat-notif-actions">
              <button
                type="button"
                className="primary"
                disabled={!respostas[item.id]?.trim()}
                onClick={() => atualizar(item.id, item.status)}
              >
                Responder
              </button>
              <select
                value={item.status}
                onChange={(event) => atualizar(item.id, event.target.value)}
              >
                <option value="ABERTO">Aberto</option>
                <option value="EM_ANALISE">Em análise</option>
                <option value="TRATADO">Tratado</option>
                <option value="DESCARTADO">Descartado</option>
              </select>
            </div>
          </div>
        </article>
      ))}
    </div>
  </div>;
}
