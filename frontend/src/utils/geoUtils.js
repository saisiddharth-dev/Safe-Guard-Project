const cache = {};

let fetchImpl = null;

if (typeof window !== 'undefined') {
  fetchImpl = window.fetch ? window.fetch.bind(window) : null;
}

const httpFetch = typeof globalThis !== 'undefined' && globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : null;

async function doFetch(path) {
  const fn = fetchImpl || httpFetch;
  if (!fn) throw new Error('fetch is not available');
  const res = await fn(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadGeoJSON(path) {
  if (cache[path]) return cache[path];
  const data = await doFetch(path);
  cache[path] = data;
  return data;
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function getRiskLevel(density) {
  if (density > 0.85) return 'high';
  if (density >= 0.7) return 'medium';
  return 'low';
}

export function getRiskColor(density) {
  const level = getRiskLevel(density);
  if (level === 'high') return '#ef4444';
  if (level === 'medium') return '#FF8C00';
  return '#00A86B';
}

export function getDistrictTint(density) {
  return getRiskLevel(density) === 'low' ? '#00A86B' : '#FF8C00';
}

function ringContainsPoint(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function geometryContainsPoint(geometry, lat, lng) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.some((ring) => ringContainsPoint(ring, lng, lat));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => poly.some((ring) => ringContainsPoint(ring, lng, lat)));
  }
  return false;
}

export function findDistrictFor(districts, lat, lng) {
  for (const feature of districts?.features || []) {
    if (feature.geometry && geometryContainsPoint(feature.geometry, lat, lng)) return feature;
  }
  return null;
}

export function buildSiteDistrictMap(districts, sites) {
  const map = new Map();
  if (!districts?.features || !sites?.length) return map;
  for (const feature of districts.features) {
    let maxDensity = null;
    for (const site of sites) {
      if (geometryContainsPoint(feature.geometry, site.lat, site.lng)) {
        maxDensity = maxDensity === null ? site.density : Math.max(maxDensity, site.density);
      }
    }
    if (maxDensity !== null) map.set(feature, getDistrictTint(maxDensity));
  }
  return map;
}