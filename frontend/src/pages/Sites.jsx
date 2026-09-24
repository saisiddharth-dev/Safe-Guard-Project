import { useState, useMemo } from 'react';
import { Box, Factory, Boxes, Search, MapPin, X, Wrench } from 'lucide-react';
import { Card, Spinner, useFetch, Icon, fmt } from '../components/UI';
import SitesMap from '../components/map/SitesMap';
import sitesData from '../data/sitesData.json';
import { useI18n } from '../i18n';

const ASSET_TYPE_CLS = {
  Compressor: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  Pump: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  Tank: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  Pipeline: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Well: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  'Valve Station': 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  Separator: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
  Vehicle: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
};

function MiniStat({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 ring-1 ring-ink-600">{icon}</span>
      <div>
        <div className="text-lg font-extrabold text-white">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function Sites() {
  const { t } = useI18n();
  const sitesDataApi = useFetch('/sites');
  const assetsData = useFetch('/assets');
  const siteAnalytics = useFetch('/analytics/sites');
  const [view, setView] = useState('sites');
  const [siteFilter, setSiteFilter] = useState('');
  const [search, setSearch] = useState('');

  const apiSites = sitesDataApi.data?.sites || [];
  const allAssets = assetsData.data?.assets || [];

  const liveStats = useMemo(() => {
    const map = {};
    for (const s of siteAnalytics.data?.sites || []) map[s.name] = s;
    return map;
  }, [siteAnalytics.data]);

  const siteAssetCounts = useMemo(() => {
    const m = {};
    for (const a of allAssets) m[a.site_name] = (m[a.site_name] || 0) + 1;
    return m;
  }, [allAssets]);

  const mapSites = useMemo(() => {
    const byName = new Map(sitesData.map((sd) => [sd.name, sd]));
    const merged = [];
    for (const ap of apiSites) {
      const sd = byName.get(ap.name);
      const base = sd || {
        ...ap,
        district: ap.field,
        contractor: '',
        site_manager: '',
        operations: '',
        commissioned: '',
        workforce: null,
        assets: 0,
      };
      const withAssets = { ...base, assetCount: siteAssetCounts[ap.name] || 0 };
      const st = liveStats[ap.name];
      byName.delete(ap.name);
      merged.push(st ? { ...withAssets, reports: st.reports, sifCount: st.sif, density: st.density } : withAssets);
    }
    for (const sd of byName.values()) {
      const withAssets = { ...sd, assetCount: siteAssetCounts[sd.name] || 0 };
      const st = liveStats[sd.name];
      merged.push(st ? { ...withAssets, reports: st.reports, sifCount: st.sif, density: st.density } : withAssets);
    }
    return merged;
  }, [apiSites, liveStats, siteAssetCounts]);

  const assetTypes = new Set(allAssets.map((a) => a.type));

  const q = search.trim().toLowerCase();
  const matches = (a) => !q || `${a.name} ${a.type} ${a.code} ${a.site_name || ''}`.toLowerCase().includes(q);
  const assets = allAssets.filter((a) => (!siteFilter || a.site_name === siteFilter) && matches(a));

  const hasFilter = Boolean(siteFilter || search);
  const filtered = Boolean(siteFilter || q);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="factory" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Sites & Assets')}</span></h1>
        <p className="text-sm text-slate-500">{t('Asset-level safety intelligence — every report linked to asset context')}</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1 w-fit">
        <button onClick={() => setView('sites')} className={`rounded-md px-3 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0 ${view === 'sites' ? 'bg-brand text-white' : 'text-slate-400'}`}>
          {t('Sites')} <span className={`ml-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold ${view === 'sites' ? 'text-white/80' : 'text-slate-500'}`}>{mapSites.length}</span>
        </button>
        <button onClick={() => setView('assets')} className={`rounded-md px-3 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0 ${view === 'assets' ? 'bg-brand text-white' : 'text-slate-400'}`}>
          {t('Assets')} <span className={`ml-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold ${view === 'assets' ? 'text-white/80' : 'text-slate-500'}`}>{allAssets.length}</span>
        </button>
      </div>

      {view === 'sites' && (
        <>
          <SitesMap sites={mapSites} />
          {siteAnalytics.error && (
            <p className="text-[11px] text-red-400">{t('Live analytics unavailable')} — {String(siteAnalytics.error)}</p>
          )}
          {siteAnalytics.loading && !siteAnalytics.error && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-slate-500 border-t-transparent" />
              {t('Syncing live analytics…')}
            </p>
          )}
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
              <div className="mb-3 grid gap-2 sm:grid-cols-3">
                <MiniStat label={t('Total assets')} value={fmt.num(allAssets.length)} icon={<Box size={15} className="text-cyan-400" />} />
                <MiniStat label={t('Total sites')} value={fmt.num(mapSites.length)} icon={<Factory size={15} className="text-[#2f7cf6]" />} />
                <MiniStat label={t('Asset types')} value={fmt.num(assetTypes.size)} icon={<Boxes size={15} className="text-violet-400" />} />
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input !mb-0 !pl-9 !w-full sm:!w-64"
                    placeholder={t('Search assets…')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={t('Search assets…')}
                  />
                </div>
                <select
                  className="input !mb-0 !w-56"
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  aria-label={t('Filter by site')}
                >
                  <option value="">{t('All sites')} ({allAssets.length})</option>
                  {apiSites.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} ({siteAssetCounts[s.name] || 0})</option>
                  ))}
                </select>
                {hasFilter && (
                  <button
                    onClick={() => { setSiteFilter(''); setSearch(''); }}
                    className="btn-ghost !mb-0 !px-3 !py-2 text-xs"
                  >
                    <X size={13} /> {t('Clear')}
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((a) => (
                  <div key={a.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3 transition-colors hover:border-brand/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
                        <Box size={14} className="shrink-0 text-cyan-400" />
                        <span className="truncate">{a.name}</span>
                      </div>
                      <span className={`chip shrink-0 border px-2 py-0.5 text-[10px] font-bold ${ASSET_TYPE_CLS[a.type] || 'border-slate-500/30 bg-slate-500/10 text-slate-400'}`}>
                        {a.type || '—'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-mono text-slate-400"><Wrench size={11} /> {a.code || '—'}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} className="text-slate-600" />
                        {a.site_name || t('Unassigned')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {!assets.length && (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                  <Box size={26} className="text-slate-600" />
                  {filtered ? t('No matching assets.') : t('No assets.')}
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}