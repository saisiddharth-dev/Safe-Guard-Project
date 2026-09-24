const TOKEN_KEY = 'oil_sif_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem('oil_sif_user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('oil_sif_user');
}
export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('oil_sif_user')); } catch { return null; }
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  const resp = await fetch('/api' + path, { ...options, headers });
  if (resp.status === 401) {
    clearSession();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new Error('unauthorized');
  }
  if (!resp.ok) {
    let detail = resp.statusText;
    try { const j = await resp.json(); detail = j.error || j.detail || detail; } catch { /* noop */ }
    const err = new Error(detail);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (p, body) => request(p, { method: 'PATCH', body: JSON.stringify(body || {}) }),
};

export const fmt = {
  num: (n) => (n == null ? '0' : Number(n).toLocaleString('en-IN')),
  pct: (n) => `${Math.round(Number(n) * 100) || 0}%`,
  date: (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  dt: (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  },
  ago: (iso) => {
    if (!iso) return '—';
    const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const dy = Math.floor(hr / 24);
    return `${dy}d ago`;
  },
};

export function riskColor(level) {
  switch (String(level || '').toUpperCase()) {
    case 'CRITICAL': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

export function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('auto') || s.includes('close') || s.includes('done')) return 'bg-emerald-500/15 text-emerald-400';
  if (s.includes('review') || s.includes('pend') || s.includes('assign')) return 'bg-amber-500/15 text-amber-400';
  if (s.includes('mandatory') || s.includes('overdue') || s.includes('reopen') || s.includes('critical')) return 'bg-red-500/15 text-red-400';
  if (s.includes('in_progress') || s.includes('progress')) return 'bg-sky-500/15 text-sky-400';
  return 'bg-slate-500/15 text-slate-400';
}

export const LSR_META = {
  'Energy Isolation': { icon: 'bolt', color: '#f59e0b' },
  'Hot Work': { icon: 'flame', color: '#ef4444' },
  'Confined Space': { icon: 'box', color: '#8b5cf6' },
  'Line of Fire': { icon: 'target', color: '#f97316' },
  'Working at Height': { icon: 'height', color: '#06b6d4' },
  'Safe Mechanical Lifting': { icon: 'construction', color: '#3b82f6' },
  'Work Authorisation': { icon: 'clipboard', color: '#10b981' },
  'Driving': { icon: 'car', color: '#84cc16' },
  'Bypassing Safety Controls': { icon: 'ban', color: '#ec4899' },
  'General / Housekeeping': { icon: 'brush', color: '#94a3b8' },
};

export const ALL_LSRS = Object.keys(LSR_META);