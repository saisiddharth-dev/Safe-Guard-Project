import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Area, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, Stat, useFetch, Spinner, RiskBadge, Progress, SectionTitle, StatusBadge, fmt, Icon, Empty } from '../components/UI';
import WhatIfSimulator from '../components/WhatIfSimulator';
import { ALL_LSRS, LSR_META } from '../api';
import { useI18n } from '../i18n';

const TT_STYLE = { background: '#0e1628', border: '1px solid #24365c', borderRadius: 8, fontSize: 12 };
const AX_TICK = { fill: '#94a3b8', fontSize: 11 };
const AX_STROKE = '#24365c';
const GRID_STROKE = '#1b2947';

const RISK_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', Unrated: '#94a3b8' };
const TYPE_PALETTE = ['#2f7cf6', '#8b5cf6', '#06b6d4', '#ec4899'];

function Donut({ data, nameKey = 'name', valueKey = 'value', colors, center, t }) {
  const rows = Array.isArray(data) ? data : [];
  const total = rows.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);

  const Tip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    const c = colors[d[nameKey]] || '#475569';
    const v = Number(d[valueKey]) || 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    return (
      <div className="pie-tip" style={{ background: '#0e1628', border: '1px solid #24365c', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.35)', padding: '8px 10px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{t(d[nameKey])}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#ffffff' }}>{fmt.num(v)} reports</div>
        {pct > 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>{pct}%</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-full max-w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart className="pie-sectors">
            <Pie
              data={rows}
              dataKey={valueKey}
              nameKey={nameKey}
              innerRadius="75%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="none"
              isAnimationActive={true}
              animationDuration={800}
            >
              {rows.map((d) => <Cell key={d[nameKey]} fill={colors[d[nameKey]] || '#475569'} />)}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[30px] font-extrabold leading-none text-[var(--surf-text)]">{fmt.num(total)}</span>
          <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--chart-tick)]">{center}</span>
        </div>
      </div>
      <div className="w-full min-w-0 flex-1 space-y-1.5">
        {rows.map((d) => (
          <div key={d[nameKey]} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 shrink-0 rounded-md" style={{ background: colors[d[nameKey]] || '#475569' }} />
            <span className="flex-1 truncate font-semibold text-slate-700">{t(d[nameKey])}</span>
            <span className="font-extrabold text-slate-900">{fmt.num(d[valueKey])}</span>
            <span className="w-11 text-right font-bold text-slate-500">{total ? Math.round(((Number(d[valueKey]) || 0) / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function insightized(rows, t) {
  const a = Array.isArray(rows) ? rows.slice() : [];
  a.sort((a, b) => b.n - a.n);
  return a;
}

function riskDots(n, t) {
  const v = Number(n) || 0;
  return v > 0.5 ? ['●●●●●', t('High')] : v > 0.2 ? ['●●●', t('Medium')] : ['●●', t('Low')];
}

function regionColor(d) {
  if (d.density > 0.5) return 'text-red-400';
  if (d.density > 0.2) return 'text-amber-400';
  return 'text-emerald-400';
}

export default function CommandCenter() {
  const { t } = useI18n();
  const { data, loading } = useFetch('/dashboard');
  const [expanded, setExpanded] = useState('');
  const [trendView, setTrendView] = useState('monthly');

  const regionAgg = useMemo(() => {
    if (!data?.heatmap) return [];
    const map = {};
    for (const s of data.heatmap) {
      map[s.region] = map[s.region] || { region: s.region, reports: 0, sif: 0, density: 0, sites: [] };
      map[s.region].reports += s.reports;
      map[s.region].sif += s.sif;
      map[s.region].sites.push(s);
    }
    return Object.values(map).map((r) => ({ ...r, density: +(r.sif / (r.reports || 1)).toFixed(3) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return <Spinner />;

  const kpis = data.kpis || [];
  const sparkOf = (k) => {
    if (k === 'reports') return (data.trend || []).map((p) => p.reports);
    if (k === 'sif') return (data.trend || []).map((p) => p.sif);
    if (k === 'critical') return (data.trend || []).map((p) => p.critical);
    if (k === 'capa') return (data.capa_trend || []).map((p) => p.n);
    return [];
  };
  const riskData = (data.risk_dist || []).map((d) => ({ name: d.level, value: d.n }));
  const typeData = (data.type_dist || []).map((d, i) => ({ name: d.type, value: d.n, _i: i }));
  const typeColors = Object.fromEntries(typeData.map((d, i) => [d.name, TYPE_PALETTE[i % TYPE_PALETTE.length]]));
  const barrierData = (data.barrier_dist || []).map((b) => ({ barrier: b.barrier, Reports: b.n, SIF: b.sif }));
  const shiftData = (data.shift_dist || []).map((s) => ({ ...s, sif_pct: s.n ? Math.round((s.sif / s.n) * 100) : 0 }));
  const weekData = (data.weekly_trend || []).map((w) => ({ ...w, week: String(w.week || '').slice(5), fullWeek: String(w.week || ''), density_pct: Math.round((+w.density || 0) * 1000) / 10 }));
  const periodData = (data.period_compare || []).map((p) => ({ period: t(p.period), reports: p.reports, sif: p.sif, critical: p.critical }));
  const topSites = [...(data.heatmap || [])].sort((a, b) => b.density - a.density).slice(0, 5);

  const night = shiftData.find((s) => s.shift === 'Night');
  const day = shiftData.find((s) => s.shift === 'Day');
  const shiftDiff = day && night ? Math.round(((night.sif_pct - day.sif_pct) / (day.sif_pct || 1)) * 100) : 0;

  const tm = periodData.find((p) => p.period === t('This month'));
  const pv = periodData.find((p) => p.period === t('Previous month'));
  const reportDelta = tm && pv && pv.reports ? Math.round(((tm.reports - pv.reports) / pv.reports) * 1000) / 10 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="satellite" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Command Center')}</span></h1>
          <p className="text-sm text-slate-500">{t('Enterprise SIF risk · what requires attention now')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={t('{n} active alerts', { n: data.alerts_active })} />
          <WhatIfSimulator
            daily_trend={data.daily_trend || []}
            top_failed_barriers={data.top_failed_barriers || []}
            lsr={data.top_risk || []}
            activities={data.top_activities || []}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Stat
            key={k.key}
            label={t(k.label)}
            value={fmt.num(k.value)}
            delta={k.delta ?? undefined}
            sub={k.key === 'sif' ? t('SIF-potential {pct}', { pct: fmt.pct(data.sif_density) }) : k.key === 'capa' ? t('{n} overdue', { n: k.overdue || 0 }) : undefined}
            danger={k.key === 'critical'}
            icon={k.key === 'sif' ? <Icon name="bomb" size={18} /> : k.key === 'reports' ? <Icon name="report" size={18} /> : k.key === 'critical' ? <Icon name="siren" size={18} /> : <Icon name="check" size={18} />}
            accent={k.key === 'sif' ? '#f59e0b' : k.key === 'critical' ? '#ef4444' : k.key === 'reports' ? '#2f7cf6' : '#10b981'}
            spark={sparkOf(k.key)}
          />
        ))}
      </div>

      {/* Secondary KPIs strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          [t('Near Miss'), data.near_miss, <Icon key="i1" name="bomb" size={18} />], [t('Barrier Failures'), data.barrier_failures, <Icon key="i2" name="wall" size={18} />],
          [t('LSR Violations'), data.lsr_violations, <Icon key="i3" name="ban" size={18} />], [t('Recurring Precursors'), data.recurring_precursors, <Icon key="i4" name="repeat" size={18} />],
          [t('Top Activity'), data.top_activity || '—', <Icon key="i5" name="wrench" size={18} />], [t('Top Site'), data.top_site?.site || '—', <Icon key="i6" name="pin" size={18} />],
        ].map(([l, v, ic]) => (
          <Card key={l} className="flex items-center gap-3 transition-all duration-200 ease-out hover:-translate-y-1.5 hover:shadow-lg hover:shadow-slate-900/10 hover:border-brand/40">
            <div className="text-xl">{ic}</div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</div>
              <div className="truncate text-sm font-bold text-white">{v ?? '—'}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Trend */}
      <Card>
        <SectionTitle
          title={trendView === 'yearly' ? t('SIF Trend — Yearly') : t('SIF Trend — Monthly')}
          sub={trendView === 'yearly' ? t('Yearly report volume and SIF-potential reports') : t('Monthly report volume and SIF-potential reports')}
          right={
            <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
              {[['monthly', t('Monthly')], ['yearly', t('Yearly')]].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setTrendView(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${trendView === v ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          }
        />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={(trendView === 'yearly' ? data.yearly_trend || [] : data.trend || []).map((p) => ({ month: trendView === 'yearly' ? p.year : p.month, reports: p.reports, sif: p.sif }))}
              margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.05} />
              <XAxis dataKey="month" tick={AX_TICK} stroke={AX_STROKE} />
              <YAxis tick={AX_TICK} stroke={AX_STROKE} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="reports" name={t('Reports')} stroke="#2f7cf6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="sif" name={t('SIF-potential')} stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* SIF precursor risk map */}
        <Card className="lg:col-span-2">
          <SectionTitle title={t('SIF-Precursor Risk Map')} sub={t('Regional precursor density (SIF ÷ reports, 90-day)')} />
          <div className="space-y-3">
            {regionAgg.map((r) => (
              <div key={r.region} className="overflow-hidden rounded-lg border border-ink-700">
                <button
                  className="flex w-full items-center gap-3 bg-ink-900 px-3 py-2.5 text-left"
                  onClick={() => setExpanded(expanded === r.region ? '' : r.region)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{r.region}</span>
                  <span className={`font-mono text-xs ${regionColor(r)}`}>{riskDots(r.density, t)[0]} {t(riskDots(r.density, t)[1])}</span>
                  <span className="text-xs text-slate-500">{t('{sif} SIF / {n} rpt', { sif: fmt.num(r.sif), n: fmt.num(r.reports) })}</span>
                </button>
                {expanded === r.region && (
                  <div className="grid gap-2 border-t border-ink-700 p-3 sm:grid-cols-2">
                    {r.sites.map((s) => (
                      <div key={s.site} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 max-w-[10rem] truncate font-semibold text-slate-300">{s.site}</span>
                        <Progress value={s.density * 100} color={s.density > 0.5 ? '#ef4444' : s.density > 0.2 ? '#f59e0b' : '#10b981'} className="flex-1" />
                        <span className="mono text-slate-500">{s.density.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Top risks */}
        <Card>
          <SectionTitle title={t('Top Risk — LSR')} sub={t('Distribution of primary Life-Saving Rules')} />
          <div className="space-y-3">
            {(data.top_risk || []).map((r) => {
              const meta = LSR_META[r.rule] || { icon: 'warn', color: '#94a3b8' };
              return (
                <div key={r.rule}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-slate-200">
                      <Icon name={meta.icon} size={14} /> {t(r.rule)}
                      <span className="chip border border-ink-600 bg-ink-800 text-slate-400">{r.count}</span>
                    </span>
                    <span className="text-xs font-bold text-white">{r.pct}%</span>
                  </div>
                  <Progress value={r.pct} color={meta.color} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">{t('High-risk reports by LSR')}</div>
            <div className="mt-1 text-xl font-extrabold text-white">{fmt.num(data.total_high_risk)}</div>
          </div>
        </Card>
      </div>

      {/* Analysis — distributions */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <SectionTitle title={t('Risk level distribution')} sub={t('All reports by AI risk classification')} />
          {riskData.length ? (
            <Donut data={riskData} colors={RISK_COLORS} center={t('Reports')} t={t} />
          ) : <Empty />}
        </Card>
        <Card>
          <SectionTitle title={t('Report mix by type')} sub={t('Share of each report category')} />
          {typeData.length ? (
            <Donut data={typeData} colors={typeColors} center={t('Reports')} t={t} />
          ) : <Empty />}
        </Card>
        <Card>
          <SectionTitle title={t('Hot sites')} sub={t('By SIF precursor density')} />
          <div className="space-y-3">
            {topSites.map((s) => (
              <div key={s.site}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="min-w-0 max-w-[12rem] truncate font-semibold text-slate-300">{s.site}</span>
                  <span className="text-slate-500">{fmt.num(s.reports)} rpt</span>
                  <span className="font-mono font-bold" style={{ color: s.density > 0.5 ? '#f87171' : s.density > 0.2 ? '#f59e0b' : '#34d399' }}>{s.density.toFixed(2)}</span>
                </div>
                <Progress value={s.density * 100} color={s.density > 0.5 ? '#ef4444' : s.density > 0.2 ? '#f59e0b' : '#10b981'} />
              </div>
            ))}
            {!topSites.length && <Empty />}
          </div>
        </Card>
      </div>

      {/* Analysis — trends & barriers */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t('SIF density — 12 weeks')} sub={t('Weekly report volume vs SIF-potential density')} />
          <div className="h-60 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="wkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f7cf6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2f7cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.05} vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={AX_TICK}
                  stroke={AX_STROKE}
                  tickMargin={6}
                  minTickGap={24}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="l"
                  tick={AX_TICK}
                  stroke={AX_STROKE}
                  width={38}
                  tickMargin={6}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (dataMax) => (dataMax <= 0 ? 10 : Math.ceil(dataMax / 10) * 10)]}
                />
                <YAxis
                  yAxisId="r"
                  orientation="right"
                  tick={AX_TICK}
                  stroke={AX_STROKE}
                  width={40}
                  tickMargin={6}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickCount={5}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={TT_STYLE}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullWeek || ''}
                  formatter={(value, name) => [typeof value === 'number' ? (name.includes('density') || name.includes('%') ? `${value}%` : value.toLocaleString('en-US')) : value, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="l" type="linear" dataKey="reports" name={t('Reports')} stroke="#2f7cf6" fill="url(#wkFill)" strokeWidth={2} />
                <Line yAxisId="r" type="linear" dataKey="density_pct" name={t('SIF density')} stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title={t('Top barrier failures')} sub={t('Reported engineering / process-safety barrier gaps')} />
          {barrierData.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrierData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.05} />
                  <XAxis dataKey="barrier" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke={AX_STROKE} interval={0} angle={-12} height={54} />
                  <YAxis tick={AX_TICK} stroke={AX_STROKE} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Reports" fill="#2f7cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="SIF" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty />}
        </Card>
      </div>

      {/* Analysis — comparisons */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t('Shift comparison')} sub={t('Day vs Night reporting & SIF-potential')} />
          {shiftData.length ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shiftData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.05} />
                    <XAxis dataKey="shift" tick={AX_TICK} stroke={AX_STROKE} />
                    <YAxis tick={AX_TICK} stroke={AX_STROKE} />
                    <Tooltip contentStyle={TT_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="n" name={t('Reports')} fill="#2f7cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sif" name={t('SIF-potential')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {shiftDiff > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2.5 text-xs text-orange-200">
                  <Icon name="search" size={14} className="mt-0.5 shrink-0" />
                  <span>{t('Night-shift SIF density is {pct}% higher than Day shift.', { pct: Math.abs(shiftDiff) })}</span>
                </div>
              )}
            </>
          ) : <Empty />}
        </Card>

        <Card>
          <SectionTitle title={t('Period comparison')} sub={t('This month vs previous month (30-day windows)')} />
          {periodData.length ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.05} />
                    <XAxis dataKey="period" tick={AX_TICK} stroke={AX_STROKE} />
                    <YAxis tick={AX_TICK} stroke={AX_STROKE} />
                    <Tooltip contentStyle={TT_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="reports" name={t('Reports')} fill="#2f7cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sif" name={t('SIF-potential')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="critical" name={t('Critical / High')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {tm && pv && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-md border px-2 py-1 font-semibold ${reportDelta >= 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                    {t('Reports {dir} {v}%', { dir: reportDelta >= 0 ? '▲' : '▼', v: Math.abs(reportDelta) })}
                  </span>
                  <span className="rounded-md border border-slate-600/40 bg-ink-900 px-2 py-1 text-slate-400">
                    {t('SIF {a} vs {b}', { a: fmt.num(tm.sif), b: fmt.num(pv.sif) })}
                  </span>
                  <span className="rounded-md border border-slate-600/40 bg-ink-900 px-2 py-1 text-slate-400">
                    {t('Critical {a} vs {b}', { a: fmt.num(tm.critical), b: fmt.num(pv.critical) })}
                  </span>
                </div>
              )}
            </>
          ) : <Empty />}
        </Card>
      </div>

      {/* Top activities + alerts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t('Top Activities')} sub={t('By SIF-precursor density')} right={<Link to="/precursors" className="flex items-center gap-1 text-xs font-bold text-brand">{t('View all')}<Icon name="arrow" size={13} /></Link>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead><tr><th className="th">#</th><th className="th">{t('Activity')}</th><th className="th">{t('Reports')}</th><th className="th">{t('SIF %')}</th><th className="th">{t('Density')}</th></tr></thead>
              <tbody>
                {insightized(data.top_activities).map((a, i) => (
                  <tr key={a.activity} className="border-t border-ink-700/60">
                    <td className="td text-slate-500">{i + 1}</td>
                    <td className="td font-semibold text-white">{a.activity}</td>
                    <td className="td">{fmt.num(a.n)}</td>
                    <td className="td">{Math.round((a.sif / (a.n || 1)) * 100)}%</td>
                    <td className="td"><span className="font-mono font-bold" style={{ color: a.density > 0.5 ? '#f87171' : a.density > 0.2 ? '#f59e0b' : '#34d399' }}>{a.density.toFixed(2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle title={t('Active Alerts')} sub={t('Require immediate attention')} right={<Link to="/alerts" className="flex items-center gap-1 text-xs font-bold text-brand">{t('Alert center')}<Icon name="arrow" size={13} /></Link>} />
          <div className="space-y-2.5">
            {(data.alert_previews || []).map((a, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
                <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${a.severity === 'critical' ? 'border-red-500/30 bg-red-500/15 text-red-400' : 'border-amber-500/30 bg-amber-500/15 text-amber-400'}`}>
                  <Icon name={a.severity === 'critical' ? 'siren' : 'warn'} size={12} /> {t(a.severity)}
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{a.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{a.message}</div>
                </div>
              </div>
            ))}
            {!data.alert_previews?.length && <div className="text-sm text-slate-500">{t('Use the Alert center for the live feed.')}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}