import { useState, useEffect } from 'react';
import { Target, TrendingUp, Ban } from 'lucide-react';
import { api } from '../api';
import { Card, Tabs, useFetch, Spinner, Empty, SectionTitle, Progress, HeatCell, fmt, Icon, Dot } from '../components/UI';
import { useI18n } from '../i18n';

export default function SIFPrecursors() {
  const { t } = useI18n();
  const [tab, setTab] = useState('patterns');
  const precursors = useFetch('/analytics/precursors');
  const activities = useFetch('/analytics/activities');
  const barriers = useFetch('/analytics/barriers');
  const sites = useFetch('/analytics/sites');
  const heatmap = useFetch('/analytics/heatmap');
  const [aiPatterns, setAiPatterns] = useState(null);

  // AI-driven pattern detection from report data
  useEffect(() => {
    if (aiPatterns) return;
    api.get('/reports?limit=400').then(async (r) => {
      const docs = r.reports.map((x) => ({
        id: x.id, activity: x.activity, barrier_failure: x.barrier_failure,
        site: x.site_name, created_at: x.created_at, sif_potential: x.sif_potential,
      }));
      try { const p = await api.post('/patterns', { reports: docs, window_days: 90 }); setAiPatterns(p); } catch { setAiPatterns(null); }
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="target" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('SIF Precursors')}</span></h1>
        <p className="text-sm text-slate-500">{t('Pattern discovery · precursor density · barrier intelligence')}</p>
      </div>

      <Tabs tabs={[
        { id: 'patterns', label: t('Patterns') }, { id: 'activities', label: t('Activities') },
        { id: 'locations', label: t('Locations') }, { id: 'barriers', label: t('Barriers') },
        { id: 'emerging', label: t('Emerging Risks') },
      ]} active={tab} onChange={setTab} />

      {aiPatterns?.alerts?.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-red-300"><TrendingUp size={15} /> {t('AI-Detected Emerging Patterns')}</div>
          {aiPatterns.alerts.map((a, i) => (
            <div key={i} className="mt-2 flex items-start gap-1.5 text-xs text-red-200"><Icon name="siren" size={13} className="mt-0.5 shrink-0" /> <span><b>{a.title}</b> — {a.message}</span></div>
          ))}
        </div>
      )}

      {tab === 'patterns' && <PatternsTab data={precursors} ai={aiPatterns} />}
      {tab === 'activities' && <ActivitiesTab data={activities} />}
      {tab === 'locations' && <LocationsTab data={sites} />}
      {tab === 'barriers' && <BarriersTab data={barriers} />}
      {tab === 'emerging' && <EmergingTab data={precursors} />}
    </div>
  );
}

function PatternsTab({ data, ai }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const patterns = data.data?.patterns || [];
  return (
    <div className="grid gap-4 sm:grid-cols-2 items-start">
      {patterns.map((p) => (
        <Card key={p.id} className="fade-up">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Target size={15} className="shrink-0 text-brand" /> <span className="min-w-0 break-words">{p.title}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">{p.category}</div>
            </div>
            <span className={`chip shrink-0 ${p.trend === 'EMERGING' ? 'bg-red-500/15 text-red-400' : p.trend === 'RECURRING' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'}`}>{t(p.trend)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">{p.description}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric l={t('Reports')} v={p.report_count} />
            <Metric l={t('Sites')} v={p.site_count} />
            <Metric l={t('Locations')} v={p.sites} small />
          </div>
        </Card>
      ))}

      {ai?.patterns?.length > 0 && (
        <Card className="border-brand/40">
          <SectionTitle title={t('AI precursor intelligence')} sub={t('Computed live from report texts')} />
          {ai.patterns.map((p, i) => (
            <div key={i} className="mb-2 rounded-lg border border-ink-700 bg-ink-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-semibold text-white">{p.activity} → {p.barrier}</span>
                <span className="chip shrink-0 border border-ink-600 bg-ink-800 text-slate-400">n={p.count}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{p.sentence}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Metric({ l, v, small }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-1.5 sm:p-2">
      <div className={`break-words leading-tight ${small ? 'text-[11px] font-bold text-white' : 'text-lg font-extrabold text-white'}`}>{v ?? '—'}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase leading-tight text-slate-500 sm:text-[10px]">{l}</div>
    </div>
  );
}

function ActivitiesTab({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = data.data?.activities || [];
  return (
    <Card>
      <SectionTitle title={t('Activity Risk Ranking')} sub={t('SIF-precursor density per activity — ranked for intervention targeting')} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="th">{t('Rank')}</th><th className="th">{t('Activity')}</th><th className="th">{t('Reports')}</th><th className="th">{t('SIF %')}</th><th className="th">{t('Critical')}</th><th className="th">{t('Density')}</th></tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.activity} className="border-t border-ink-700/60">
                <td className="td">{i === 0 ? <Dot className="bg-red-500" /> : i === 1 ? <Dot className="bg-orange-500" /> : i === 2 ? <Dot className="bg-amber-400" /> : i + 1}</td>
                <td className="td font-semibold text-white">{a.activity}</td>
                <td className="td">{fmt.num(a.reports)}</td>
                <td className="td">{a.sif_pct}%</td>
                <td className="td">{fmt.num(a.critical)}</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Progress value={a.density * 100} color={a.density > 0.5 ? '#ef4444' : a.density > 0.2 ? '#f59e0b' : '#10b981'} className="w-20" />
                    <span className="font-mono text-xs font-bold text-white">{a.density.toFixed(2)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LocationsTab({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = data.data?.sites || [];
  return (
    <Card>
      <SectionTitle title={t('Site Risk Ranking')} sub={t('Normalized by report volume — high reporting ≠ poor safety')} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr><th className="th">{t('Site')}</th><th className="th">{t('Region')}</th><th className="th">{t('State')}</th><th className="th">{t('Field')}</th><th className="th">{t('Reports')}</th><th className="th">{t('SIF')}</th><th className="th">{t('Critical')}</th><th className="th">{t('Density')}</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-ink-700/60">
                <td className="td font-semibold text-white">{s.name}</td>
                <td className="td">{s.region}</td>
                <td className="td">{s.state}</td>
                <td className="td text-slate-400">{s.field}</td>
                <td className="td">{fmt.num(s.reports)}</td>
                <td className="td">{fmt.num(s.sif)}</td>
                <td className="td text-red-400">{fmt.num(s.critical)}</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Progress value={s.density * 100} color={s.density > 0.5 ? '#ef4444' : s.density > 0.2 ? '#f59e0b' : '#10b981'} className="w-24" />
                    <span className="font-mono text-xs font-bold text-white">{s.density.toFixed(2)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BarriersTab({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = data.data?.barriers || [];
  const max = Math.max(...rows.map((b) => b.count), 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t('Top failing barriers')} sub={t('Share of barrier-failure observations')} />
        <div className="space-y-4">
          {rows.map((b, i) => (
            <div key={b.barrier}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200">{i + 1}. {b.barrier}</span>
                <span className="font-bold text-white">{b.pct}%</span>
              </div>
              <Progress value={(b.count / max) * 100} color={b.pct > 20 ? '#ef4444' : b.pct > 10 ? '#f59e0b' : '#10b981'} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle title={t('Barrier detail')} sub={t('Density and SIF-potential share per failing barrier')} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead><tr><th className="th">{t('Barrier')}</th><th className="th">{t('Count')}</th><th className="th">{t('SIF-pot.')}</th><th className="th">{t('Density')}</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.barrier} className="border-t border-ink-700/60">
                  <td className="td"><span className="flex items-center gap-1.5 font-semibold text-white"><Icon name="wall" size={13} /> {b.barrier}</span></td>
                  <td className="td">{fmt.num(b.count)}</td>
                  <td className="td">{fmt.num(b.sif)}</td>
                  <td className="td font-mono text-xs text-white">{b.density.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function EmergingTab({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const patterns = (data.data?.patterns || []).filter((p) => p.trend === 'EMERGING' || p.trend === 'RECURRING');
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-center gap-2 font-bold text-white"><Ban size={16} className="text-red-400" /> {t('What the AI watches')}</div>
        <div className="mt-2 grid gap-2 text-sm text-red-200 sm:grid-cols-3">
          <div className="flex items-start gap-1.5"><Icon name="repeat" size={14} className="mt-0.5 shrink-0" /> <span><b>{t('Temporal')}</b> — {t('Monday mornings, night shifts, month-end, shutdowns')}</span></div>
          <div className="flex items-start gap-1.5"><Icon name="wrench" size={14} className="mt-0.5 shrink-0" /> <span><b>{t('Operational')}</b> — {t('maintenance, hot work, lifting campaigns')}</span></div>
          <div className="flex items-start gap-1.5"><Icon name="env" size={14} className="mt-0.5 shrink-0" /> <span><b>{t('Environmental')}</b> — {t('rain, heat, poor visibility, remote sites')}</span></div>
        </div>
      </div>
<div className="grid gap-4 sm:grid-cols-2 items-start">
        {patterns.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-sm font-bold text-white">{p.title}</span>
              <span className={`chip shrink-0 ${p.trend === 'EMERGING' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{t(p.trend)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{p.description}</p>
            <div className="mt-2 text-xs text-slate-500">{t('{reports} reports · {sites} sites · {locations}', { reports: p.report_count, sites: p.site_count, locations: p.sites })}</div>
          </Card>
        ))}
        {!patterns.length && <Empty />}
      </div>
    </div>
  );
}