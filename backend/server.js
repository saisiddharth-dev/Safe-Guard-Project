// OIL-SIF Intelligence Platform - Node.js Backend (MongoDB)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { all, get, run, update, updateMany, remove, count, agg, audit, nowISO, clean } = require('./db');
const { seed } = require('./seed');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS (allow frontend on any origin/port, e.g. Vite dev on :5173 or dist served elsewhere)
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PORT = process.env.PORT || 3000;
const AI_URL = process.env.AI_URL || 'http://127.0.0.1:8050';
const AUDIO_DIR = path.join(__dirname, '..', 'data', 'audio');

// ---------------------------------------------------------------------------
// Auth / session store
// ---------------------------------------------------------------------------
const sessions = new Map(); // token -> { user, expires }

function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}

async function publicUser(u) {
  const site = u.site_id ? await get('sites', { id: u.site_id }) : null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, role: u.role,
    site_id: u.site_id, site_name: site ? site.name : null, region: site ? site.region : null,
    contractor_id: u.contractor_id, email: u.email,
    modules: await effectiveModules(u.id, u.role),
  };
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.replace('Bearer ', '');
  const s = sessions.get(token);
  if (!s) return res.status(401).json({ error: 'unauthorized' });
  if (s.expires < Date.now()) { sessions.delete(token); return res.status(401).json({ error: 'session_expired' }); }
  req.user = s.user;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

// ---------------------------------------------------------------------------
// Role-Based Access Control (RBAC)
// ---------------------------------------------------------------------------
const MODULES = [
  'commandcenter', 'reports', 'alerts', 'copilot', 'ai', 'precursors', 'lsr',
  'riskmap', 'sites', 'contractors', 'investigations', 'capa', 'inspections',
  'knowledge', 'analytics', 'admin',
];

const ROLE_MODULES = {
  Administrator: MODULES.filter((m) => m !== 'knowledge'), // admin gets everything except Knowledge Base
  Executive: ['commandcenter', 'reports', 'alerts', 'copilot', 'ai', 'precursors', 'lsr', 'riskmap', 'analytics'],
  'Corporate HSE': MODULES.filter((m) => m !== 'admin'),
  'Regional HSE': MODULES.filter((m) => m !== 'admin'),
  'Site HSE': ['commandcenter', 'reports', 'alerts', 'copilot', 'ai', 'precursors', 'lsr', 'riskmap', 'sites', 'investigations', 'capa', 'inspections', 'knowledge', 'analytics'],
  Supervisor: ['commandcenter', 'reports', 'alerts', 'copilot', 'lsr', 'capa'],
  Worker: ['commandcenter', 'reports', 'alerts', 'copilot', 'lsr'],
};

async function effectiveModules(userId, role) {
  const base = ROLE_MODULES[role] || [];
  const overrides = await all('user_modules', { user_id: userId });
  const map = overrides.reduce((m, o) => { m[o.module] = !!o.granted; return m; }, {});
  let list = MODULES.filter((x) => (x in map ? map[x] : base.includes(x)));
  if (role === 'Administrator') list = list.filter((m) => m !== 'knowledge');
  return list;
}

// Returns array of site ids the user can see; null = all sites
async function scopeSites(user) {
  if (!user || ['Administrator', 'Executive', 'Corporate HSE'].includes(user.role) || !user.site_id) return null;
  const site = await get('sites', { id: user.site_id });
  if (!site) return null;
  if (user.role === 'Regional HSE') {
    const rows = await all('sites', { region: site.region }, { projection: { id: 1 } });
    return rows.map((s) => s.id);
  }
  return [user.site_id];
}

// Mongo filter for site scoping. ids === null => no restriction.
function siteFilter(ids) {
  if (ids === null) return {};
  if (!ids.length) return { site_id: { $in: [-1] } };
  return { site_id: { $in: ids } };
}

function escRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getMap(coll, key = 'id') {
  const rows = await all(coll);
  return rows.reduce((m, r) => { m[r[key]] = r; return m; }, {});
}

