import { ArrowUpRight } from 'lucide-react';

export function Metric({ icon: Icon, label, value, note, tone, highlight, badge }) {
  return (
    <article className={`metric ${tone || ''} ${highlight ? 'highlight-hero' : ''}`}>
      <div className="metric-header">
        <div className="metric-header-left">
          {Icon && <span className="metric-icon-box"><Icon size={18} /></span>}
          <span className="metric-label">{label}</span>
        </div>
        <div className="metric-header-right">
          {badge && <span className="metric-badge">{badge}</span>}
          <ArrowUpRight size={17} className="metric-arrow" />
        </div>
      </div>
      <strong className="metric-value">{value}</strong>
      {note && <p className="metric-note">{note}</p>}
    </article>
  );
}
