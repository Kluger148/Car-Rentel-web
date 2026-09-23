import { useState } from 'react';
import { money, shortDate } from '../lib/format';

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Axis labels: the date, or the time when an earlier scan that day already used the date.
 * With many scans only about six labels are drawn, so they never overlap.
 */
function axisLabels(points: PricePoint[]): Array<string | null> {
  const every = Math.max(1, Math.ceil(points.length / 6));
  return points.map((p, i) => {
    const show = i === 0 || i === points.length - 1 || i % every === 0;
    if (!show) return null;
    const day = p.at.slice(0, 10);
    const sameDayBefore = points.slice(0, i).some((q) => q.at.slice(0, 10) === day);
    return sameDayBefore ? timeFmt.format(new Date(p.at)) : shortDate(day);
  });
}

export interface PricePoint {
  /** Milliseconds; used only for the axis label. */
  at: string;
  runId: number;
  value: number;
}

interface PriceChartProps {
  points: PricePoint[];
  /** The $1,100 goal, drawn as a dashed line when it falls inside the chart. */
  target?: number;
  currency?: string;
  height?: number;
}

const W = 900;
const PAD = { top: 18, right: 22, bottom: 34, left: 68 };

/** "Nice" round step so the axis reads 800 / 1,000 / 1,200 rather than 823 / 1,046. */
function niceStep(span: number, ticks: number): number {
  const raw = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Price over time: gridlines with money labels, dated x-axis, the target as a dashed line,
 * and a tooltip on hover. Falls back to a single marker when only one scan exists.
 */
export function PriceChart({ points, target, currency = 'USD', height = 260 }: PriceChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values, target ?? Infinity);
  const hi = Math.max(...values, target ?? -Infinity);
  const pad = (hi - lo || hi * 0.1 || 100) * 0.15;
  const step = niceStep(hi - lo + pad * 2, 4);
  const yMin = Math.max(0, Math.floor((lo - pad) / step) * step);
  const yMax = Math.ceil((hi + pad) / step) * step;

  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 0.001; v += step) ticks.push(Math.round(v * 100) / 100);

  const coords = points.map((p, i) => [x(i), y(p.value)] as const);
  const line = coords.map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${PAD.top + plotH} L${coords[0][0].toFixed(1)},${PAD.top + plotH} Z`;
  const first = values[0];
  const last = values[values.length - 1];
  const down = last <= first;
  const stroke = down ? 'var(--green-600)' : 'var(--red-600)';
  const cheapestIdx = values.indexOf(Math.min(...values));
  const active = hover ?? points.length - 1;
  const labels = axisLabels(points);

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Price history: ${points.length} scans, from ${money(first, currency)} to ${money(last, currency)}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className="chart__tick">
              {money(t, currency)}
            </text>
          </g>
        ))}

        {target !== undefined && target >= yMin && target <= yMax && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} className="chart__target" />
            <text x={W - PAD.right} y={y(target) - 7} textAnchor="end" className="chart__target-label">
              Target {money(target, currency)}
            </text>
          </g>
        )}

        <path d={area} fill="url(#chartFill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {coords.map(([cx, cy], i) => (
          <circle
            key={points[i].runId}
            cx={cx}
            cy={cy}
            r={i === active ? 6 : i === cheapestIdx ? 5 : 4}
            fill={i === active ? stroke : 'var(--surface)'}
            stroke={stroke}
            strokeWidth="2.5"
          />
        ))}

        {labels.map((label, i) =>
          label === null ? null : (
            <text
              key={points[i].runId}
              x={x(i)}
              y={height - 12}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              className="chart__tick"
            >
              {label}
            </text>
          ),
        )}

        {/* Invisible hit areas so the whole column is hoverable, not just the dot. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.runId}`}
            x={x(i) - plotW / Math.max(points.length * 2, 2) - 6}
            y={PAD.top}
            width={plotW / Math.max(points.length, 1) + 12}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <div className="chart__legend">
        <span>
          <b>Scan #{points[active].runId}</b> · {shortDate(points[active].at.slice(0, 10))},{' '}
          {timeFmt.format(new Date(points[active].at))}
        </span>
        <span className="chart__legend-price" style={{ color: stroke }}>
          {money(points[active].value, currency)} / 30 days
        </span>
        {active === cheapestIdx && <span className="chart__badge">Lowest seen</span>}
      </div>
    </div>
  );
}
