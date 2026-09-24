import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { Card, Icon, useFetch, Empty, fmt } from '../components/UI';
import ReportSifTrendChart from '../components/ReportSifTrendChart';
import { useI18n } from '../i18n';

const SURF = {
  card: 'rounded-2xl border border-[var(--surf-border)] bg-[var(--surf-bg)] ana-card-shadow',
  title: 'text-[17px] font-semibold text-[var(--surf-text)]',
  sub: 'text-[13px] text-[var(--surf-muted)]',
  grid: 'var(--chart-grid)',
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthLabel(raw) {
  const [y, m] = String(raw || '').split('-');
  const mi = Math.max(0, Math.min(11, Number(m) - 1));
  return `${MONTH_SHORT[mi]} '${String(y || '').slice(2)}`;
}
function niceMax(v) {
  if (!(v > 0)) return 5;
  return Math.ceil(v * 1.25);
}

function ACard({ title, sub, right, children, className = '' }) {
  return (
    <section className={`${SURF.card} p-5 sm:p-6 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={SURF.title}>{title}</h3>
          {sub && <p className="mt-1 text-[13px] text-[var(--surf-muted)]">{sub}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function SkeletonChart({ className = 'h-[220px] sm:h-[260px] xl:h-[320px]' }) {
  return (
    <div className="space-y-3">
      <div className={`${className} w-full`}><div className="ana-skeleton h-full w-full" /></div>
      <div className="flex gap-2"><div className="ana-skeleton h-10 w-24" /><div className="ana-skeleton h-10 w-28" /><div className="ana-skeleton h-10 w-32" /></div>
    </div>
  );
}

function ProgressRing({ pct, color, size = 54, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = c * (Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[var(--surf-text)]">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function ShiftStat({ shift, pct, sif, n, color, bar }) {
  const { t } = useI18n();
  return (
    <div className="ana-card-shadow-hover relative overflow-hidden rounded-2xl border border-[var(--surf-border)] bg-[var(--surf-bg)] p-5 transition-all duration-200 ease-out">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: bar }} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--surf-muted)]">{t(shift)} {t('Shift')}</div>
          <div className="mt-1 text-[32px] font-extrabold leading-none text-[var(--surf-text)] sm:text-[36px]">{pct}%</div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--surf-border-strong)] bg-[var(--surf-fill)] px-2.5 py-1 text-[11px] font-semibold text-[var(--surf-soft-text)]">
            {t('{sif} SIF / {n} reports', { sif: fmt.num(sif) || '0', n: fmt.num(n) || '0' })}
          </span>
        </div>
        <ProgressRing pct={pct} color={color} />
      </div>
    </div>
  );
}

function AiPatternBanner({ diff }) {
  const { t } = useI18n();
  if (!(diff > 0)) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border-l-4 border-amber-500 p-4" style={{ background: 'linear-gradient(90deg, var(--banner-from), var(--banner-to))' }}>
      <div className="flex items-start gap-3">
        <span className="ai-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Icon name="search" size={17} />
        </span>
        <p className="text-[13px] leading-relaxed text-[var(--banner-text)]">
          <b className="font-bold text-amber-700">{t('AI pattern:')} </b>
          {t('Night-shift reports show {pct}% higher SIF-precursor density. Targeted night-shift investigation recommended.', { pct: Math.abs(diff) })}
        </p>
      </div>
    </div>
  );
}

function WeekdayChart({ data }) {
  const { t } = useI18n();
  if (!data.length) return <Empty message={t('No weekday data yet.')} />;
  const maxN = Math.max(...data.map((w) => w.n), 0);
  return (
    <div className="h-[220px] w-full sm:h-[260px] xl:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 6, left: 4, bottom: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="wdBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal vertical={false} stroke={SURF.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
            dy={6}
          />
          <YAxis hide domain={[0, niceMax(maxN)]} />
          <Tooltip
            cursor={{ fill: 'var(--chart-cursor)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              return (
                <div className="rounded-2xl border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-4 py-3 shadow-[0_8px_24px_rgba(2,8,23,0.25)]">
                  <div className="mb-1 text-[13px] font-bold text-[var(--surf-text)]">{t(label)}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                    <span className="text-[var(--surf-muted)]">{t('Reports')}</span>
                    <span className="ml-auto pl-4 font-mono text-[13px] font-bold text-[var(--surf-text)]">{fmt.num(payload[0].value)}</span>
                  </div>
                </div>
              );
            }}
            isAnimationActive={false}
          />
          <Bar dataKey="n" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((w, i) => (
              <Cell key={w.name} fill={w.n === maxN && w.n > 0 ? '#F59E0B' : 'url(#wdBrand)'} />
            ))}
            <LabelList
              dataKey="n"
              position="top"
              style={{ fontSize: 12, fontWeight: 800, fill: 'var(--surf-text)' }}
              formatter={(v) => fmt.num(v)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const WATCH_PILL = {
  Temporal: { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'repeat' },
  Operational: { bg: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'wrench' },
  Environmental: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'env' },
};

function Watchlist() {
  const { t } = useI18n();
  const rows = [
    ['Temporal', 'Monday mornings · Night shifts · Month-end · Shutdowns'],
    ['Operational', 'Maintenance campaigns · Contractor work · Hot work surges'],
    ['Environmental', 'Rain season · Extreme heat · Poor visibility · Remote sites'],
  ];
  return (
    <div>
      <div className="divide-y divide-[var(--chart-grid)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${WATCH_PILL[k]?.bg}`}>
              <Icon name={WATCH_PILL[k]?.icon || 'search'} size={12} />
              {t(k)}
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--surf-soft-text)] sm:flex-1 sm:text-right">{t(v)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border-l-4 border-rose-500 bg-rose-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <Icon name="warn" size={17} />
          </span>
          <div>
            <h4 className="text-[13px] font-bold text-rose-700">{t('Anomaly detection')}</h4>
            <p className="mt-1 text-[13px] leading-[1.6] text-rose-900/80">
              {t('Reports from Site B suddenly increased 240% → flagged. Line-of-fire observations unusually high vs historical baseline → flagged.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivitiesChart({ data }) {
  const { t } = useI18n();
  if (!data.length) return <Empty message={t('No activity data yet.')} />;
  return (
    <div className="h-[220px] w-full sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barGap={3}>
          <defs>
            <linearGradient id="actReports" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f7cf6" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
            <linearGradient id="actSif" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FCD34D" />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal vertical={false} stroke={SURF.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-15}
            height={52}
            dy={6}
            textAnchor="end"
          />
          <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={fmt.num} />
          <Tooltip
            cursor={{ fill: 'var(--chart-cursor)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              return (
                <div className="rounded-2xl border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-4 py-3 shadow-[0_8px_24px_rgba(2,8,23,0.25)]">
                  <div className="mb-1.5 text-[13px] font-bold text-[var(--surf-text)]">{label}</div>
                  {payload.map((it) => (
                    <div key={it.dataKey} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.dataKey === 'n' ? '#2f7cf6' : '#F59E0B' }} />
                      <span className="text-[var(--surf-muted)]">{it.name}</span>
                      <span className="ml-auto pl-4 font-mono text-[13px] font-bold text-[var(--surf-text)]">{fmt.num(it.value)}</span>
                    </div>
                  ))}
                </div>
              );
            }}
            isAnimationActive={false}
          />
          <Bar dataKey="n" name={t('Reports')} fill="url(#actReports)" radius={[5, 5, 0, 0]} maxBarSize={26} />
          <Bar dataKey="sif" name={t('SIF-potential')} fill="url(#actSif)" radius={[5, 5, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2"><div className="ana-skeleton h-8 w-52" /><div className="ana-skeleton h-4 w-80 max-w-full" /></div>
      <div className="grid gap-5 min-[1200px]:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${SURF.card} p-5 sm:p-6`}>
            <div className="space-y-2"><div className="ana-skeleton h-5 w-48" /><div className="ana-skeleton h-4 w-64 max-w-full" /></div>
            <div className="mt-4"><SkeletonChart /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useFetch('/analytics/trends');

  if (loading) return <AnalyticsSkeleton />;

  const d = data || {};
  const errorBox = error ? (
    <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon name="warn" size={22} className="text-red-400" />
      <p className="text-sm text-[var(--surf-soft-text)]">{t('Could not load analytics. Backend offline?')}</p>
      <button className="btn-primary mt-1" onClick={reload}>{t('Retry')}</button>
    </Card>
  ) : null;

  const byShift = d.by_shift || [];
  const shift = byShift.map((s) => ({ ...s, sif_pct: Math.round((s.sif / (s.n || 1)) * 100) }));
  const night = shift.find((s) => s.shift === 'Night');
  const day = shift.find((s) => s.shift === 'Day');
  const diff = day && night ? Math.round(((night.sif_pct - day.sif_pct) / (day.sif_pct || 1)) * 100) : 0;

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wd = [...(d.weekday || [])]
    .sort((a, b) => (Number(a.dow) || 0) - (Number(b.dow) || 0))
    .map((w) => ({ name: weekdays[Number(w.dow) || 0], label: t(weekdays[Number(w.dow) || 0]).slice(0, 3), n: Number(w.count ?? w.n) || 0 }));

  const trend = (d.trend || []).map((tt) => ({
    month: monthLabel(tt.d),
    reports: tt.n,
    sifPotential: tt.sif,
    energyIsolation: tt.energy_iso,
  }));

  const acts = (d.activities || []).map((a) => ({ ...a, name: a.activity }));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      {errorBox}

      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="chart" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Analytics')}</span></h1>
        <p className="mt-0.5 text-sm text-slate-500">{t('Trends · shift intelligence · patterns · forecasting')}</p>
      </header>

      <div className="grid gap-5 min-[1200px]:grid-cols-2">
        <ACard title={t('Report & SIF trend — 6 months')} sub={t('Monthly volume')}>
          {trend.length ? (
            <ReportSifTrendChart
              data={trend}
              labels={{ reports: t('Reports'), sifPotential: t('SIF-potential'), energyIsolation: t('Energy isolation') }}
            />
          ) : (
            <Empty message={t('No trend data yet.')} />
          )}
        </ACard>

        <ACard title={t('Shift intelligence')} sub={t('SIF-precursor density by shift — a leading safety indicator')}>
          {shift.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ShiftStat shift="Day" pct={day?.sif_pct || 0} sif={day?.sif || 0} n={day?.n || 0} color="#2563EB" bar="linear-gradient(90deg,#2563EB,#60A5FA)" />
              <ShiftStat shift="Night" pct={night?.sif_pct || 0} sif={night?.sif || 0} n={night?.n || 0} color="#6366F1" bar="linear-gradient(90deg,#6366F1,#A5B4FC)" />
            </div>
          ) : (
            <Empty message={t('No shift data yet.')} />
          )}
          <div className="mt-4"><AiPatternBanner diff={diff} /></div>
        </ACard>

        <ACard title={t('Weekday pattern')} sub={t('Reporting volume by day of week')}>
          <WeekdayChart data={wd} />
        </ACard>

        <ACard title={t('Pattern watchlist')} sub={t('What the AI monitors continuously')}>
          <Watchlist />
        </ACard>
      </div>

      <ACard title={t('Top activities trend')} sub={t('Report & SIF volume by core activity')}>
        <ActivitiesChart data={acts} />
      </ACard>
    </div>
  );
}