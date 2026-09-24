import { memo, useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { getRiskColor, getRiskLevel } from '../../utils/geoUtils';

function SiteMarker({ site, selected, onSelect }) {
  const color = useMemo(() => getRiskColor(site.density), [site.density]);
  const level = useMemo(() => getRiskLevel(site.density), [site.density]);
  const pct = Math.round((site.density || 0) * 100);

  const icon = useMemo(() => {
    const label = `${site.name} — SIF density ${Math.round((site.density || 0) * 100)}%, risk ${level}`;
    const html = `
      <button type="button" tabindex="0" role="button" aria-label="${label}" class="oil-site-pin ${selected ? 'oil-site-pin--sel' : ''}" style="--pin:${color}">
        <span class="oil-pin-pulse" aria-hidden="true"></span>
        <svg class="oil-pin-svg" viewBox="0 0 26 36" width="27" height="37" aria-hidden="true">
          <path d="M13 1C6.37 1 1 6.37 1 13c0 9.6 12 21.9 12 21.9S25 22.6 25 13C25 6.37 19.63 1 13 1z" fill="${color}" stroke="#ffffff" stroke-width="1.6"/>
          <circle cx="13" cy="13" r="5.4" fill="#ffffff"/>
          <circle cx="13" cy="13" r="2.6" fill="${color}"/>
        </svg>
      </button>`;
    return L.divIcon({
      className: 'oil-site-icon',
      html,
      iconSize: [27, 37],
      iconAnchor: [13.5, 35],
      popupAnchor: [0, -32],
    });
  }, [color, level, selected, site.name, site.density]);

  return (
    <Marker
      position={[site.lat, site.lng]}
      icon={icon}
      keyboard
      zIndexOffset={selected ? 1000 : (site.density || 0) * 100 + 10}
      eventHandlers={{ click: () => onSelect(site) }}
    >
      <Tooltip direction="top" offset={[0, -18]} opacity={1} className="oil-marker-tip">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="oil-tip-dot" style={{ background: color }} />
          <span className="font-bold text-slate-800">{site.name}</span>
        </div>
        <div className="text-[10px] font-medium text-slate-500">
          SIF {site.sifCount} · Density {pct}%
        </div>
      </Tooltip>
    </Marker>
  );
}

function areEqual(prev, next) {
  return (
    prev.site === next.site &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect
  );
}

export default memo(SiteMarker, areEqual);