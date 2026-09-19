import { Check, ChevronRight, Clock3, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';

const moods = ['😣', '😕', '😐', '🙂', '😄'];
const questions = [
  { key: 'ENERGY', title: 'Como está seu nível de energia hoje?', low: 'Muito baixo', high: 'Muito alto' },
  { key: 'PHYSICAL', title: 'Como está seu nível de dor ou cansaço físico?', low: 'Nenhum', high: 'Muito intenso' },
  { key: 'STRESS', title: 'Como está seu nível de ansiedade ou estresse?', low: 'Nenhum', high: 'Muito intenso' },
];

export function Totem({ auth, onLogout }) {
  const [data, setData] = useState();
  const [sector, setSector] = useState();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sent, setSent] = useState(false);
  useEffect(() => { api('/api/totem', {}, auth.token).then(setData); }, [auth.token]);

  async function answer(score) {
    const next = { ...answers, [questions[step].key]: score };
    setAnswers(next);
    if (step < 2) return setStep(step + 1);
    await api('/api/totem/responses', {
      method: 'POST', body: JSON.stringify({ sectorId: sector.id, answers: next }),
    }, auth.token);
    setSent(true);
    setTimeout(() => { setSector(); setStep(0); setAnswers({}); setSent(false); }, 2200);
  }

  if (!data) return <div className="loading">Preparando o totem…</div>;
  return <main className="totem"><header><Brand /><div><Clock3 /> {data.shift.name} • {data.shift.start_time}–{data.shift.end_time}<button onClick={onLogout}><LogOut /></button></div></header>
    {sent ? <section className="thanks"><span><Check /></span><h1>Obrigado por responder!</h1><p>Suas respostas já foram somadas ao pulso do setor.</p></section>
      : !sector ? <section className="totem-body"><span className="step">PASSO 1 DE 2</span><h1>Em qual setor você trabalha?</h1><p>Selecione seu setor para começar. Você não será identificado.</p>
        <div className="sector-groups">{['QUENTE', 'FRIA'].map((category) => <div className={`sector-group ${category.toLowerCase()}`} key={category}><h2>{category === 'QUENTE' ? 'Área Quente' : 'Área Fria'}</h2><div className="sector-buttons">
          {data.sectors.filter((item) => item.category === category).map((item, index) => <button key={item.id} onClick={() => setSector(item)}><span>{String(index + 1).padStart(2, '0')}</span>{item.name}<ChevronRight /></button>)}
        </div></div>)}</div><small><ShieldCheck /> Pesquisa anônima • nenhuma identificação é coletada</small></section>
        : <section className="totem-body"><span className="step">PERGUNTA {step + 1} DE 3 • {sector.name}</span><div className="question-dots"><i className={step >= 0 ? 'on' : ''} /><i className={step >= 1 ? 'on' : ''} /><i className={step >= 2 ? 'on' : ''} /></div><h1>{questions[step].title}</h1><p>Toque na opção que melhor representa você agora.</p>
          <div className="moods">{moods.map((mood, index) => <button key={mood} onClick={() => answer(index + 1)}><span>{mood}</span><b>{index + 1}</b><small>{index === 0 ? questions[step].low : index === 4 ? questions[step].high : ''}</small></button>)}</div>
        </section>}
    <footer>Totem: {auth.name}<span>O turno é identificado automaticamente pelo horário</span></footer>
  </main>;
}
