import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Flame, AlertTriangle, RotateCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import SiteMarker from './SiteMarker';
import SitePopup from './SitePopup';
import MapControls from './MapControls';
import sitesData from '../../data/sitesData.json';
import { useI18n } from '../../i18n';
import {
  loadGeoJSON,
  buildSiteDistrictMap,
  getRiskColor,
  getRiskLevel,
} from '../../utils/geoUtils';

export const INDIA_CENTER = [23.6, 79.0];
export const INDIA_ZOOM = 5;

const STATE_URL = '/data/india_state_simpl.geojson';
const DISTRICT_URL = '/data/india_district_simpl.geojson';

function MapBridge({ onMap }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
    return () => onMap(null);
  }, [map, onMap]);
  return null;
}

function IndiaLayer({ districts, states, siteDistricts, onClickDistrict }) {
  const map = useMap();
  const siteTint = (feature) => siteDistricts.get(feature);

  useEffect(() => {
    if (!districts || !states) return undefined;

    const districtLayer = L.geoJSON(districts, {
      style: (feature) => {
        const tint = siteTint(feature);
        return tint
          ? { color: '#94a3b8', weight: 0.6, dashArray: '2 4', fillColor: tint, fillOpacity: 0.08, className: 'oil-district-path' }
          : { color: '#cbd5e1', weight: 0.45, dashArray: '2 4', fill: false, className: 'oil-district-path' };
      },
      onEachFeature: (feature, layer) => {
        if (!siteDistricts.has(feature)) return;
        const tint = siteTint(feature);
        const name = feature.properties?.NAME_2 || 'Unknown district';
        layer.bindTooltip(name, { className: 'district-tip', direction: 'top', offset: [0, -2], sticky: true });
        layer.on('mouseover', () => {
          layer.setStyle({
            color: '#475569',
            weight: 1,
            dashArray: null,
            fillColor: tint,
            fillOpacity: 0.24,
          });
          layer.bringToFront();
        });
        layer.on('mouseout', () => {
          districtLayer.resetStyle(layer);
        });
        layer.on('click', () => onClickDistrict?.(feature, name));
      },
    });

    const stateLayer = L.geoJSON(states, {
      style: { color: '#003366', weight: 1.4, opacity: 0.8, fill: false },
    });

    districtLayer.addTo(map);
    stateLayer.addTo(map);
    stateLayer.bringToFront();
    districtLayer.bringToFront();

    return () => {
      map.removeLayer(districtLayer);
      map.removeLayer(stateLayer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts, states, siteDistricts, map]);

  return null;
}

const RISK_RANGE = [
  { level: 'Low', color: '#00A86B', range: '<0.70' },
  { level: 'Medium', color: '#FF8C00', range: '0.70–0.85' },
  { level: 'High', color: '#ef4444', range: '>0.85' },
];

function StatsOverlay({ sites, heatmap }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const high = sites.filter((s) => getRiskLevel(s.density) === 'high').length;
  const med = sites.filter((s) => getRiskLevel(s.density) === 'medium').length;
  const low = sites.filter((s) => getRiskLevel(s.density) === 'low').length;

  if (!open) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 180, damping: 24 }}
        className="absolute left-4 top-4 z-[450] max-w-[240px]"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('Expand stats')}
          className="group flex items-center gap-2 rounded-xl border border-ink-600 bg-white/95 py-2 pl-3 pr-2.5 shadow-md shadow-slate-900/10 ring-1 ring-ink-600 backdrop-blur transition hover:shadow-lg"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-extrabold text-[#003366]">{t('India Operations')}</span>
          <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{sites.length}</span>
          <ChevronUp size={14} className="text-slate-400 transition group-hover:text-[#003366]" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 180, damping: 24 }}
      className="pointer-events-auto absolute left-4 top-4 z-[450] max-w-[240px] rounded-xl border border-ink-600 bg-white/95 p-3 shadow-lg shadow-slate-900/10 ring-1 ring-ink-600 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold leading-tight text-[#003366]">{t('India Operations')}</div>
          <div className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
            {t('{n} OIL sites plotted', { n: sites.length })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('Collapse stats')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-white text-slate-500 transition hover:bg-ink-700 hover:text-[#003366]"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {heatmap && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-500">
          <Flame size={10} /> {t('Heatmap on')}
        </div>
      )}

      <div className="mt-2.5 space-y-1.5">
        <StatRow color="#ef4444" label={t('High')} value={high} />
        <StatRow color="#FF8C00" label={t('Medium')} value={med} />
        <StatRow color="#00A86B" label={t('Low')} value={low} />
      </div>

      <div className="mt-3 border-t border-ink-600 pt-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{t('SIF density')}</div>
        <div className="mt-1.5 flex flex-col gap-1">
          {RISK_RANGE.map((d) => (
            <div key={d.level} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="font-mono text-slate-500">{d.range}</span>
              <span>{t(d.level)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatRow({ color, label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      </div>
      <span className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] font-bold text-slate-800">{value}</span>
    </div>
  );
}

export default function SitesMap({ sites = sitesData }) {
  const { t } = useI18n();
  const [districts, setDistricts] = useState(null);
  const [states, setStates] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedSite, setSelectedSite] = useState(null);
  const [heatmap, setHeatmap] = useState(false);
  const mapRef = useRef(null);
  const setMapRef = useCallback((map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([loadGeoJSON(STATE_URL), loadGeoJSON(DISTRICT_URL)])
      .then(([st, ds]) => {
        if (!alive) return;
        setStates(st);
        setDistricts(ds);
      })
      .catch((e) => {
        if (alive) setError(e.message || 'Could not load map boundaries');
      });
    return () => { alive = false; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const siteDistricts = useMemo(
    () => buildSiteDistrictMap(districts, sites),
    [districts, sites]
  );

  const focusSite = useCallback((site) => {
    const map = mapRef.current;
    if (map) map.flyTo([site.lat, site.lng], 9, { duration: 1.4 });
  }, []);

  const handleSelect = useCallback((site) => {
    setSelectedSite(site);
    focusSite(site);
  }, [focusSite]);

  const handleClose = useCallback(() => setSelectedSite(null), []);
  const handleViewMap = useCallback(() => {
    if (selectedSite) focusSite(selectedSite);
    setSelectedSite(null);
  }, [selectedSite, focusSite]);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const resetView = useCallback(() => {
    mapRef.current?.flyTo(INDIA_CENTER, INDIA_ZOOM, { duration: 1.4 });
  }, []);
  const toggleHeatmap = useCallback(() => setHeatmap((h) => !h), []);

  const mapDataReady = districts && states;
  const loading = !mapDataReady && !error;
  const failed = !mapDataReady && Boolean(error);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="map-shell relative isolate z-0 overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-xl shadow-slate-900/10"
    >
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom
        zoomControl={false}
        className="oil-map h-[70vh] w-full min-h-[440px] sm:h-[72vh] lg:h-[76vh]"
      >
        <MapBridge onMap={setMapRef} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {heatmap &&
          sites.map((s) => (
            <Circle
              key={`hm-${s.id}`}
              center={[s.lat, s.lng]}
              radius={(Number(s.density) || 0) * 14000 + 3500}
              pathOptions={{ color: getRiskColor(s.density), fillColor: getRiskColor(s.density), fillOpacity: 0.32, opacity: 0.55, weight: 1 }}
            />
          ))}
        {sites.map((s) => (
          <SiteMarker key={s.id} site={s} selected={selectedSite?.id === s.id} onSelect={handleSelect} />
        ))}
        {districts && states && (
          <IndiaLayer districts={districts} states={states} siteDistricts={siteDistricts} />
        )}
      </MapContainer>

      <StatsOverlay sites={sites} heatmap={heatmap} />
      <MapControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetView}
        heatmap={heatmap}
        onToggleHeatmap={toggleHeatmap}
      />

      {loading && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-ink-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-ink-600 bg-white px-5 py-4 shadow-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#003366]" />
            <div>
              <div className="text-sm font-bold text-slate-800">{t('Loading Map Data…')}</div>
              <div className="text-[11px] text-slate-500">{t('Fetching India state & district boundaries')}</div>
            </div>
          </div>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-ink-950/50 backdrop-blur-sm">
          <div className="max-w-xs rounded-xl border border-ink-600 bg-white px-5 py-4 text-center shadow-xl">
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm font-bold text-rose-600">{t('Could not load map boundaries')}</span>
            </div>
            <p className="mt-1 break-words text-[11px] text-slate-500">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: '#003366', color: '#ffffff' }}
            >
              <RotateCw size={13} /> {t('Retry')}
            </button>
          </div>
        </div>
      )}

      <SitePopup
        site={selectedSite}
        onClose={handleClose}
        onViewMap={handleViewMap}
      />
    </motion.div>
  );
}