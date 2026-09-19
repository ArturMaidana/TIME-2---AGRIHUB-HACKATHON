import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { Brand } from '../../components/Brand.jsx';

export function Login({ onAuthenticated }) {
  const [type, setType] = useState('SUPERVISOR');
  const [code, setCode] = useState('SUPERVISOR');
  const [error, setError] = useState('');
  const changeType = (nextType) => {
    setType(nextType);
    setCode(nextType === 'SUPERVISOR' ? 'SUPERVISOR' : nextType === 'RH' ? 'RH2026' : 'TOTEM-01');
  };
  async function submit(event) {
    event.preventDefault();
    try {
      onAuthenticated(await api('/api/auth', { method: 'POST', body: JSON.stringify({ type, code }) }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  return <main className="login"><section className="login-art"><Brand /><div>
    <span className="overline">DECISÕES MAIS HUMANAS</span><h1>O trabalho tem ritmo.<br />As pessoas também.</h1>
    <p>Dados anônimos transformados em ações para equipes mais saudáveis e operações mais sustentáveis.</p>
  </div><small><ShieldCheck /> Privacidade desde a primeira resposta</small></section>
    <section className="login-form"><form onSubmit={submit}><span className="overline">ACESSO À PLATAFORMA</span>
      <h2>Bem-vindo ao AgriPulso</h2><p>Escolha o ambiente para explorar o MVP.</p>
      <div className="role-tabs">{['SUPERVISOR', 'RH', 'TOTEM'].map((role) => <button type="button" className={type === role ? 'on' : ''} onClick={() => changeType(role)} key={role}>{role === 'SUPERVISOR' ? 'Supervisor' : role === 'RH' ? 'RH' : 'Totem'}</button>)}</div>
      <label>Código de acesso<input value={code} onChange={(event) => setCode(event.target.value)} /></label>
      {error && <div className="error">{error}</div>}<button className="primary">Entrar <ChevronRight /></button>
      <small>Credenciais demonstrativas já preenchidas</small>
    </form></section></main>;
}
