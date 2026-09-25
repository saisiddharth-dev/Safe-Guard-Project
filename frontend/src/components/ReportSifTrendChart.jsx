import { useState, useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SERIES = [
  { key: 'reports', fill: '#0C4A6E', stroke: '#082F49', gradientTop: 0.85, gradientBottom: 0.08 },
  { key: 'sifPotential', fill: '#0284C7', stroke: '#0369A1', gradientTop: 0.85, gradientBottom: 0.08 },
  { key: 'energyIsolation', fill: '#7DD3FC', stroke: '#38BDF8', gradientTop: 0.85, gradientBottom: 0.08 },
];

const numFmt = (v) => Number(v || 0).toLocaleString('en-US');

function niceCeil(m) {
  if (!(m > 0)) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(m)));
  for (const mult of [1, 2, 5, 10]) {
    if (m <= mult * base) return mult * base;
  }
  return base * 10;
}

function TrendTip({ active, payload, label, labels }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-4 py-3 shadow-[0_8px_24px_rgba(2,8,23,0.25)]">
      <div className="mb-2 text-[13px] font-bold text-[var(--surf-text)]">{label}</div>
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES.find((s) => s.key === item.dataKey)?.fill || item.color }} />
            <span className="text-[var(--surf-muted)]">{labels[item.dataKey] || item.dataKey}</span>
            <span className="ml-auto pl-4 font-mono text-[13px] font-bold text-[var(--surf-text)]">{numFmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendChip({ serie, label, hidden, active, onToggle, onHover, onLeave }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      className={`flex min-h-[40px] items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold transition-opacity duration-150 ${
        active || hidden ? 'opacity-50' : 'opacity-100'
      } border-[var(--surf-border-strong)] bg-[var(--surf-bg)] text-[var(--surf-soft-text)] hover:border-brand/40`}
      aria-pressed={!hidden}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: serie.fill }} />
      {label}
      {hidden && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-[var(--chart-tick)]">off</span>}
    </button>
  );
}

export default function ReportSifTrendChart({
  data = [],
  labels = { reports: 'Reports', sifPotential: 'SIF-potential', energyIsolation: 'Energy isolation' },
}) {
  const uid = useId();
  const [hidden, setHidden] = useState({});
  const [hoverKey, setHoverKey] = useState(null);
  const toggle = (k) => setHidden((h) => ({ ...h, [k]: !h[k] }));
  const total = data.map((r) => (r.reports || 0) + (r.sifPotential || 0) + (r.energyIsolation || 0));
  const yMax = niceCeil(Math.max(...total, 1));
  const visibleCount = SERIES.filter((s) => !hidden[s.key]).length;

  return (
    <div>
      <div className="h-[220px] sm:h-[260px] xl:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`${uid}${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.fill} stopOpacity={s.gradientTop} />
                  <stop offset="95%" stopColor={s.fill} stopOpacity={s.gradientBottom} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid horizontal vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              interval={data.length > 6 ? 1 : 0}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              dy={6}
              tickMargin={8}
            />
            <YAxis
              domain={[0, yMax]}
              tickCount={6}
              tickFormatter={numFmt}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              width={46}
            />
            <Tooltip
              content={<TrendTip labels={labels} />}
              cursor={{ stroke: 'var(--chart-tick)', strokeDasharray: '4 4', strokeOpacity: 0.5 }}
              isAnimationActive={false}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                stackId="1"
                dataKey={s.key}
                name={labels[s.key]}
                stroke={s.stroke}
                strokeWidth={3.5}
                strokeLinecap="round"
                fill={`url(#${uid}${s.key})`}
                dot={false}
                hide={!!hidden[s.key]}
                opacity={hoverKey && hoverKey !== s.key ? 0.3 : 1}
                animationDuration={800}
                animationEasing="ease-out"
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {visibleCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {SERIES.map((s) => (
            <LegendChip
              key={s.key}
              serie={s}
              label={labels[s.key]}
              hidden={!!hidden[s.key]}
              active={hoverKey !== null && hoverKey !== s.key}
              onToggle={() => toggle(s.key)}
              onHover={() => setHoverKey(s.key)}
              onLeave={() => setHoverKey(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}