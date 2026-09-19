import { useMemo } from 'react';

export function LineChart({ series }) {
  const groups = useMemo(() => {
    const map = {};
    for (const row of series) (map[row.date] ??= { date: row.date })[row.metric] = row.average;
    return Object.values(map).slice(-12);
  }, [series]);
  return <div className="chart">
    <div className="legend"><span className="energy">Energia</span><span className="physical">Dor/cansaço</span><span className="stress">Estresse</span></div>
    <div className="bars">{groups.map((group) => <div className="day" key={group.date}>
      <div><i className="energy" style={{ height: `${(group.ENERGY || 0) * 18}%` }} /><i className="physical" style={{ height: `${(group.PHYSICAL || 0) * 18}%` }} /><i className="stress" style={{ height: `${(group.STRESS || 0) * 18}%` }} /></div>
      <small>{group.date.slice(5).split('-').reverse().join('/')}</small>
    </div>)}</div>
  </div>;
}
