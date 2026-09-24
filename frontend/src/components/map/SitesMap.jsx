import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';

import SiteMarker from './SiteMarker';
import SitePopup from './SitePopup';
import MapControls from './MapControls';
import sitesData from '../../data/sitesData.json';
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

function FlyToIndia() {
  const map = useMap();
  useEffect(() => {
    map.flyTo(INDIA_CENTER, INDIA_ZOOM, { duration: 2.6, easeLinearity: 0.2 });
  }, [map]);
  return null;
}

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

function StatsOverlay({ sites, heatmap }) {
  const high = sites.filter((s) => getRiskLevel(s.density) === 'high').length;
  const med = sites.filter((s) => getRiskLevel(s.density) === 'medium').length;
  const low = sites.filter((s) => getRiskLevel(s.density) === 'low').length;
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 180, damping: 24 }}
      className="pointer-events-none absolute left-3 top-3 z-[400] max-w-[210px] rounded-xl bg-white/95 p-3 shadow-md shadow-slate-900/10 ring-1 ring-ink-600 backdrop-blur sm:left-4 sm:top-4"
    >
      <div className="text-xs font-extrabold text-[#003366]">India Operations</div>
      <div className="mt-0.5 text-[10px] font-medium text-slate-500">{sites.length} OIL sites plotted</div>
      {heatmap && <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-orange-500">Heatmap on</div>}
      <div className="mt-2 space-y-1">
        <LegendRow color="#ef4444" label={`${high} high`} />
        <LegendRow color="#FF8C00" label={`${med} medium`} />
        <LegendRow color="#00A86B" label={`${low} low`} />
      </div>
    </motion.div>
  );
}

function LegendRow({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

export default function SitesMap({ sites = sitesData }) {
  const [districts, setDistricts] = useState(null);
  const [states, setStates] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [heatmap, setHeatmap] = useState(false);
  const mapRef = useRef(null);
  const setMapRef = useCallback((map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    let alive = true;
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
  }, []);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 shadow-xl shadow-slate-900/10"
    >
      <MapContainer
        center={[16, 55]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom
        zoomControl={false}
        className="oil-map h-[70vh] w-full min-h-[440px] sm:h-[72vh] lg:h-[76vh]"
      >
        <FlyToIndia />
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
              radius={s.density * 14000 + 3500}
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

      {(districts === null || states === null) && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-ink-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-ink-600 bg-white px-5 py-4 shadow-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#003366]" />
            <div>
              <div className="text-sm font-bold text-slate-800">Loading Map Data…</div>
              <div className="text-[11px] text-slate-500">{error || 'Fetching India state & district boundaries'}</div>
            </div>
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