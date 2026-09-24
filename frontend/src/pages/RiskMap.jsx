import { useState } from 'react';
import { MapPin, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, Spinner, HeatCell, SectionTitle, RiskBadge, Empty, useFetch, Icon, Dot } from '../components/UI';
import { useI18n } from '../i18n';

export default function RiskMap() {
  const { t } = useI18n();
  const heat = useFetch('/analytics/heatmap');
  const sites = useFetch('/analytics/sites');
  const [expanded, setExpanded] = useState('Assam');

  if (heat.loading) return <Spinner />;
  const { sites: siteNames = [], rules = [], grid = [], risk = [] } = heat.data || {};

  // per-cell report count for heat scaling + site-level severity aggregate
  const maxCell = grid.reduce((s, row) => rules.reduce((ss, rule) => Math.max(ss, +row[rule] || 0), s), 1);
  const siteAgg = {};
  for (const r of risk) {
    const k = r.site;
    siteAgg[k] = siteAgg[k] || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, n: 0 };
    siteAgg[k][r.risk_level] = (siteAgg[k][r.risk_level] || 0) + r.count;
    siteAgg[k].n += r.count;
  }
  const siteLevel = (s) => (s.CRITICAL > 0 || s.HIGH >= 2) ? 'CRITICAL' : (s.HIGH > 0 || s.MEDIUM >= 2) ? 'HIGH' : s.MEDIUM > 0 ? 'MEDIUM' : s.n ? 'LOW' : '';

  // Geo hierarchy
  const geo = {};
  for (const s of sites.data?.sites || []) {
    const st = s.state || 'Unknown';
    geo[st] = geo[st] || { state: st, fields: {} };
    const fld = s.field || 'Main';
    geo[st].fields[fld] = geo[st].fields[fld] || { field: fld, sites: [] };
    geo[st].fields[fld].sites.push(s);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="map" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Risk Map')}</span></h1>
        <p className="text-sm text-slate-500">{t('India → State → Field → Site heatmark and risk matrix')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Geo hierarchy */}
        <Card className="lg:col-span-2">
          <SectionTitle title={t('India Operations')} sub={t('Drill down by geography')} />
          <div className="space-y-2">
            {Object.values(geo).map((st) => (
              <div key={st.state} className="overflow-hidden rounded-lg border border-ink-700">
                <button
                  className="flex w-full items-center gap-2 bg-ink-900 px-3 py-2.5 text-left"
                  onClick={() => setExpanded(expanded === st.state ? '' : st.state)}
                >
                  {expanded === st.state ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                  <MapPin size={14} className="text-brand" />
                  <span className="flex-1 text-sm font-bold text-white">{st.state}</span>
                  <span className="text-[11px] text-slate-500">{t('{n} sites', { n: Object.values(st.fields).reduce((s, f) => s + f.sites.length, 0) })}</span>
                </button>
                {expanded === st.state && (
                  <div className="border-t border-ink-700 p-2">
                    {Object.values(st.fields).map((f) => (
                      <div key={f.field} className="mb-2">
                        <div className="px-2 text-[11px] font-bold text-slate-500">{t('Field · {field}', { field: f.field })}</div>
                        <div className="mt-1 grid gap-1">
                          {f.sites.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 rounded-md bg-ink-950 px-2 py-1.5">
                              <span className={`h-2 w-2 rounded-full ${s.density > 0.5 ? 'bg-red-500' : s.density > 0.2 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                              <span className="flex-1 text-xs font-semibold text-slate-200">{s.name}</span>
                              <span className="font-mono text-[10px] text-slate-500">{t('density {d}', { d: s.density.toFixed(2) })}</span>
                              <RiskBadge level={s.density > 0.5 ? 'HIGH' : s.density > 0.2 ? 'MEDIUM' : 'LOW'} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Heatmap matrix */}
        <Card className="lg:col-span-3">
          <SectionTitle title={t('Site × Risk heatmatrix')} sub={t('Risk density per Life-Saving Rule per site — click a tile to drill into reports')} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th sticky left-0 bg-ink-850">{t('Site \\ Rule')}</th>
                  {rules.map((r) => <th key={r} className="th whitespace-nowrap">{t(r)}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <tr key={row.site}>
                    <td className="td sticky left-0 bg-ink-850">
                      <div className="font-semibold text-white">{row.site}</div>
                      {siteLevel(siteAgg[row.site]) && (
                        <div className="mt-0.5"><RiskBadge level={siteLevel(siteAgg[row.site])} /></div>
                      )}
                    </td>
                    {rules.map((rule) => (
                      <td key={rule} className="p-1">
                        <HeatCell value={row[rule]} max={maxCell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><Dot className="bg-amber-400/60" /> {t('Low')}</span><span className="flex items-center gap-1.5"><Dot className="bg-orange-500/70" /> {t('Medium')}</span><span className="flex items-center gap-1.5"><Dot className="bg-red-500/80" /> {t('High')}</span>
            <span className="ml-auto">{t('Cell color scaled by report count per rule per site')}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}