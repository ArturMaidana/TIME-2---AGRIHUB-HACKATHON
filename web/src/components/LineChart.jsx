import { BarChart2, TrendingUp } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

const METRICS_CONFIG = {
  ENERGY: {
    label: 'Energia',
    color: '#1c7c58',
    gradientFrom: 'rgba(28, 124, 88, 0.35)',
    gradientTo: 'rgba(28, 124, 88, 0.01)',
    badgeClass: 'energy',
  },
  PHYSICAL: {
    label: 'Dor / Cansaço',
    color: '#e98c45',
    gradientFrom: 'rgba(233, 140, 69, 0.35)',
    gradientTo: 'rgba(233, 140, 69, 0.01)',
    badgeClass: 'physical',
  },
  STRESS: {
    label: 'Estresse',
    color: '#397c88',
    gradientFrom: 'rgba(57, 124, 136, 0.35)',
    gradientTo: 'rgba(57, 124, 136, 0.01)',
    badgeClass: 'stress',
  },
};

function getCurvedPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function getAreaPath(points, bottomY) {
  if (!points || points.length === 0) return '';
  const curve = getCurvedPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
}

export function LineChart({ series = [] }) {
  const chartId = useId();
  const [chartType, setChartType] = useState('curve'); // 'curve' | 'bar'
  const [activeMetrics, setActiveMetrics] = useState({
    ENERGY: true,
    PHYSICAL: true,
    STRESS: true,
  });
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const groups = useMemo(() => {
    const map = {};
    for (const row of series) {
      if (!map[row.date]) map[row.date] = { date: row.date, responses: 0 };
      map[row.date][row.metric] = Number(row.average || 0);
      if (row.responses) map[row.date].responses += Number(row.responses);
    }
    const list = Object.values(map);
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list.slice(-14);
  }, [series]);

  const toggleMetric = (key) => {
    setActiveMetrics((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const W = 760;
  const H = 250;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const bottomY = H - padBottom;

  const getX = (idx) => {
    if (groups.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (groups.length - 1)) * plotW;
  };

  const getY = (val) => {
    const clamped = Math.max(1, Math.min(5, Number(val || 1)));
    return padTop + (1 - (clamped - 1) / 4) * plotH;
  };

  const linePoints = useMemo(() => {
    const result = { ENERGY: [], PHYSICAL: [], STRESS: [] };
    groups.forEach((g, i) => {
      const x = getX(i);
      Object.keys(result).forEach((key) => {
        const val = g[key] ?? 3;
        result[key].push({ x, y: getY(val), val, date: g.date });
      });
    });
    return result;
  }, [groups]);

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (clientX - (padLeft / W) * rect.width) / ((plotW / W) * rect.width)));
    const idx = Math.round(ratio * (groups.length - 1));
    if (idx >= 0 && idx < groups.length) {
      setHoveredIndex(idx);
    }
  };

  const handlePointerLeave = () => {
    setHoveredIndex(null);
  };

  const activeGroup = hoveredIndex !== null ? groups[hoveredIndex] : null;

  return (
    <div className="modern-chart-container">
      <div className="chart-toolbar">
        <div className="chart-legend-interactive">
          {Object.entries(METRICS_CONFIG).map(([key, cfg]) => {
            const isActive = activeMetrics[key];
            return (
              <button
                key={key}
                type="button"
                className={`legend-tag ${cfg.badgeClass} ${isActive ? 'active' : 'inactive'}`}
                onClick={() => toggleMetric(key)}
                title={isActive ? `Ocultar ${cfg.label}` : `Mostrar ${cfg.label}`}
              >
                <span className="legend-dot" style={{ backgroundColor: cfg.color }} />
                <strong>{cfg.label}</strong>
              </button>
            );
          })}
        </div>

        <div className="chart-type-toggle">
          <button
            type="button"
            className={chartType === 'curve' ? 'active' : ''}
            onClick={() => setChartType('curve')}
            title="Visualização em Linhas e Áreas Suaves"
          >
            <TrendingUp size={15} />
            <span>Linhas</span>
          </button>
          <button
            type="button"
            className={chartType === 'bar' ? 'active' : ''}
            onClick={() => setChartType('bar')}
            title="Visualização em Barras Agrupadas"
          >
            <BarChart2 size={15} />
            <span>Barras</span>
          </button>
        </div>
      </div>

      <div
        className="chart-viewport"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            {Object.entries(METRICS_CONFIG).map(([key, cfg]) => (
              <linearGradient
                key={key}
                id={`grad-${key}-${chartId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={cfg.gradientFrom} />
                <stop offset="100%" stopColor={cfg.gradientTo} />
              </linearGradient>
            ))}
          </defs>

          {[1, 2, 3, 4, 5].map((level) => {
            const y = getY(level);
            return (
              <g key={level} className="grid-line-group">
                <line
                  x1={padLeft}
                  y1={y}
                  x2={W - padRight}
                  y2={y}
                  stroke={level === 3 ? '#cfded2' : '#e6ede7'}
                  strokeWidth={level === 3 ? 1.5 : 1}
                  strokeDasharray={level === 3 ? '4 3' : '2 3'}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="axis-label y-axis"
                >
                  {level}.0
                </text>
              </g>
            );
          })}

          {chartType === 'curve' && (
            <>
              {Object.entries(METRICS_CONFIG).map(([key]) => {
                if (!activeMetrics[key]) return null;
                const pts = linePoints[key];
                return (
                  <path
                    key={`area-${key}`}
                    d={getAreaPath(pts, bottomY)}
                    fill={`url(#grad-${key}-${chartId})`}
                    className="chart-area-path"
                  />
                );
              })}

              {Object.entries(METRICS_CONFIG).map(([key, cfg]) => {
                if (!activeMetrics[key]) return null;
                const pts = linePoints[key];
                return (
                  <path
                    key={`line-${key}`}
                    d={getCurvedPath(pts)}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="chart-line-path"
                  />
                );
              })}

              {Object.entries(METRICS_CONFIG).map(([key, cfg]) => {
                if (!activeMetrics[key]) return null;
                const pts = linePoints[key];
                return (
                  <g key={`dots-${key}`}>
                    {pts.map((p, idx) => {
                      const isHovered = hoveredIndex === idx;
                      return (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={isHovered ? 5.5 : 3}
                          fill={isHovered ? '#fff' : cfg.color}
                          stroke={cfg.color}
                          strokeWidth={isHovered ? 3 : 1.5}
                          className="chart-dot"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </>
          )}

          {chartType === 'bar' && (
            <g className="chart-bars-mode">
              {groups.map((g, idx) => {
                const groupX = getX(idx);
                const activeKeys = Object.keys(METRICS_CONFIG).filter((k) => activeMetrics[k]);
                const barWidth = Math.max(3, Math.min(10, (plotW / groups.length / activeKeys.length) * 0.75));
                const totalWidth = activeKeys.length * barWidth + (activeKeys.length - 1) * 2;
                const startX = groupX - totalWidth / 2;

                return (
                  <g key={idx}>
                    {activeKeys.map((key, kIdx) => {
                      const val = g[key] ?? 3;
                      const y = getY(val);
                      const barH = Math.max(2, bottomY - y);
                      const bX = startX + kIdx * (barWidth + 2);
                      const cfg = METRICS_CONFIG[key];

                      return (
                        <rect
                          key={key}
                          x={bX}
                          y={y}
                          width={barWidth}
                          height={barH}
                          rx={3}
                          fill={cfg.color}
                          opacity={hoveredIndex === idx ? 1 : 0.85}
                          className="chart-bar-rect"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          )}

          {hoveredIndex !== null && (
            <g className="chart-crosshair">
              <line
                x1={getX(hoveredIndex)}
                y1={padTop}
                x2={getX(hoveredIndex)}
                y2={bottomY}
                stroke="#17332e"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.35"
              />
            </g>
          )}

          {groups.map((g, idx) => {
            const x = getX(idx);
            const parts = g.date ? g.date.slice(5).split('-').reverse().join('/') : '';
            return (
              <text
                key={idx}
                x={x}
                y={H - 10}
                textAnchor="middle"
                className={`axis-label x-axis ${hoveredIndex === idx ? 'active' : ''}`}
              >
                {parts}
              </text>
            );
          })}
        </svg>

        {activeGroup && (
          <div
            className="chart-tooltip-floating"
            style={{
              left: `${Math.max(8, Math.min(88, (getX(hoveredIndex) / W) * 100))}%`,
            }}
          >
            <div className="tooltip-header">
              <strong>
                {activeGroup.date ? activeGroup.date.split('-').reverse().join('/') : ''}
              </strong>
              {activeGroup.responses ? (
                <span>{activeGroup.responses} respostas</span>
              ) : null}
            </div>
            <div className="tooltip-metrics">
              {Object.entries(METRICS_CONFIG).map(([key, cfg]) => {
                if (!activeMetrics[key]) return null;
                const val = activeGroup[key];
                return (
                  <div key={key} className="tooltip-row">
                    <span className="tooltip-dot" style={{ backgroundColor: cfg.color }} />
                    <span className="tooltip-name">{cfg.label}:</span>
                    <strong className="tooltip-val">{val !== undefined ? Number(val).toFixed(2) : '-'}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
