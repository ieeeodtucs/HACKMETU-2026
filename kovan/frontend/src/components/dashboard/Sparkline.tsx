export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#4fc3f7",
  fillOpacity = 0.15,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const maxSlots = 60;
  const slots = Math.max(data.length - 1, maxSlots - 1);

  const points = data.map((val, i) => {
    const slotIndex = slots - (data.length - 1) + i;
    const x = padding + (slotIndex / slots) * w;
    const y = padding + h - ((val - min) / range) * h;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${padding + w},${padding + h} L ${padding},${padding + h} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="metrics-sparkline">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
