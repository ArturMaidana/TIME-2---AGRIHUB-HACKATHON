import { Check, ClipboardPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { SectorOptions } from '../../components/SectorOptions.jsx';

export function RhPortal({ auth }) {
  const [meta, setMeta] = useState();
  const [saved, setSaved] = useState(false);
  useEffect(() => { api('/api/meta', {}, auth.token).then(setMeta); }, [auth.token]);
  async function save(event) {
    event.preventDefault();
    await api('/api/hr', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }, auth.token);
    setSaved(true);
    event.currentTarget.reset();
  }
  if (!meta) return <div className="loading">Carregando…</div>;
  return <div className="content rh"><header className="page-head"><div><span className="overline">PORTAL DO RH</span><h1>Indicadores estratégicos</h1><p>Envie dados agregados para enriquecer a análise da IA.</p></div></header>
    <section className="card form-card"><div className="form-intro"><span><ClipboardPlus /></span><h2>Novo período</h2><p>Nenhum dado individual ou clínico é armazenado.</p></div>
      <form onSubmit={save}><label>Setor<select name="sectorId" required><SectorOptions sectors={meta.sectors} /></select></label><label>Turno<select name="shiftId" required>{meta.shifts.map((shift) => <option value={shift.id} key={shift.id}>{shift.name}</option>)}</select></label><label>Período<input type="date" name="period" required /></label><label>Faltas<input type="number" name="absences" min="0" required /></label><label>Afastamentos<input type="number" name="leaves" min="0" required /></label><label>Horas extras<input type="number" name="overtimeHours" min="0" step="0.5" placeholder="0" /></label><button className="primary">Salvar indicadores</button></form>
      {saved && <div className="success"><Check /> Dados agregados enviados para análise.</div>}
    </section>
  </div>;
}