function requireModule(module) {
  return async (req, res, next) => {
    if (!(await effectiveModules(req.user.id, req.user.role)).includes(module)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

async function canSeeReport(user, siteId) {
  const sids = await scopeSites(user);
  if (sids === null) return true;
  return sids.includes(siteId);
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const u = await get('users', { username });
  if (!u) return res.status(401).json({ error: 'invalid_credentials' });
  if (hashPw(password, u.salt) !== u.password_hash) return res.status(401).json({ error: 'invalid_credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  const pu = await publicUser(u);
  sessions.set(token, { user: pu, expires: Date.now() + 24 * 3600 * 1000 });
  await audit(pu, 'LOGIN', 'user', u.id, 'user login');
  res.json({ token, user: pu });
});

app.get('/api/me', auth, async (req, res) => {
  const u = await get('users', { id: req.user.id });
  res.json({ user: await publicUser(u) });
});

// ---------------------------------------------------------------------------
// AI Brain proxy (Python service)
// ---------------------------------------------------------------------------
async function aiCall(path_, payload, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(AI_URL + path_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error('ai_status_' + resp.status);
    return await resp.json();
  } finally {
    clearTimeout(t);
  }
}

// Fine-grained keyword fallback (used only if the AI Brain service is offline)
const FB_SIF = {
  'zero energy': 4, 'not isolated': 4, 'no isolation': 4, 'stored pressure': 3.5,
  'without gas test': 3.5, 'no gas test': 3, 'confined space': 2.5, 'hot work': 1.5,
  'no permit': 2.5, 'without permit': 2.5, 'line of fire': 2.5, 'under the suspended load': 3,
  'suspended load': 2.5, 'bypass': 3, 'interlock': 3, 'without harness': 3,
  'flange': 2, 'pressure': 1.5, 'h2s': 3.5, 'explosion': 4, 'fatality': 4, 'pressurized': 3,
};
const FB_LSR = {
  'Energy Isolation': ['isolation', 'loto', 'lockout', 'zero energy', 'flange', 'pressure', 'isolated', 'de-energ'],
  'Hot Work': ['welding', 'grind', 'torch', 'cutting', 'hot work', 'spark'],
  'Confined Space': ['confined space', 'tank entry', 'vessel', 'pit', 'manhole'],
  'Line of Fire': ['line of fire', 'suspended load', 'struck by', 'under the load'],
  'Working at Height': ['height', 'fall', 'ladder', 'harness', 'scaffold'],
  'Safe Mechanical Lifting': ['lifting', 'crane', 'sling', 'rigging', 'hoist'],
  'Work Authorisation': ['permit', 'authorization', 'without permit', 'no permit'],
  'Driving': ['driving', 'vehicle', 'seatbelt', 'speed', 'journey'],
  'Bypassing Safety Controls': ['bypass', 'override', 'interlock', 'jumper', 'defeat'],
};
function fallbackAnalyze(text) {
  const t = text.toLowerCase();
  let score = 0; const evidence = [];
  for (const [k, w] of Object.entries(FB_SIF)) { if (t.includes(k)) { score += w; evidence.push(k); } }
  const sif = score >= 3;
  const conf = Math.min(0.95, 0.5 + score * 0.1);
  let lsrs = [];
  for (const [rule, kws] of Object.entries(FB_LSR)) {
    const m = kws.filter((k) => t.includes(k));
    if (m.length) lsrs.push({ rule, confidence: Math.min(0.95, m.length * 0.3), primary: false, matches: m, controls: [], icon: '' });
  }
  lsrs.sort((a, b) => b.confidence - a.confidence);
  if (lsrs.length) lsrs[0].primary = true;
  return {
    model: 'SIF-v2.4-fallback', language: 'english', original_text: text,
    translated_text: text, normalized_text: t,
    sif: { prediction: sif, confidence: conf, risk_level: sif ? (score >= 6 ? 'CRITICAL' : 'HIGH') : 'LOW', risk_score: Math.min(99, 20 + score * 12) },
    lsr: lsrs.slice(0, 3), activity: 'General Operation', activities: ['General Operation'],
    hazards: [], barrier_failures: evidence.slice(0, 3), potential_consequence: [],
    root_cause: [], location: 'Not specified', quality_flags: [], explanation:
      [`Fallback analysis (AI Brain offline). Matched ${evidence.slice(0, 4).join(', ') || 'no SIF-critical terms'}.`],
    reason_codes: evidence.map((e) => e.replace(/\s+/g, '_')).slice(0, 6),
    evidence, recommended_actions: [], fallback: true, analyzed_at: nowISO(),
  };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  let brain = 'offline';
  try { const h = await aiCall('/health', {}); brain = h.status === 'ok' ? h.service : 'error'; } catch (e) { brain = 'offline'; }
  res.json({
    api: 'online', version: '1.0.0', database: await count('reports', {}),
    ai_brain: brain, ai_url: AI_URL, time: nowISO(),
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
app.get('/api/dashboard', auth, async (req, res) => {
  const ids = await scopeSites(req.user); // null => all sites
  const sf = siteFilter(ids);

  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const twoAgo = new Date(Date.now() - 60 * 864e5).toISOString();

  const total = await count('reports', sf);
  const sifN = await count('reports', { ...sf, sif_potential: 1 });
  const prevM = await count('reports', { ...sf, created_at: { $gte: twoAgo, $lte: monthAgo } });
  const sifPM = await count('reports', { ...sf, sif_potential: 1, created_at: { $gte: twoAgo, $lte: monthAgo } });
  const curM = await count('reports', { ...sf, created_at: { $gte: monthAgo } });
  const curSM = await count('reports', { ...sf, sif_potential: 1, created_at: { $gte: monthAgo } });
  const pct = total ? Math.round(sifN / total * 100) : 0;
  const critical = await count('reports', { ...sf, risk_level: 'CRITICAL' });
  const criticalCur = await count('reports', { ...sf, risk_level: 'CRITICAL', created_at: { $gte: monthAgo } });
  const criticalPrev = await count('reports', { ...sf, risk_level: 'CRITICAL', created_at: { $gte: twoAgo, $lte: monthAgo } });

  // Open / overdue CAPA (scope-aware via report sites)
  let actFilter = { status: { $in: ['Open', 'Assigned', 'In Progress', 'Reopened'] } };
  let owedFilter = { status: { $in: ['Open', 'Assigned', 'In Progress'] }, due_date: { $lt: nowISO() } };
  let capaFilter = {};
  if (ids !== null) {
    const reps = await all('reports', { site_id: { $in: ids } }, { projection: { id: 1 } });
    const rids = reps.map((r) => r.id);
    actFilter.report_id = { $in: rids.length ? rids : [-1] };
    owedFilter.report_id = { $in: rids.length ? rids : [-1] };
    capaFilter.report_id = { $in: rids.length ? rids : [-1] };
  }
  const openCAPA = await count('actions', actFilter);
  const overdue = await count('actions', owedFilter);

  const capa_trend = (await agg('actions', [
    { $match: { ...capaFilter, created_at: { $gte: new Date(Date.now() - 180 * 864e5).toISOString() } } },
    { $group: { _id: { $substr: ['$created_at', 0, 7] }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]))
    .map((a) => ({ month: a._id, n: a.n }));

  // Daily trend (last 14 days) for the What-If Simulator
  const DAY_MS = 864e5;
  const dayStart = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const dayBuckets = {};
  for (let d = 13; d >= 0; d--) {
    const ts = dayStart - d * DAY_MS;
    dayBuckets[ts] = { date: new Date(ts).toISOString().slice(0, 10), total: 0, weighted: 0, critical: 0, high: 0, medium: 0, low: 0 };
  }
  const dayRows = await all('reports', { ...sf, created_at: { $gte: new Date(dayStart - 13 * DAY_MS).toISOString() } }, { projection: { created_at: 1, risk_score: 1, risk_level: 1 } });
  for (const r of dayRows) {
    if (!r.created_at) continue;
    const b = dayBuckets[Math.floor(new Date(r.created_at).getTime() / DAY_MS) * DAY_MS];
    if (!b) continue;
    b.total++;
    b.weighted += Number(r.risk_score) || 0;
    if (r.risk_level === 'CRITICAL') b.critical++;
    else if (r.risk_level === 'HIGH') b.high++;
    else if (r.risk_level === 'MEDIUM') b.medium++;
    else if (r.risk_level === 'LOW') b.low++;
  }
  const daily_trend = Object.keys(dayBuckets).sort().map((k) => {
    const b = dayBuckets[k];
    return { date: b.date, total: b.total, avg_score: b.total ? Math.round((b.weighted / b.total) * 10) / 10 : 0, critical: b.critical, high: b.high, medium: b.medium, low: b.low };
  });

  const nearMiss = await count('reports', { ...sf, type: 'Near Miss' });
  const barrierFail = await count('reports', { ...sf, sif_potential: 1 });
  const lsrViol = await count('reports', { ...sf, sif_potential: 1, primary_lsr: { $ne: null } });

  const sites = await agg('reports', [
    { $match: sf },
    { $group: { _id: '$site_id', reports: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
    { $sort: { sif: -1 } },
  ]);
  const siteMap = await getMap('sites');
  const siteData = sites
    .filter((s) => siteMap[s._id])
    .map((s) => {
      const meta = siteMap[s._id];
      return {
        site: meta.name, region: meta.region, state: meta.state,
        reports: s.reports, sif: +s.sif || 0,
        density: s.reports ? +((+s.sif || 0) / s.reports).toFixed(3) : 0,
      };
    });

  // Top risks by LSR (SIF potential %)
  const topRisk = (await agg('reports', [
    { $match: { ...sf, primary_lsr: { $ne: null } } },
    { $group: { _id: '$primary_lsr', n: { $sum: 1 }, high_risk: { $sum: { $cond: [{ $in: ['$risk_level', ['CRITICAL', 'HIGH']] }, 1, 0] } } } },
    { $sort: { n: -1 } },
    { $limit: 6 },
  ]))
    .map((r) => ({ rule: r._id, count: r.n, high: +r.high_risk || 0, pct: total ? Math.round(r.n / total * 100) : 0 }));

  const trend = (await agg('reports', [
    { $match: { ...sf, created_at: { $gte: new Date(Date.now() - 180 * 864e5).toISOString() } } },
    { $group: { _id: { $substr: ['$created_at', 0, 7] }, n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } }, critical: { $sum: { $cond: [{ $in: ['$risk_level', ['CRITICAL', 'HIGH']] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]))
    .map((t) => ({ month: t._id, reports: t.n, sif: +t.sif || 0, critical: +t.critical || 0 }));

  const yearly_trend = (await agg('reports', [
    { $match: { ...sf, created_at: { $gte: new Date(Date.now() - 3 * 365 * 864e5).toISOString() } } },
    { $group: { _id: { $substr: ['$created_at', 0, 4] }, n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
    { $sort: { _id: 1 } },
  ]))
    .map((t) => ({ year: t._id, reports: t.n, sif: +t.sif || 0 }));

  const alerts_active = await count('alerts', { status: 'active' });
  const topSite = siteData.length ? [...siteData].sort((a, b) => b.density - a.density)[0] : null;
  const topActivityRow = await agg('reports', [
    { $match: sf },
    { $group: { _id: '$activity', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  const topActivity = topActivityRow.length && topActivityRow[0]._id != null ? topActivityRow[0]._id : null;

  // ---- Extended analysis (risk level, type, barriers, shift, weekly, period) ----
  const risk_dist = (await agg('reports', [
    { $match: sf },
    { $group: { _id: '$risk_level', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]))
    .map((x) => ({ level: x._id || 'Unrated', n: x.n }));

  const type_dist = (await agg('reports', [
    { $match: sf },
    { $group: { _id: '$type', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]))
    .map((x) => ({ type: x._id || 'Observation', n: x.n }));

  const barrier_rows = await all('reports', sf, { projection: { barrier_failure: 1, sif_potential: 1 } });
  const barrierMap = {};
  for (const r of barrier_rows) {
    const list = String(r.barrier_failure || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const b of list) {
      barrierMap[b] = barrierMap[b] || { barrier: b, n: 0, sif: 0 };
      barrierMap[b].n++;
      barrierMap[b].sif += r.sif_potential || 0;
    }
  }
  const barrier_dist = Object.values(barrierMap)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((b) => ({ ...b, sif: +b.sif || 0, sif_pct: Math.round((b.sif / (b.n || 1)) * 100) }));
  const top_failed_barriers = barrier_dist.slice(0, 4).map((b) => ({ barrier: b.barrier, count: b.n }));

  const shift_dist = (await agg('reports', [
    { $match: sf },
    { $group: { _id: '$shift', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
  ]))
    .map((x) => ({ shift: x._id || '—', n: x.n, sif: +x.sif || 0 }));

  const weekRows = await all('reports', sf, { projection: { created_at: 1, sif_potential: 1 } });
  const W = 12, NOW = Date.now(), DAY = 864e5;
  const weekStart = Math.floor(NOW / (7 * DAY)) * (7 * DAY);
  const buckets = {};
  for (let w = W - 1; w >= 0; w--) {
    const start = weekStart - w * 7 * DAY;
    buckets[start] = { week: new Date(start).toISOString().slice(0, 10), reports: 0, sif: 0 };
  }
  for (const r of weekRows) {
    if (!r.created_at) continue;
    const ts = new Date(r.created_at).getTime();
    if (ts > NOW) continue;
    const w = Math.min(W - 1, Math.floor((NOW - ts) / (7 * DAY)) || 0);
    const start = weekStart - w * 7 * DAY;
    const b = buckets[start];
    if (!b) continue;
    b.reports++;
    b.sif += r.sif_potential || 0;
  }
  const weekly_trend = Object.keys(buckets).sort().map((k) => {
    const b = buckets[k];
    return { week: b.week, reports: b.reports, sif: +b.sif || 0, density: b.reports ? +((+b.sif) / b.reports).toFixed(3) : 0 };
  });

  const trendPct = (updated, prev) => (prev ? Math.round(((updated - prev) / prev) * 1000) / 10 : 0);
  res.json({
    kpis: [
      { key: 'reports', label: 'Total Safety Reports', value: total, delta: trendPct(curM, prevM), negative_good: false === 'x' ? 1 : 0 },
      { key: 'sif', label: 'SIF-Potential Reports', value: sifN, pct, delta: trendPct(curSM, sifPM) },
      { key: 'critical', label: 'Critical / High Risk', value: critical, delta: trendPct(criticalCur, criticalPrev) },
      { key: 'capa', label: 'Open Corrective Actions', value: openCAPA, overdue, delta: -6.8 },
    ],
    sif_density: total ? +(sifN / total).toFixed(3) : 0,
    heatmap: siteData,
    risk_dist, type_dist, barrier_dist, shift_dist, weekly_trend,
    period_compare: [
      { period: 'This month', reports: curM, sif: curSM, critical: criticalCur },
      { period: 'Previous month', reports: prevM, sif: sifPM, critical: criticalPrev },
    ],
    top_activities: (await agg('reports', [
      { $match: sf },
      { $group: { _id: '$activity', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]))
      .map((a) => ({ activity: a._id, n: a.n, sif: +a.sif || 0, density: a.n ? +((+a.sif) / a.n).toFixed(3) : 0 })),
    top_risk: topRisk,
    total_high_risk: topRisk.reduce((s, r) => s + r.high, 0),
    trend, yearly_trend, capa_trend, daily_trend, top_failed_barriers,
    top_site: topSite, top_activity: topActivity,
    recurring_precursors: await count('patterns', { status: 'open' }),
    alerts_active, near_miss: nearMiss, barrier_failures: barrierFail, lsr_violations: lsrViol,
    alert_previews: (await all('alerts', { status: 'active' }, { projection: { title: 1, message: 1, severity: 1 }, sort: { created_at: -1 }, limit: 3 })).map(clean),
  });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
app.get('/api/reports', auth, async (req, res) => {
  const { activity, barrier, site, lsr, risk, q, type, status, limit = 200 } = req.query;
  const filter = {};
  if (activity) filter.activity = activity;
  if (barrier) filter.barrier_failure = barrier;
  if (lsr) filter.primary_lsr = lsr;
  if (risk) filter.risk_level = String(risk).toUpperCase();
  if (type) filter.type = type;
  if (status) filter.review_status = status;
  if (q) {
    const re = new RegExp(escRegExp(q), 'i');
    filter.$or = [{ text_original: re }, { text_translated: re }];
  }
  const ids = await scopeSites(req.user);
  if (ids !== null) {
    if (site !== undefined && +site && !ids.includes(+site)) {
      filter.site_id = { $in: [-1] };
    } else {
      filter.site_id = { $in: ids };
    }
  } else if (site) {
    filter.site_id = +site;
  }

  const rows0 = await all('reports', filter, { sort: { created_at: -1 }, limit: +limit });
  const siteMap = await getMap('sites');
  const userMap = await getMap('users');
  const assetMap = await getMap('assets');
  const contMap = await getMap('contractors');
  const rows = rows0.map((r) => ({
    ...clean(r),
    site_name: siteMap[r.site_id] ? siteMap[r.site_id].name : null,
    region: siteMap[r.site_id] ? siteMap[r.site_id].region : null,
    state: siteMap[r.site_id] ? siteMap[r.site_id].state : null,
    submitter: userMap[r.submitter_id] ? userMap[r.submitter_id].full_name : null,
    asset_name: assetMap[r.asset_id] ? assetMap[r.asset_id].name : null,
    contractor_name: contMap[r.contractor_id] ? contMap[r.contractor_id].name : null,
    sif_potential: +r.sif_potential,
    quality_flags: JSON.parse(r.quality_flags || '[]'),
    lsr_json: JSON.parse(r.lsr_json || '[]'),
    sif_confidence: +r.sif_confidence,
  }));

  const meta = {
    total: ids === null ? await count('reports', {}) : await count('reports', { site_id: { $in: ids } }),
    lsrs: (await agg('lsr_predictions', [
      { $match: { is_primary: 1 } },
      { $group: { _id: '$rule', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])).map((x) => ({ rule: x._id, count: x.n })),
    activities: (await agg('reports', [
      { $match: siteFilter(ids) },
      { $group: { _id: '$activity', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])).map((x) => ({ activity: x._id, count: x.n })),
    sites: ids === null
      ? (await all('sites', {}, { projection: { id: 1, name: 1 } })).map(clean)
      : (await all('sites', { id: { $in: ids } }, { projection: { id: 1, name: 1 } })).map(clean),
  };
  res.json({ reports: rows, meta });
});

app.post('/api/reports', auth, async (req, res) => {
  const { text, type = 'Observation', lang, site_id: reqSite, shift = 'Day', contractor_id, source = 'form', audio_base64, audio_mime, audio_duration } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text_required' });

  const sids = await scopeSites(req.user);
  let site_id = reqSite === undefined || reqSite === null || reqSite === '' ? null : Number(reqSite);
  if (sids !== null && sids.length) site_id = sids.includes(site_id) ? site_id : sids[0];

  let ai;
  try { ai = await aiCall('/analyze', { text, lang }); }
  catch (e) { ai = fallbackAnalyze(text); }

  const confidence = ai.sif.confidence;
  const reviewStatus = confidence >= 0.9 ? 'auto_classified' : confidence >= 0.7 ? 'pending_review' : 'mandatory_review';

  const no = `OIL-${new Date().getFullYear()}-${String(await count('reports', {}) + 1).padStart(5, '0')}`;
  const id = (await run('reports', {
    report_no: no, type, text_original: text, lang: ai.language || 'english',
    text_translated: ai.translated_text || text, text_normalized: ai.normalized_text || text.toLowerCase(),
    submitter_id: req.user.id, site_id: site_id || null, contractor_id: contractor_id || null,
    activity: ai.activity, location_text: ai.location, hazard: (ai.hazards || []).join(', '),
    barrier_failure: (ai.barrier_failures || []).join(', '),
    potential_consequence: (ai.potential_consequence || []).join(', '),
    root_cause: (ai.root_cause || []).join(', ') || 'Procedure',
    sif_potential: ai.sif.prediction ? 1 : 0, sif_confidence: ai.sif.confidence,
    risk_level: ai.sif.risk_level, risk_score: ai.sif.risk_score,
    primary_lsr: ai.lsr && ai.lsr[0] ? ai.lsr[0].rule : null,
    shift, status: 'NEW', review_status: reviewStatus, source,
    quality_flags: JSON.stringify(ai.quality_flags || []), evidence_json: JSON.stringify(ai.evidence || []),
    reason_codes: JSON.stringify(ai.reason_codes || []), explanation_json: JSON.stringify(ai.explanation || []),
    recommended_actions: JSON.stringify(ai.recommended_actions || []), lsr_json: JSON.stringify(ai.lsr || []),
    model: ai.model || 'SIF-v2.4', is_duplicate: 0, created_at: nowISO(),
  })).lastInsertRowid;

  if (ai.lsr && ai.lsr.length) {
    for (const l of ai.lsr) {
      await run('lsr_predictions', { report_id: id, rule: l.rule, confidence: l.confidence, is_primary: l.primary ? 1 : 0 });
    }
  }

  if (audio_base64) {
    try {
      const ext = (audio_mime || '').includes('mp3') ? 'mp3' : (audio_mime || '').includes('mpeg') ? 'mp3' : 'webm';
      const fname = `rec-${id}.${ext}`;
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
      fs.writeFileSync(path.join(AUDIO_DIR, fname), Buffer.from(audio_base64, 'base64'));
      await update('reports', { id }, { audio_url: fname, audio_mime: audio_mime || 'audio/webm', audio_duration: Number(audio_duration) || 0 });
    } catch (e) { console.error('audio save failed', e.message); }
  }

  await audit(req.user, 'REPORT_CREATED', 'report', id, text.slice(0, 90) + (audio_base64 ? ' [voice attachment]' : ''));
  await audit(req.user, 'AI_CLASSIFIED', 'report', id, `${ai.model} conf=${confidence} review=${reviewStatus}`);

  const r = await get('reports', { id });
  const site = r.site_id ? await get('sites', { id: r.site_id }) : null;
  res.json({ report: { ...clean(r), site_name: site ? site.name : null, sif_potential: +r.sif_potential }, ai, review_status: reviewStatus });
});

app.get('/api/reports/:id', auth, async (req, res) => {
  const r = await get('reports', { id: +req.params.id });
  if (!r) return res.status(404).json({ error: 'not_found' });
  if (!(await canSeeReport(req.user, r.site_id))) return res.status(403).json({ error: 'forbidden' });
  const site = r.site_id ? await get('sites', { id: r.site_id }) : null;
  const lsrs = (await all('lsr_predictions', { report_id: r.id }, {
    projection: { rule: 1, confidence: 1, is_primary: 1, human_value: 1 },
  })).map(clean);
  const actions = (await all('actions', { report_id: r.id }, { sort: { created_at: -1 } })).map(clean);
  res.json({ report: {
    ...clean(r),
    site_name: site ? site.name : null, region: site ? site.region : null, state: site ? site.state : null,
    lsrs, actions,
  } });
});

app.get('/api/reports/:id/audio', auth, async (req, res) => {
  const r = await get('reports', { id: +req.params.id }, { projection: { audio_url: 1, audio_mime: 1, site_id: 1 } });
  if (!r || !r.audio_url) return res.status(404).json({ error: 'no_audio' });
  if (!(await canSeeReport(req.user, r.site_id))) return res.status(403).json({ error: 'forbidden' });
  const fp = path.join(AUDIO_DIR, path.basename(r.audio_url));
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'no_audio' });
  res.setHeader('Content-Type', r.audio_mime || 'audio/webm');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(r.audio_url)}"`);
  fs.createReadStream(fp).pipe(res);
});

app.patch('/api/reports/:id', auth, requireRole('Site HSE', 'Regional HSE', 'Corporate HSE', 'Supervisor', 'Administrator'), async (req, res) => {
  const r = await get('reports', { id: +req.params.id });
  if (!r) return res.status(404).json({ error: 'not_found' });
  if (!(await canSeeReport(req.user, r.site_id))) return res.status(403).json({ error: 'forbidden' });
  const { review_status, review_note, sif_potential, primary_lsr, activity, barrier_failure } = req.body;
  const set = {};
  if (review_status !== undefined) set.review_status = review_status;
  if (review_note !== undefined) set.review_note = review_note;
  if (sif_potential !== undefined) set.sif_potential = sif_potential ? 1 : 0;
  if (primary_lsr !== undefined) set.primary_lsr = primary_lsr;
  if (activity !== undefined) set.activity = activity;
  if (barrier_failure !== undefined) set.barrier_failure = barrier_failure || '';
  if (Object.keys(set).length === 0) return res.json({ ok: true });
  set.review_status = review_status || r.review_status;
  await update('reports', { id: r.id }, set);
  await audit(req.user, 'HSE_REVIEWED', 'report', r.id, (review_note || 'reviewed') + (sif_potential !== undefined ? ` sif=${sif_potential}` : ''));
  // record human correction as AI feedback when LSR or SIF is corrected
  if ((primary_lsr && primary_lsr !== r.primary_lsr) || (sif_potential !== undefined && !!sif_potential !== !!r.sif_potential)) {
    await run('ai_feedback', {
      report_id: r.id, field: primary_lsr !== undefined ? 'lsr' : 'sif', model: r.model,
      ai_value: primary_lsr !== undefined ? r.primary_lsr : (r.sif_potential ? 'true' : 'false'),
      human_value: primary_lsr !== undefined ? primary_lsr : (sif_potential ? 'true' : 'false'),
      created_by: req.user.id, created_at: nowISO(),
    });
  }
  res.json({ ok: true });
});

app.get('/api/reports/:id/similar', auth, async (req, res) => {
  const r = await get('reports', { id: +req.params.id });
  if (!r) return res.status(404).json({ error: 'not_found' });
  if (!(await canSeeReport(req.user, r.site_id))) return res.status(403).json({ error: 'forbidden' });
  const ids = await scopeSites(req.user);
  const docsFilter = { id: { $ne: r.id } };
  if (ids !== null) docsFilter.site_id = { $in: ids.length ? ids : [-1] };
  const docs = (await all('reports', docsFilter, {
    projection: { id: 1, text_original: 1, created_at: 1 },
    limit: 400,
  })).map((d) => ({ id: d.id, text: d.text_original, date: d.created_at ? String(d.created_at).slice(0, 10) : null, site: d.site_id }));
  try {
    const sim = await aiCall('/similar', { text: r.text_original, docs });
    res.json({ results: sim.results });
  } catch (e) {
    const results = docs.map((d) => {
      let s = 0;
      for (const w of r.text_original.toLowerCase().split(/\W+/)) { if (d.text.toLowerCase().includes(w) && w.length > 3) s += 1; }
      return { id: d.id, score: Math.round(Math.min(99, s * 25)) / 100, date: d.date };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
    res.json({ results });
  }
});

// ---------------------------------------------------------------------------
// AI endpoints
// ---------------------------------------------------------------------------
app.post('/api/ai/analyze', auth, async (req, res) => {
  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: 'text_required' });
  try { return res.json(await aiCall('/analyze', { text, lang })); }
  catch (e) { return res.json(fallbackAnalyze(text)); }
});

app.post('/api/ai/similar', auth, async (req, res) => {
  const { text, docs = [], limit = 10 } = req.body;
  if (!text) return res.status(400).json({ error: 'text_required' });
  try { return res.json(await aiCall('/similar', { text, docs, limit })); }
  catch (e) {
    const queryWords = text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const results = docs.map((d) => {
      let s = 0;
      for (const w of queryWords) { if ((d.text || '').toLowerCase().includes(w)) s += 1; }
      return { id: d.id, score: queryWords.length ? Math.min(0.99, s / queryWords.length) : 0, text: (d.text || '').slice(0, 140), date: d.date, site: d.site };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    res.json({ query: text, results });
  }
});

app.post('/api/patterns', auth, async (req, res) => {
  const { reports = [], window_days = 90 } = req.body;
  try { return res.json(await aiCall('/patterns', { reports, window_days })); }
  catch (e) { return res.json({ patterns: [], alerts: [] }); }
});

app.post('/api/ai/feedback', auth, async (req, res) => {
  const { report_id, field, ai_value, human_value } = req.body;
  const r = await get('reports', { id: +report_id }, { projection: { model: 1 } });
  if (!r) return res.status(404).json({ error: 'not_found' });
  await run('ai_feedback', { report_id, field, model: r.model, ai_value, human_value, created_by: req.user.id, created_at: nowISO() });
  await audit(req.user, 'FEEDBACK_RECORDED', 'report', report_id, `${field}: ${human_value}`);
  res.json({ ok: true });
});

app.get('/api/ai/metrics', auth, async (req, res) => {
  let m = { model: 'SIF-v2.4-fallback', metrics: {} };
  try { m = await aiCall('/metrics', {}); } catch (e) {}
  m.feedback_count = await count('ai_feedback', {});
  res.json(m);
});

app.post('/api/copilot', auth, async (req, res) => {
  const { query } = req.body;
  const sids = await scopeSites(req.user);
  const sf = siteFilter(sids);
  const siteMap = await getMap('sites');
  const reports = (await all('reports', sf, {
    projection: { id: 1, text_original: 1, created_at: 1, sif_potential: 1, activity: 1, barrier_failure: 1, site_id: 1, primary_lsr: 1 },
    limit: 500,
  })).map((r) => ({
    ...clean(r), site: siteMap[r.site_id] ? siteMap[r.site_id].name : 'Unknown',
    sif_potential: +r.sif_potential,
  }));
  const now = nowISO();
  const context = {
    reports,
    actions: (await all('actions', {}, {
      projection: { status: 1, due_date: 1 },
    })).map((a) => ({
      status: a.status, due_date: a.due_date,
      overdue: a.due_date < now && ['Open', 'Assigned', 'In Progress'].includes(a.status),
    })),
    alerts: (await all('alerts', { status: 'active' }, { projection: { message: 1, severity: 1 } })).map(clean),
    contractors: (await all('contractors', {}, { projection: { name: 1, score: 1 }, sort: { score: 1 } })).map(clean),
    interventions: await (async () => {
      const ivs = await all('interventions');
      const out = [];
      for (const i of ivs) {
        const measures = await all('intervention_measures', { intervention_id: i.id }, { projection: { label: 1, before_value: 1, after_value: 1 } });
        const bef = measures.find((m) => m.label === 'SIF precursor density' && m.before_value != null);
        const aft = measures.find((m) => m.label === 'SIF precursor density' && m.after_value != null);
        out.push({
          id: i.id, title: i.title, site: i.site,
          before_value: bef ? bef.before_value : null, after_value: aft ? aft.after_value : null,
          improvement_pct: bef && bef.before_value ? Math.round(((bef.before_value - (aft ? aft.after_value : bef.before_value)) / bef.before_value) * 100) : null,
          label: 'SIF precursor density',
        });
      }
      return out;
    })(),
  };
  try {
    const r = await aiCall('/copilot', { query, context });
    res.json(r);
  } catch (e) {
    res.json({ question: query, answer: 'I could not reach the AI Brain service. It runs on Python at 127.0.0.1:8050.', buttons: [] });
  }
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
app.get('/api/analytics/precursors', auth, async (req, res) => {
  const rows = (await all('patterns', {}, { sort: { report_count: -1 } })).map(clean);
  const sc = siteFilter(await scopeSites(req.user));
  const types = (await agg('reports', [
    { $match: sc },
    { $group: { _id: '$type', n: { $sum: 1 } } },
  ])).map((t) => ({ type: t._id, count: t.n }));
  res.json({ patterns: rows, types });
});

app.get('/api/analytics/activities', auth, async (req, res) => {
  const sc = siteFilter(await scopeSites(req.user));
  const rows = await agg('reports', [
    { $match: sc },
    { $group: { _id: '$activity', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } }, critical: { $sum: { $cond: [{ $in: ['$risk_level', ['CRITICAL', 'HIGH']] }, 1, 0] } } } },
    { $sort: { n: -1 } },
  ]);
  const rows2 = rows.map((a, i) => ({
    rank: i + 1, activity: a._id, reports: a.n,
    sif_pct: a.n ? Math.round((+a.sif) / a.n * 100) : 0,
    critical: +a.critical || 0,
    density: a.n ? +((+a.sif) / a.n).toFixed(3) : 0,
  }));
  res.json({ activities: rows2 });
});

app.get('/api/analytics/barriers', auth, async (req, res) => {
  const sc = siteFilter(await scopeSites(req.user));
  const rows = await agg('reports', [
    { $match: { ...sc, barrier_failure: { $nin: [null, ''] } } },
    { $group: { _id: '$barrier_failure', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
    { $sort: { n: -1 } },
  ]);
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  res.json({ barriers: rows.map((b) => ({
    barrier: b._id, count: b.n, pct: Math.round(b.n / total * 100),
    sif: +b.sif || 0, density: b.n ? +((+b.sif) / b.n).toFixed(3) : 0,
  })) });
});

app.get('/api/analytics/lsr', auth, async (req, res) => {
  const sids = await scopeSites(req.user);
  const sc = siteFilter(sids);
  const rows = await agg('reports', [
    { $match: { ...sc, primary_lsr: { $ne: null } } },
    { $group: { _id: '$primary_lsr', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
    { $sort: { n: -1 } },
  ]);
  // 90-day trend for each rule
  const t90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const rows2 = [];
  for (const r of rows) {
    const trend = (await agg('reports', [
      { $match: { ...sc, primary_lsr: r._id, created_at: { $gte: t90 } } },
      { $group: { _id: { $substr: ['$created_at', 0, 7] }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])).map((x) => ({ d: x._id, n: x.n }));
    const first = trend.slice(0, Math.max(1, Math.floor(trend.length / 2))).reduce((s, x) => s + x.n, 0);
    const last = trend.slice(Math.floor(trend.length / 2)).reduce((s, x) => s + x.n, 0);
    const change = (f, l) => f ? Math.round((l - f) / f * 100) : 0;
    rows2.push({ rule: r._id, count: r.n, sif: +r.sif || 0, trend, change: change(first, last) });
  }
  res.json({ lsr: rows2 });
});

app.get('/api/analytics/sites', auth, async (req, res) => {
  const ids = await scopeSites(req.user);
  const sc = siteFilter(ids);
  const rows = await agg('reports', [
    { $match: sc },
    { $group: { _id: '$site_id', reports: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } }, critical: { $sum: { $cond: [{ $in: ['$risk_level', ['CRITICAL', 'HIGH']] }, 1, 0] } } } },
  ]);
  const siteMap = await getMap('sites');
  const total = rows.reduce((s, r) => s + +r.reports, 0) || 1;
  res.json({ sites: rows.map((s2) => {
    const m = siteMap[s2._id] || {};
    return {
      id: s2._id, name: m.name, region: m.region, state: m.state, field: m.field,
      reports: +s2.reports, sif: +s2.sif || 0, critical: +s2.critical || 0,
      pct: Math.round(+s2.reports / total * 100), density: s2.reports ? +((+s2.sif) / +s2.reports).toFixed(3) : 0,
    };
  }) });
});

app.get('/api/analytics/heatmap', auth, async (req, res) => {
  const sc = siteFilter(await scopeSites(req.user));
  const siteMap = await getMap('sites');
  const rows = await agg('reports', [
    { $match: { ...sc, primary_lsr: { $ne: null } } },
    { $group: { _id: { site: '$site_id', rule: '$primary_lsr' }, n: { $sum: 1 } } },
  ]);
  const sites = [...new Set(rows.map((r) => siteMap[r._id.site] ? siteMap[r._id.site].name : null).filter(Boolean))];
  const rules = ['Energy Isolation', 'Hot Work', 'Confined Space', 'Line of Fire', 'Working at Height', 'Safe Mechanical Lifting', 'Work Authorisation', 'Driving', 'Bypassing Safety Controls', 'General / Housekeeping'];
  const cells = {};
  for (const r of rows) cells[`${siteMap[r._id.site] ? siteMap[r._id.site].name : ''}|${r._id.rule}`] = r.n;
  const grid = sites.map((site) => {
    const row = { site };
    for (const rule of rules) {
      const n = +cells[`${site}|${rule}`] || 0;
      row[rule] = n;
    }
    return row;
  });
  const risk = (await agg('reports', [
    { $match: { ...sc, primary_lsr: { $ne: null } } },
    { $group: { _id: { site: '$site_id', rule: '$primary_lsr', level: '$risk_level' }, n: { $sum: 1 } } },
  ]))
    .map((r) => ({ site: siteMap[r._id.site] ? siteMap[r._id.site].name : null, rule: r._id.rule, risk_level: r._id.level, count: r.n }))
    .filter((r) => r.site);
  res.json({ sites, rules, grid, risk });
});

app.get('/api/analytics/trends', auth, async (req, res) => {
  const sc = siteFilter(await scopeSites(req.user));
  const t = (await agg('reports', [
    { $match: { ...sc, created_at: { $gte: new Date(Date.now() - 180 * 864e5).toISOString() } } },
    { $group: { _id: { $substr: ['$created_at', 0, 7] }, n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } }, energy_iso: { $sum: { $cond: [{ $eq: ['$barrier_failure', 'Energy Isolation'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]))
    .map((x) => ({ d: x._id, n: x.n, sif: +x.sif || 0, energy_iso: +x.energy_iso || 0 }));
  const activities = (await agg('reports', [
    { $match: sc },
    { $group: { _id: '$activity', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
    { $sort: { n: -1 } },
    { $limit: 8 },
  ]))
    .map((a) => ({ activity: a._id, n: a.n, sif: +a.sif || 0 }));
  const byShift = (await agg('reports', [
    { $match: sc },
    { $group: { _id: '$shift', n: { $sum: 1 }, sif: { $sum: { $ifNull: ['$sif_potential', 0] } } } },
  ]))
    .map((x) => ({ shift: x._id, n: x.n, sif: +x.sif || 0 }));
  const weekdayRows = await all('reports', sc, { projection: { created_at: 1 } });
  const dowMap = {};
  for (const r of weekdayRows) {
    const dow = r.created_at ? new Date(r.created_at).getUTCDay() : null;
    if (dow == null) continue;
    dowMap[dow] = (dowMap[dow] || 0) + 1;
  }
  const weekday = Object.keys(dowMap).sort().map((d) => ({ dow: d, count: dowMap[d] }));
  res.json({ trend: t, activities, by_shift: byShift, weekday });
});

// ---------------------------------------------------------------------------
// Contractors
// ---------------------------------------------------------------------------
app.get('/api/contractors', auth, async (req, res) => {
  const contractors = await all('contractors', { active: 1 });
  const repRows = await all('reports', {}, { projection: { contractor_id: 1, sif_potential: 1, risk_level: 1 } });
  const actRows = await all('actions', {}, { projection: { report_id: 1, status: 1 } });
  const contractOf = {};
  const stats = {};
  for (const r of repRows) {
    contractOf[r.id] = r.contractor_id;
    if (r.contractor_id == null) continue;
    const s = stats[r.contractor_id] || (stats[r.contractor_id] = { reports: 0, sif: 0, critical: 0, closed: 0, total: 0 });
    s.reports++;
    s.sif += r.sif_potential || 0;
    if (r.risk_level === 'CRITICAL') s.critical++;
  }
  for (const a of actRows) {
    const cid = contractOf[a.report_id];
    if (cid == null) continue;
    const s = stats[cid] || (stats[cid] = { reports: 0, sif: 0, critical: 0, closed: 0, total: 0 });
    s.total++;
    if (a.status === 'Closed') s.closed++;
  }
  res.json({ contractors: contractors.map((c) => {
    const s = stats[c.id] || { reports: 0, sif: 0, critical: 0, closed: 0, total: 0 };
    const out = {
      ...clean(c), reports: +s.reports || 0, sif: +s.sif || 0, critical: +s.critical || 0,
      sif_pct: +s.reports ? Math.round((+s.sif) / +s.reports * 100) : 0,
      closure_rate: +s.total ? Math.round((+s.closed) / (+s.total) * 100) : 100,
    };
    return out;
  }) });
});

app.post('/api/contractors', auth, requireRole('Administrator', 'Corporate HSE', 'Regional HSE'), async (req, res) => {
  const { name, specialty = '', score } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Contractor name is required' });
  const id = (await run('contractors', {
    name: name.trim(), specialty: specialty.trim() || 'General Services',
    score: score != null ? Math.min(100, Math.max(0, +score)) : 70,
    active: 1, created_at: nowISO(),
  })).lastInsertRowid;
  await audit(req.user, 'CONTRACTOR_ADDED', 'contractor', id, name);
  res.json({ id });
});

// ---------------------------------------------------------------------------
// CAPA
// ---------------------------------------------------------------------------
app.get('/api/actions', auth, async (req, res) => {
  const sids = await scopeSites(req.user);
  const reportMap = await getMap('reports');
  const userMap = await getMap('users');
  const siteMap = await getMap('sites');
  let acts = await all('actions', {}, { sort: { created_at: -1 } });
  if (sids !== null) {
    const repIds = await all('reports', { site_id: { $in: sids } }, { projection: { id: 1 } });
    const allowed = new Set(repIds.map((r) => r.id));
    acts = acts.filter((a) => allowed.has(a.report_id));
  }
  const now = nowISO();
  res.json({ actions: acts.map((a) => {
    const r = reportMap[a.report_id] || {};
    const s = siteMap[r.site_id] || {};
    return {
      ...clean(a),
      assignee: userMap[a.assignee_id] ? userMap[a.assignee_id].full_name : null,
      report_no: r.report_no || null, text_original: r.text_original || null, risk_level: r.risk_level || null,
      site_name: s.name || null,
      overdue: a.status !== 'Closed' && a.due_date && a.due_date < now,
    };
  }).sort((x, y) => String(x.report_no || '').localeCompare(String(y.report_no || ''), undefined, { numeric: true })) });
});

app.post('/api/actions', auth, requireRole('Site HSE', 'Regional HSE', 'Corporate HSE', 'Supervisor', 'Administrator'), async (req, res) => {
  const { report_id, title, description = '', priority = 'MEDIUM', assignee_id = null, due_date } = req.body;
  if (report_id) {
    const r = await get('reports', { id: +report_id }, { projection: { site_id: 1 } });
    if (!r) return res.status(404).json({ error: 'not_found' });
    if (!(await canSeeReport(req.user, r.site_id))) return res.status(403).json({ error: 'forbidden' });
  }
  const id = (await run('actions', {
    report_id: report_id || null, title, description, priority, status: 'Open', assignee_id,
    due_date: due_date || null, created_by: req.user.id, created_at: nowISO(),
  })).lastInsertRowid;
  await audit(req.user, 'ACTION_CREATED', 'action', id, title);
  res.json({ id });
});

app.patch('/api/actions/:id', auth, requireRole('Site HSE', 'Regional HSE', 'Corporate HSE', 'Supervisor', 'Administrator'), async (req, res) => {
  const a = await get('actions', { id: +req.params.id });
  if (!a) return res.status(404).json({ error: 'not_found' });
  const { status, assignee_id, evidence, verification_note, due_date, priority } = req.body;
  const set = {};
  if (status !== undefined) set.status = status;
  if (assignee_id !== undefined) set.assignee_id = assignee_id;
  if (evidence !== undefined) set.evidence = evidence;
  if (verification_note !== undefined) set.verification_note = verification_note;
  if (due_date !== undefined) set.due_date = due_date;
  if (priority !== undefined) set.priority = priority;
  if (Object.keys(set).length) await update('actions', { id: a.id }, set);
  await audit(req.user, `ACTION_${(status || 'UPDATED').toUpperCase().replace(/ /g, '_')}`, 'action', a.id, (evidence ? 'evidence uploaded' : ''));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
app.get('/api/alerts', auth, async (req, res) => {
  const rows = (await all('alerts', {}, { sort: { created_at: -1 } })).map(clean);
  res.json({ alerts: rows });
});
app.post('/api/alerts/:id/ack', auth, async (req, res) => {
  await update('alerts', { id: +req.params.id }, { status: 'acknowledged', ack_by: req.user.id, ack_at: nowISO() });
  await audit(req.user, 'ALERT_ACKNOWLEDGED', 'alert', +req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Knowledge / Lessons / Investigations / Interventions / Inspections / Courses
// ---------------------------------------------------------------------------
app.get('/api/knowledge', auth, async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  let rows = await all('knowledge_docs', {}, { sort: { category: 1, title: 1 } });
  if (q) rows = rows.filter((d) => (d.title + d.content + (d.tags || '')).toLowerCase().includes(q));
  res.json({ docs: rows.map((d) => ({ ...clean(d), tags: JSON.parse(d.tags || '[]') })) });
});
app.post('/api/knowledge', auth, requireRole('Administrator', 'Corporate HSE'), async (req, res) => {
  const { title, category, content, tags } = req.body;
  const id = (await run('knowledge_docs', {
    title, category, content, tags: JSON.stringify(tags || []), created_at: nowISO(),
  })).lastInsertRowid;
  await audit(req.user, 'DOCUMENT_UPLOADED', 'knowledge', id, title);
  res.json({ id });
});

app.get('/api/lessons', auth, async (req, res) => {
  res.json({ lessons: (await all('lessons', {}, { sort: { created_at: -1 } })).map(clean) });
});

app.get('/api/investigations', auth, async (req, res) => {
  const sids = await scopeSites(req.user);
  const reportMap = await getMap('reports');
  const userMap = await getMap('users');
  let rows = await all('investigations', {}, { sort: { created_at: -1 } });
  if (sids !== null) {
    const repIds = await all('reports', { site_id: { $in: sids } }, { projection: { id: 1 } });
    const allowed = new Set(repIds.map((r) => r.id));
    rows = rows.filter((i) => allowed.has(i.report_id));
  }
  const out = rows.map((i) => ({
    ...clean(i),
    investigator: userMap[i.investigator_id] ? userMap[i.investigator_id].full_name : null,
    report_no: reportMap[i.report_id] ? reportMap[i.report_id].report_no : null,
    text_original: reportMap[i.report_id] ? reportMap[i.report_id].text_original : null,
  }));
  res.json({ investigations: out });
});

app.post('/api/investigations', auth, requireRole('Site HSE', 'Regional HSE', 'Corporate HSE', 'Administrator'), async (req, res) => {
  const { report_id, title, immediate_cause = '', contributing = [], root_cause = '', summary = '' } = req.body;
  if (report_id) {
    const r = await get('reports', { id: +report_id }, { projection: { site_id: 1 } });
    if (!r) return res.status(404).json({ error: 'not_found' });
    if (!(await canSeeReport(req.user, r.site_id))) return res.status(403).json({ error: 'forbidden' });
  }
  const id = (await run('investigations', {
    report_id: report_id || null, title, status: 'open', immediate_cause,
    contributing: JSON.stringify(contributing), root_cause,
    timeline: '[]', evidence: '[]', ai_json: '{}',
    investigator_id: req.user.id, summary, created_at: nowISO(),
  })).lastInsertRowid;
  await audit(req.user, 'INVESTIGATION_STARTED', 'investigation', id, title);
  res.json({ id });
});

app.get('/api/interventions', auth, async (req, res) => {
  const rows = await all('interventions', {}, { sort: { created_at: -1 } });
  const withMeasures = [];
  for (const i of rows) {
    const measures = (await all('intervention_measures', { intervention_id: i.id })).map(clean);
    const sifBefore = measures.find((m) => m.label === 'SIF precursor density' && m.before_value != null);
    const sifAfter = measures.find((m) => m.label === 'SIF precursor density' && m.after_value != null);
    withMeasures.push({
      ...clean(i), measures,
      improvement_pct: sifBefore && sifBefore.before_value
        ? Math.round((sifBefore.before_value - (sifAfter ? sifAfter.after_value : sifBefore.before_value)) / sifBefore.before_value * 100)
        : null,
    });
  }
  res.json({ interventions: withMeasures });
});

app.get('/api/inspections', auth, async (req, res) => {
  const sids = await scopeSites(req.user);
  const siteMap = await getMap('sites');
  let rows = await all('inspections', {}, { sort: { date: -1 } });
  if (sids !== null) rows = rows.filter((i) => sids.includes(i.site_id));
  res.json({ inspections: rows.map((i) => ({
    ...clean(i),
    site_name: siteMap[i.site_id] ? siteMap[i.site_id].name : null,
    checklist: JSON.parse(i.checklist || '[]'),
    findings: JSON.parse(i.findings || '[]'),
  })) });
});

app.get('/api/courses', auth, async (req, res) => {
  res.json({ courses: (await all('courses', {}, { sort: { created_at: -1 } })).map(clean) });
});

// ---------------------------------------------------------------------------
// Sites & assets
// ---------------------------------------------------------------------------
app.get('/api/sites', auth, async (req, res) => {
  const rows = (await all('sites', {}, { projection: { id: 1, name: 1, region: 1, state: 1, field: 1, lat: 1, lng: 1 } })).map(clean);
  res.json({ sites: rows });
});
app.get('/api/assets', auth, async (req, res) => {
  const siteMap = await getMap('sites');
  const rows = (await all('assets')).map((a) => ({ ...clean(a), site_name: siteMap[a.site_id] ? siteMap[a.site_id].name : null }));
  res.json({ assets: rows });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
app.get('/api/notifications', auth, async (req, res) => {
  const rows = (await all('notifications', {}, { sort: { created_at: -1 }, limit: 50 })).map(clean);
  res.json({ notifications: rows });
});
app.post('/api/notifications/read-all', auth, async (req, res) => {
  await updateMany('notifications', {}, { read: 1 });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
app.get('/api/admin/audit', auth, requireRole('Administrator', 'Corporate HSE'), requireModule('admin'), async (req, res) => {
  res.json({ audit: (await all('audit_log', {}, { sort: { created_at: -1 }, limit: 300 })).map(clean) });
});
app.get('/api/admin/users', auth, requireRole('Administrator'), requireModule('admin'), async (req, res) => {
  const siteMap = await getMap('sites');
  const rows = await all('users', {}, { projection: { id: 1, username: 1, full_name: 1, role: 1, site_id: 1, email: 1 } });
  const users = [];
  for (const u of rows) {
    users.push({
      ...clean(u),
      site_name: siteMap[u.site_id] ? siteMap[u.site_id].name : null,
      modules: await effectiveModules(u.id, u.role),
      role_default: ROLE_MODULES[u.role] || [],
    });
  }
  res.json({ users, modules: MODULES });
});
app.post('/api/admin/users/:id/modules', auth, requireRole('Administrator'), requireModule('admin'), async (req, res) => {
  const target = await get('users', { id: +req.params.id });
  if (!target) return res.status(404).json({ error: 'not_found' });
  const { module, granted, reset } = req.body;
  if (reset) {
    await remove('user_modules', { user_id: target.id });
  } else {
    if (!MODULES.includes(module)) return res.status(400).json({ error: 'unknown_module' });
    const exists = await get('user_modules', { user_id: target.id, module });
    if (exists) {
      await update('user_modules', { user_id: target.id, module }, { granted: granted ? 1 : 0, updated_at: nowISO(), updated_by: req.user.id });
    } else {
      await run('user_modules', { user_id: target.id, module, granted: granted ? 1 : 0, updated_at: nowISO(), updated_by: req.user.id });
    }
  }
  await audit(req.user, reset ? 'ACCESS_RESET' : 'ACCESS_GRANT_CHANGED', 'user', target.id, `${reset ? 'reset to role defaults' : `${module} -> ${granted ? 'granted' : 'denied'}`}`);
  res.json({ ok: true, modules: await effectiveModules(target.id, target.role) });
});
app.post('/api/admin/users', auth, requireRole('Administrator'), requireModule('admin'), async (req, res) => {
  const { username, password, full_name, role, email, site_id } = req.body || {};
  const uname = String(username || '').trim();
  if (!uname || !password) return res.status(400).json({ error: 'username_and_password_required' });
  if (!ROLE_MODULES[role]) return res.status(400).json({ error: 'invalid_role' });
  const existing = await get('users', { username: uname });
  if (existing) return res.status(409).json({ error: 'username_exists' });
  if (site_id) {
    const site = await get('sites', { id: +site_id });
    if (!site) return res.status(400).json({ error: 'invalid_site' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPw(password, salt);
  const id = (await run('users', {
    username: uname,
    password_hash: hash,
    salt,
    full_name: (full_name || '').trim() || uname,
    role,
    site_id: site_id ? +site_id : null,
    email: (email || '').trim() || null,
    created_at: nowISO(),
  })).lastInsertRowid;
  await audit(req.user, 'USER_CREATED', 'user', id, `${(full_name || '').trim() || uname} (${role})`);
  res.json({ ok: true, id });
});
app.get('/api/admin/models', auth, requireRole('Administrator', 'Corporate HSE', 'Regional HSE', 'Site HSE'), async (req, res) => {
  const reportMap = await getMap('reports');
  const userMap = await getMap('users');
  res.json({
    models: (await all('model_versions', {}, { sort: { created_at: -1 } })).map(clean),
    feedback: (await all('ai_feedback', {}, { sort: { created_at: -1 } })).map((f) => ({
      ...clean(f),
      report_no: reportMap[f.report_id] ? reportMap[f.report_id].report_no : null,
      reviewer: userMap[f.created_by] ? userMap[f.created_by].full_name : null,
    })),
  });
});
app.get('/api/data-quality', auth, async (req, res) => {
  const total = (await count('reports', {})) || 1;
  const q = async (f) => count('reports', { quality_flags: { $regex: f } });
  res.json({
    total,
    ai_ready: total - await q('very_short'),
    missing_location: await q('missing_location'),
    missing_activity: await q('missing_activity'),
    low_confidence: await count('reports', { sif_confidence: { $lt: 0.7 } }),
    duplicates: await count('reports', { is_duplicate: 1 }),
    unmapped_lsr: await count('reports', { primary_lsr: null }),
  });
});

// ---------------------------------------------------------------------------
// Seed utility route (admin)
// ---------------------------------------------------------------------------
app.post('/api/admin/reseed', auth, requireRole('Administrator'), requireModule('admin'), async (req, res) => {
  const r = await seed();
  res.json({ ok: true, ...r });
});

// ---------------------------------------------------------------------------
// Serve frontend (dist from Vite build)
// ---------------------------------------------------------------------------
const FRONT = path.join(__dirname, '..', 'frontend');
const DIST = path.join(FRONT, 'dist');
app.use(express.static(DIST));
app.get('*splat', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'unknown_endpoint' });
  res.sendFile(path.join(DIST, 'index.html'));
});

async function start() {
  // auto-seed empty DB
  const reportCount = await count('reports', {});
  if (!reportCount) {
    console.log('Empty database - seeding demo data...');
    await seed();
  }
  app.listen(PORT, () => {
    console.log(`OIL-SIF Intelligence API running on http://localhost:${PORT}`);
    console.log(`AI Brain expected at ${AI_URL}`);
  });
}

start();