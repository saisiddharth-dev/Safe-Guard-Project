import { useState, useMemo } from 'react';
import { Box } from 'lucide-react';
import { Card, Spinner, useFetch, Icon } from '../components/UI';
import SitesMap from '../components/map/SitesMap';
import sitesData from '../data/sitesData.json';
import { useI18n } from '../i18n';

export default function Sites() {
  const { t } = useI18n();
  const sitesDataApi = useFetch('/sites');
  const assetsData = useFetch('/assets');
  const siteAnalytics = useFetch('/analytics/sites');
  const [view, setView] = useState('sites');
  const [siteFilter, setSiteFilter] = useState('');

  const assets = (assetsData.data?.assets || []).filter((a) => !siteFilter || a.site_name === siteFilter);

  const liveStats = useMemo(() => {
    const map = {};
    for (const s of siteAnalytics.data?.sites || []) map[s.name] = s;
    return map;
  }, [siteAnalytics.data]);

  const mapSites = useMemo(
    () =>
      sitesData.map((sd) => {
        const st = liveStats[sd.name];
        return st
          ? { ...sd, reports: st.reports, sifCount: st.sif, density: st.density }
          : sd;
      }),
    [liveStats]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="factory" size={22} /> {t('Sites & Assets')}</h1>
        <p className="text-sm text-slate-500">{t('Asset-level safety intelligence — every report linked to asset context')}</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1 w-fit">
        <button onClick={() => setView('sites')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'sites' ? 'bg-brand text-white' : 'text-slate-400'}`}>{t('Sites')}</button>
        <button onClick={() => setView('assets')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'assets' ? 'bg-brand text-white' : 'text-slate-400'}`}>{t('Assets')}</button>
      </div>

      {view === 'sites' && (
        <>
          <SitesMap sites={mapSites} />
          <p className="text-[11px] text-slate-500">
            {t('Live SIF density from the analytics engine overrides the baseline values. Click a pin to inspect site-level risk.')}
          </p>
          <p className="text-[10px] text-slate-600">Map data © OpenStreetMap contributors</p>
        </>
      )}

      {view === 'assets' && (
        <Card>
          {assetsData.loading ? (
            <Spinner />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <label className="label !mb-0">{t('Filter by site')}</label>
                <select className="input !w-56" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                  <option value="">{t('All sites')}</option>
                  {(sitesDataApi.data?.sites || []).map((s) => <option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((a) => (
                  <div key={a.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-white"><Box size={14} className="text-cyan-400" /> {a.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{a.type} · {a.code} · {a.site_name || t('Unassigned')}</div>
                  </div>
                ))}
              </div>
              {!assets.length && <div className="py-8 text-center text-sm text-slate-500">{t('No assets.')}</div>}
            </>
          )}
        </Card>
      )}
    </div>
  );
}