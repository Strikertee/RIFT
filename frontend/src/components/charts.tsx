import { useId } from 'react';
import { cn } from './ui';

export function CashflowChart({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const moneyIn = [4200, 6100, 3800, 7200, 5400, 6900, 4800];
  const moneyOut = [3100, 4400, 3600, 5100, 4300, 5600, 4000];
  const max = 8200;
  const w = 620;
  const h = 170;
  const pad = 12;
  const step = (w - pad * 2) / (moneyIn.length - 1);

  const points = (values: number[]) =>
    values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);

  const smooth = (pts: ReadonlyArray<readonly [number, number]>) => {
    if (!pts.length) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx = (prev[0] + curr[0]) / 2;
      d += ` C ${cx} ${prev[1]}, ${cx} ${curr[1]}, ${curr[0]} ${curr[1]}`;
    }
    return d;
  };

  const inPts = points(moneyIn);
  const outPts = points(moneyOut);
  const inPath = smooth(inPts);
  const outPath = smooth(outPts);
  const area = `${inPath} L ${inPts[inPts.length - 1][0]} ${h - pad} L ${inPts[0][0]} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-[170px] w-full', className)} role="img" aria-label="Cash flow for the last seven days">
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(48 209 88)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="rgb(48 209 88)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * t} y2={pad + (h - pad * 2) * t} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray="3 6" />
      ))}
      <path d={area} fill={`url(#fill-${id})`} />
      <path d={inPath} fill="none" stroke="rgb(48 209 88)" strokeWidth="2.5" strokeLinecap="round" />
      <path d={outPath} fill="none" stroke="rgb(255 178 36)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 5" opacity="0.8" />
      {inPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill="rgb(10 15 13)" stroke="rgb(48 209 88)" strokeWidth="2" />
      ))}
    </svg>
  );
}

export function Donut({
  segments,
  centerTop,
  centerBottom,
  className,
}: {
  segments: Array<{ value: number; color: string }>;
  centerTop: string;
  centerBottom: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className={cn('relative h-[150px] w-[150px]', className)}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgb(var(--line))" strokeWidth="15" opacity="0.6" />
        {segments.map((segment, i) => {
          const length = (segment.value / total) * circumference;
          const dash = `${Math.max(0, length - 4)} ${circumference - Math.max(0, length - 4)}`;
          const el = (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="15"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += length;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="label">{centerTop}</span>
        <span className="num mt-1 text-[19px] font-semibold">{centerBottom}</span>
      </div>
    </div>
  );
}

export function Ring({
  percent,
  size = 92,
  stroke = 9,
  className,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(36 26 4 / .35)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(36 26 4)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = 120;
  const h = 34;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-8 w-28', className)} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="rgb(48 209 88)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
