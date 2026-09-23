interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}

/** Minimal price-trend line. Falls back to a flat mid-line for a single point. */
export function Sparkline({ values, width = 640, height = 120, label = 'Price history' }: SparklineProps) {
  if (values.length === 0) return null;

  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = pad + i * stepX + (values.length === 1 ? (width - pad * 2) / 2 : 0);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height - pad} L${points[0][0].toFixed(1)},${height - pad} Z`;
  const trendDown = values[values.length - 1] <= values[0];
  const stroke = trendDown ? 'var(--green-600)' : 'var(--red-600)';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={`${label}: ${values.length} points, from ${values[0]} to ${values[values.length - 1]}`}
      style={{ display: 'block' }}
    >
      <path d={area} fill={stroke} opacity="0.1" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="var(--surface)" stroke={stroke} strokeWidth="2" />
      ))}
    </svg>
  );
}
