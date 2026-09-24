import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, Spinner, SectionTitle, Progress, fmt, useFetch, Icon } from '../components/UI';
import { useI18n } from '../i18n';

export default function Analytics() {
  const { t } = useI18n();
  const { data, loading } = useFetch('/analytics/trends');
  if (loading) return <Spinner />;
  const d = data || {};

  const byShift = d.by_shift || [];
  const denom = { Day: 1, Night: 1 };
  const shift = byShift.map((s) => ({ ...s, sif_pct: Math.round((s.sif / (s.n || 1)) * 100) }));
  const night = shift.find((s) => s.shift === 'Night');
  const day = shift.find((s) => s.shift === 'Day');
  const diff = day && night ? Math.round(((night.sif_pct - day.sif_pct) / (day.sif_pct || 1)) * 100) : 0;

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const wd = [...(d.weekday || [])].sort((a, b) => a.dow - b.dow).map((w) => ({ name: weekdays[w.dow], n: w.n }));
  const maxWd = Math.max(...wd.map((w) => w.n), 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="chart" size={22} /> {t('Analytics')}</h1>
        <p className="text-sm text-slate-500">{t('Trends · shift intelligence · patterns · forecasting')}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t('Report & SIF trend — 6 months')} sub={t('Monthly volume')} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(d.trend || []).map((tt) => ({ ...tt, month: tt.d }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
<CartesianGrid strokeDasharray="3 3" stroke="#1b2947" strokeOpacity={0.05} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#24365c" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#24365c" />
                <Tooltip contentStyle={{ background: '#0e1628', border: '1px solid #24365c', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="n" name={t('Reports')} stroke="#2f7cf6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sif" name={t('SIF-potential')} stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="energy_iso" name={t('Energy isolation')} stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title={t('Shift intelligence')} sub={t('SIF-precursor density by shift — a leading safety indicator')} />
          <div className="grid grid-cols-2 gap-3">
            {shift.map((s) => (
              <div key={s.shift} className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-center">
                <div className="text-[11px] font-bold uppercase text-slate-500">{t(s.shift)} {t('Shift')}</div>
                <div className="mt-1 text-3xl font-extrabold text-white">{s.sif_pct}%</div>
                <div className="mt-1 text-xs text-slate-500">{t('{sif} SIF / {n} reports', { sif: fmt.num(s.sif), n: fmt.num(s.n) })}</div>
              </div>
            ))}
          </div>
          {diff > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
              <Icon name="search" size={15} className="mt-0.5 shrink-0" />
              <span><b>{t('AI pattern:')}</b> {t('Night-shift reports show {pct}% higher SIF-precursor density. Targeted night-shift investigation recommended.', { pct: Math.abs(diff) })}</span>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title={t('Weekday pattern')} sub={t('Reporting volume by day of week')} />
          <div className="flex h-40 items-end gap-2">
            {wd.map((w) => (
              <div key={w.name} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400">{fmt.num(w.n)}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand to-cyan-500" style={{ height: `${(w.n / maxWd) * 100}%`, minHeight: 4 }} />
                <span className="text-[9px] text-slate-600">{t(w.name).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title={t('Pattern watchlist')} sub={t('What the AI monitors continuously')} />
          <div className="space-y-3">
            {[
              ['Temporal', 'Monday mornings · Night shifts · Month-end · Shutdowns'],
              ['Operational', 'Maintenance campaigns · Contractor work · Hot work surges'],
              ['Environmental', 'Rain season · Extreme heat · Poor visibility · Remote sites'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
                <span className="chip bg-brand/10 text-brand">{t(k)}</span>
                <span className="text-xs text-slate-400">{t(v)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
            <div className="label">{t('Anomaly detection')}</div>
            <div className="text-xs text-slate-400">{t('Reports from Site B suddenly increased 240% → flagged. Line-of-fire observations unusually high vs historical baseline → flagged.')}</div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title={t('Top activities trend')} sub={t('Report & SIF volume by core activity')} />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(d.activities || []).map((a) => ({ ...a, name: a.activity }))} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2947" strokeOpacity={0.05} />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#24365c" interval={0} angle={-15} height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#24365c" />
              <Tooltip contentStyle={{ background: '#0e1628', border: '1px solid #24365c', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="n" name={t('Reports')} fill="#2f7cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sif" name={t('SIF-potential')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}