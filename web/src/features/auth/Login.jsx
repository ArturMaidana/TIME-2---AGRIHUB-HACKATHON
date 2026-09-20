import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';

const ROLES = ['SUPERVISOR', 'RH', 'TOTEM', 'FUNCIONARIO'];

const ROLE_DETAILS = {
  SUPERVISOR: {
    overline: 'DECISÕES MAIS HUMANAS',
    title: <>O trabalho tem ritmo.<br />As pessoas também.</>,
    description: 'Dados anônimos transformados em ações para equipes mais saudáveis e operações mais sustentáveis.',
    badge: 'Privacidade desde a primeira resposta',
    subtitle: 'Escolha o ambiente para explorar o MVP.',
    defaultCode: 'SUPERVISOR',
  },
  RH: {
    overline: 'GESTÃO INTEGRADA & SESMT',
    title: <>Prevenção contínua.<br />Cuidado com quem produz.</>,
    description: 'Cruzamento de horas extras, faltas e afastamentos com a percepção de bem-estar das equipes.',
    badge: 'Visão agregada por setor e turno • sem dados individuais',
    subtitle: 'Portal do RH para acompanhamento de indicadores e afastamentos.',
    defaultCode: 'RH2026',
  },
  TOTEM: {
    overline: 'ESCUTA ATIVA NO CHÃO DE FÁBRICA',
    title: <>Sua percepção importa.<br />100% anônimo e seguro.</>,
    description: 'Terminal ágil de 3 perguntas na troca de turno para detecção precoce de desgaste coletivo.',
    badge: 'Nenhum dado pessoal ou identificação é coletado',
    subtitle: 'Terminal de quiosque para registro anônimo de sensação térmica e desgaste.',
    defaultCode: 'TOTEM-01',
  },
  FUNCIONARIO: {
    overline: 'FALE COM O SUPERVISOR, SEM SE IDENTIFICAR',
    title: <>Sua voz importa.<br />Sem nome, sem medo.</>,
    description: 'Reclamações e sugestões chegam direto ao supervisor do seu setor — sem nome, matrícula ou qualquer identificação.',
    badge: 'Código anônimo, sem senha — feito para acesso fácil',
    subtitle: 'Deixe em branco para criar um código novo, ou digite o seu (ex: anonimo_3) para ver respostas.',
    defaultCode: '',
  },
};

export function Login({ onAuthenticated }) {
  const [type, setType] = useState('SUPERVISOR');
  const [code, setCode] = useState('SUPERVISOR');
  const [error, setError] = useState('');
  const [animDirection, setAnimDirection] = useState('next');
  const [animKey, setAnimKey] = useState(0);

  const changeType = (nextType) => {
    if (nextType === type) return;
    const currentIndex = ROLES.indexOf(type);
    const nextIndex = ROLES.indexOf(nextType);
    setAnimDirection(nextIndex > currentIndex ? 'next' : 'prev');
    setAnimKey((prev) => prev + 1);
    setType(nextType);
    setCode(ROLE_DETAILS[nextType].defaultCode);
    setError('');
  };

  async function submit(event) {
    event.preventDefault();
    try {
      onAuthenticated(await api('/api/auth', { method: 'POST', body: JSON.stringify({ type, code }) }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const activeIndex = ROLES.indexOf(type);
  const currentRole = ROLE_DETAILS[type];

  return (
    <main className={`login mode-${type.toLowerCase()}`}>
      <section className="login-art">
        <Brand />
        <div key={animKey} className={`login-art-content anim-${animDirection}`}>
          <span className="overline">{currentRole.overline}</span>
          <h1>{currentRole.title}</h1>
          <p>{currentRole.description}</p>
        </div>
        <small key={`badge-${animKey}`} className={`anim-${animDirection}`}>
          <ShieldCheck /> {currentRole.badge}
        </small>
      </section>

      <section className="login-form">
        <form onSubmit={submit}>
          <span className="overline">ACESSO À PLATAFORMA</span>
          <h2>Bem-vindo ao AgriPulso</h2>
          <p key={`sub-${animKey}`} className={`login-sub-anim anim-${animDirection}`}>
            {currentRole.subtitle}
          </p>

          <div className={`role-tabs active-${activeIndex}`}>
            <div className="role-tabs-indicator" aria-hidden="true" />
            {ROLES.map((role) => (
              <button
                type="button"
                className={type === role ? 'on' : ''}
                onClick={() => changeType(role)}
                key={role}
              >
                {role === 'SUPERVISOR' ? 'Supervisor' : role === 'RH' ? 'RH' : role === 'TOTEM' ? 'Totem' : 'Funcionário'}
              </button>
            ))}
          </div>

          <div key={`input-${animKey}`} className={`login-input-box anim-${animDirection}`}>
            <label>
              Código de acesso
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          </div>

          {error && <div className="error">{error}</div>}
          <button className="primary">Entrar <ChevronRight /></button>
          <small>{type === 'FUNCIONARIO' ? 'Sem senha — em branco cria um código novo' : 'Credenciais demonstrativas já preenchidas'}</small>
        </form>
      </section>
    </main>
  );
}
