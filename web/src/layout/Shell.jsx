import { BarChart3, Building2, CalendarDays, ClipboardPlus, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '../components/Brand.jsx';
import { Dashboard } from '../features/dashboard/Dashboard.jsx';
import { MonthlyAnalysis } from '../features/dashboard/MonthlyAnalysis.jsx';
import { SectorIndicators } from '../features/dashboard/SectorIndicators.jsx';
import { RhPortal } from '../features/hr/RhPortal.jsx';

export function Shell({ auth, onLogout }) {
  const [page, setPage] = useState(auth.role === 'RH' ? 'rh' : 'dashboard');
  const content = page === 'rh' ? <RhPortal auth={auth} />
    : page === 'sectors' ? <SectorIndicators auth={auth} />
      : page === 'monthly' ? <MonthlyAnalysis auth={auth} />
        : <Dashboard auth={auth} />;
  return <div className="shell"><aside><Brand /><nav>
    {auth.role === 'SUPERVISOR' && <><button className={page === 'dashboard' ? 'on' : ''} onClick={() => setPage('dashboard')}><BarChart3 />Visão geral</button><button className={page === 'sectors' ? 'on' : ''} onClick={() => setPage('sectors')}><Building2 />Indicadores por setor</button><button className={page === 'monthly' ? 'on' : ''} onClick={() => setPage('monthly')}><CalendarDays />Análise mensal</button></>}
    {auth.role === 'RH' && <button className={page === 'rh' ? 'on' : ''} onClick={() => setPage('rh')}><ClipboardPlus />Indicadores RH</button>}
  </nav><div className="user"><span>{auth.name[0]}</span><div><strong>{auth.name}</strong><small>{auth.role === 'RH' ? 'Recursos Humanos' : 'Supervisor'}</small></div><button onClick={onLogout}><LogOut /></button></div></aside><main>{content}</main></div>;
}
