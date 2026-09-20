import { useState } from 'react';
import { Login } from '../features/auth/Login.jsx';
import { Totem } from '../features/totem/Totem.jsx';
import { ChatAnonimo } from '../features/chat/ChatAnonimo.jsx';
import { Shell } from '../layout/Shell.jsx';

export function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('agri-auth') || 'null'));
  const authenticate = (value) => {
    localStorage.setItem('agri-auth', JSON.stringify(value));
    setAuth(value);
  };
  const logout = () => {
    localStorage.removeItem('agri-auth');
    setAuth(null);
  };
  if (!auth) return <Login onAuthenticated={authenticate} />;
  if (auth.role === 'TOTEM') return <Totem auth={auth} onLogout={logout} />;
  if (auth.role === 'FUNCIONARIO') return <ChatAnonimo auth={auth} onLogout={logout} />;
  return <Shell auth={auth} onLogout={logout} />;
}
