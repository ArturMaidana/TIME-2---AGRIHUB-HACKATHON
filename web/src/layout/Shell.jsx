import {
  CalendarDays,
  ClipboardList,
  Factory,
  Flower2,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { Dashboard } from '../features/dashboard/Dashboard.jsx';
import { MonthlyAnalysis } from '../features/dashboard/MonthlyAnalysis.jsx';
import { SectorPresence } from '../features/presence/SectorPresence.jsx';
import { SectorIndicators } from '../features/dashboard/SectorIndicators.jsx';
import { RhPortal } from '../features/hr/RhPortal.jsx';

export function Shell({ auth, onLogout }) {
  const [page, setPage] = useState(auth.role === 'RH' ? 'rh' : 'dashboard');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const content = page === 'rh' ? <RhPortal auth={auth} />
    : page === 'sectors' ? <SectorIndicators auth={auth} />
      : page === 'monthly' ? <MonthlyAnalysis auth={auth} />
        : page === 'presence' ? <SectorPresence auth={auth} />
          : <Dashboard auth={auth} />;

  return (
    <div className="shell-layout">
      {/* Sidebar com ícones semânticos para cada aba */}
      <aside className="shell-sidebar" aria-label="Navegação Principal">
        {/* Emblema circular verde no topo */}
        <div
          className="sidebar-brand-badge"
          onClick={() => setPage(auth.role === 'RH' ? 'rh' : 'dashboard')}
          title="AgriPulso - Início"
          role="button"
          tabIndex={0}
        >
          <Flower2 size={24} strokeWidth={2.4} />
        </div>

        {/* Grupo superior de blocos/tiles */}
        <div className="sidebar-tiles-top">
          {/* 1. Visão Geral / Pulso da Operação */}
          <button
            type="button"
            className={`sidebar-tile ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => setPage('dashboard')}
            title="Visão Geral (Dashboard)"
            aria-label="Visão Geral"
          >
            <LayoutDashboard size={21} />
          </button>

          {/* 2. Indicadores por Setor (Supervisor) ou Portal RH */}
          {auth.role === 'SUPERVISOR' ? (
            <button
              type="button"
              className={`sidebar-tile ${page === 'sectors' ? 'active' : ''}`}
              onClick={() => setPage('sectors')}
              title="Indicadores por Setor (Fábrica)"
              aria-label="Setores"
            >
              <Factory size={21} />
            </button>
          ) : (
            <button
              type="button"
              className={`sidebar-tile ${page === 'rh' ? 'active' : ''}`}
              onClick={() => setPage('rh')}
              title="Portal do RH (Indicadores Estratégicos)"
              aria-label="Portal RH"
            >
              <ClipboardList size={21} />
            </button>
          )}

          {/* 3. Análise Mensal Integrada */}
          <button
            type="button"
            className={`sidebar-tile ${page === 'monthly' ? 'active' : ''}`}
            onClick={() => setPage('monthly')}
            title="Análise Mensal Integrada"
            aria-label="Análise Mensal"
          >
            <CalendarDays size={21} />
          </button>

          {/* 4. Presença em Tempo Real / Ponto de Saída dos Frigoríficos */}
          <button
            type="button"
            className={`sidebar-tile ${page === 'presence' ? 'active' : ''}`}
            onClick={() => setPage('presence')}
            title="Presença em Tempo Real (Ponto de Saída)"
            aria-label="Presença no Setor"
          >
            <UserCheck size={21} />
          </button>
        </div>

        {/* Grupo inferior de blocos/tiles */}
        <div className="sidebar-tiles-bottom">
          <button
            type="button"
            className={`sidebar-tile ${showSettings ? 'active' : ''}`}
            onClick={() => {
              setShowSettings(!showSettings);
              setShowUserMenu(false);
            }}
            title="Configurações da Unidade"
            aria-label="Configurações"
          >
            <Settings size={20} />
          </button>

          <button
            type="button"
            className={`sidebar-tile ${showUserMenu ? 'active' : ''}`}
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowSettings(false);
            }}
            title={`${auth.name} (${auth.role})`}
            aria-label="Perfil do Usuário"
          >
            <User size={20} />
          </button>

          {/* Menu flutuante do usuário */}
          {showUserMenu && (
            <div className="sidebar-popover-menu">
              <div className="popover-user-info">
                <strong>{auth.name}</strong>
                <small>{auth.role === 'RH' ? 'Recursos Humanos' : 'Supervisor da Operação'}</small>
              </div>
              <button
                type="button"
                className="popover-logout-btn"
                onClick={onLogout}
              >
                <LogOut size={16} />
                <span>Sair do sistema</span>
              </button>
            </div>
          )}

          {/* Menu flutuante de configurações */}
          {showSettings && (
            <div className="sidebar-popover-menu">
              <div className="popover-user-info">
                <strong>Configurações</strong>
                <small>Granja São José • Unidade 01</small>
                <span className="popover-tag">Modo Tablet Ativo</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="shell-main">
        {content}
      </main>
    </div>
  );
}
