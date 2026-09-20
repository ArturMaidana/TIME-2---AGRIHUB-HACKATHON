import {
  Bell,
  CalendarDays,
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  Maximize,
  Minimize,
  Settings,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Dashboard } from '../features/dashboard/Dashboard.jsx';
import { MonthlyAnalysis } from '../features/dashboard/MonthlyAnalysis.jsx';
import { Notifications } from '../features/dashboard/Notifications.jsx';
import { SectorIndicators } from '../features/dashboard/SectorIndicators.jsx';
import { RhPortal } from '../features/hr/RhPortal.jsx';

export function Shell({ auth, onLogout }) {
  const [page, setPage] = useState(auth.role === 'RH' ? 'rh' : 'dashboard');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (auth.role !== 'SUPERVISOR') return;
    api('/api/v1/supervisor/notificacoes?status=ABERTO', {}, auth.token)
      .then((res) => setNotifCount(res.notificacoes.length))
      .catch(() => {});
  }, [auth.token, auth.role, page]);

  // Sincroniza estado de tela cheia com a API do navegador
  useEffect(() => {
    const onFullscreenChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const docEl = document.documentElement;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (!fsEl) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  const content = page === 'rh' ? <RhPortal auth={auth} />
    : page === 'sectors' ? <SectorIndicators auth={auth} />
      : page === 'monthly' ? <MonthlyAnalysis auth={auth} />
        : page === 'notifications' ? <Notifications auth={auth} />
          : <Dashboard auth={auth} />;

  return (
    <div className="shell-layout">
      {/* Barra superior exibida em telas verticais/mobile */}
      <div className="mobile-portrait-header">
        <div className="mobile-brand-group">
          <div className="sidebar-brand-badge mini" title="AgriPulso" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src="/LogoNova.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <strong>Agri<span>Pulso</span></strong>
        </div>

        <button
          type="button"
          className="fullscreen-header-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia (Esconder URL)'}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          <span>{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
        </button>
      </div>

      {/* Sidebar vertical em horizontal / Navbar de aplicativo em vertical */}
      <aside className="shell-sidebar" aria-label="Navegação Principal">
        {/* Emblema circular verde no topo (exibido na sidebar horizontal) */}
        <div
          className="sidebar-brand-badge"
          onClick={() => setPage(auth.role === 'RH' ? 'rh' : 'dashboard')}
          title="AgriPulso - Início"
          role="button"
          tabIndex={0}
          style={{ background: 'transparent', boxShadow: 'none' }}
        >
          <img src="/LogoNova.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        {/* Grupo superior de blocos/tiles */}
        <div className="sidebar-tiles-top">
          {/* 1. Visão Geral / Pulso da Operação */}
          {auth.role === 'SUPERVISOR' && (
            <button
              type="button"
              className={`sidebar-tile ${page === 'dashboard' ? 'active' : ''}`}
              onClick={() => setPage('dashboard')}
              title="Visão Geral (Dashboard)"
              aria-label="Visão Geral"
            >
              <LayoutDashboard size={21} />
            </button>
          )}

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

          {/* 3. Análise Mensal Integrada — só supervisor */}
          {auth.role === 'SUPERVISOR' && (
            <button
              type="button"
              className={`sidebar-tile ${page === 'monthly' ? 'active' : ''}`}
              onClick={() => setPage('monthly')}
              title="Análise Mensal Integrada"
              aria-label="Análise Mensal"
            >
              <CalendarDays size={21} />
            </button>
          )}

          {/* 4. Notificações (reclamações/sugestões anônimas) — só supervisor */}
          {auth.role === 'SUPERVISOR' && (
            <button
              type="button"
              className={`sidebar-tile ${page === 'notifications' ? 'active' : ''}`}
              onClick={() => setPage('notifications')}
              title="Notificações (reclamações e sugestões)"
              aria-label="Notificações"
              style={{ position: 'relative' }}
            >
              <Bell size={21} />
              {notifCount > 0 && <span className="alert-badge-count" style={{ position: 'absolute', top: 4, right: 4, fontSize: 9, padding: '1px 5px' }}>{notifCount}</span>}
            </button>
          )}

        </div>

        {/* Divisor visual entre navegação e utilitários */}
        <div className="sidebar-group-divider" />

        {/* Grupo inferior de blocos/tiles */}
        <div className="sidebar-tiles-bottom">
          {/* 5. Botão de Configurações */}
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

          {/* 6. Botão de Usuário */}
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

          {/* 7. Botão de Tela Cheia (Fullscreen) - EM ÚLTIMO */}
          <button
            type="button"
            className={`sidebar-tile ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia (Esconder URL)'}
            aria-label="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
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
