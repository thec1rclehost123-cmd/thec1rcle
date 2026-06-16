'use client';

export type ChartMetric = 'revenue' | 'clicks' | 'sales';

export function AnalyticsAreaChart({
  data,
  metric,
}: {
  data: { date: string; value: number }[];
  metric: ChartMetric;
}) {
  const svgH = 220;
  const svgW = 700;
  const padX = 40;
  const padY = 24;
  const usableH = svgH - padY * 2;
  const usableW = svgW - padX * 2;
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  const colors: Record<ChartMetric, string> = {
    revenue: '#22c55e',
    clicks: '#3b82f6',
    sales: '#8b5cf6',
  };
  const color = colors[metric];

  const coords = data.map((d, i) => [
    padX + (i / Math.max(data.length - 1, 1)) * usableW,
    padY + usableH - (d.value / maxVal) * usableH,
  ]);

  const linePath = coords
    .map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`))
    .join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${svgH - padY} L${coords[0][0]},${svgH - padY} Z`;

  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = Math.round((maxVal / ySteps) * (ySteps - i));
    return {
      y: padY + (i / ySteps) * usableH,
      label: metric === 'revenue' ? `₹${(val / 1000).toFixed(0)}k` : val.toString(),
    };
  });

  // X-axis labels (show ~5)
  const xStep = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data
    .filter((_, i) => i % xStep === 0 || i === data.length - 1)
    .map((d, idx, arr) => {
      const originalIdx = data.indexOf(d);
      return {
        x: padX + (originalIdx / Math.max(data.length - 1, 1)) * usableW,
        label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      };
    });

  return (
    <div className="w-full overflow-hidden rounded-2xl" style={{ background: 'var(--v-elevated)' }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 220 }}
      >
        <defs>
          <linearGradient id={`analytics-fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <line
            key={i}
            x1={padX}
            y1={yl.y}
            x2={svgW - padX + 10}
            y2={yl.y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Y labels */}
        {yLabels.map((yl, i) => (
          <text
            key={i}
            x={padX - 8}
            y={yl.y + 4}
            textAnchor="end"
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            fontWeight="700"
          >
            {yl.label}
          </text>
        ))}

        {/* X labels */}
        {xLabels.map((xl, i) => (
          <text
            key={i}
            x={xl.x}
            y={svgH - 6}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            fontWeight="700"
          >
            {xl.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#analytics-fill-${metric})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {coords.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="3"
            fill={color}
            stroke="var(--v-card)"
            strokeWidth="1.5"
            opacity={data.length <= 14 ? 1 : 0}
          />
        ))}
      </svg>
    </div>
  );
}
