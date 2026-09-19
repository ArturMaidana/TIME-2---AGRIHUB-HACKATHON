import { useState } from 'react';
import { Login } from '../features/auth/Login.jsx';
import { Totem } from '../features/totem/Totem.jsx';
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
  return auth.role === 'TOTEM'
    ? <Totem auth={auth} onLogout={logout} />
    : <Shell auth={auth} onLogout={logout} />;
}
