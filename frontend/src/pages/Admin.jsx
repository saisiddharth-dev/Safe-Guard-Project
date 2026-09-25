import { useState } from 'react';
import { api } from '../api';
import { Card, Spinner, Empty, SectionTitle, Progress, fmt, useFetch, Icon, Modal, TabBar } from '../components/UI';
import { useAuth } from '../AuthContext';
import { Check, X as XIcon, ChevronDown, ChevronRight, RotateCcw, Plus } from 'lucide-react';
import { useI18n } from '../i18n';

const ROLE_TAG = {
  Administrator: 'Admin', Executive: 'CXO', 'Corporate HSE': 'Corp HSE',
  'Regional HSE': 'Reg HSE', 'Site HSE': 'Site HSE', Supervisor: 'Supervisor', Worker: 'Worker',
};

const ROLE_COLOR = {
  Administrator: 'text-red-400 bg-red-500/10 border-red-500/30',
  Executive: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  'Corporate HSE': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'Regional HSE': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'Site HSE': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  Supervisor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  Worker: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

const MODULE_LABELS = {
  commandcenter: 'Command Center', reports: 'Safety Reports', alerts: 'Alerts', copilot: 'Safety Copilot',
  ai: 'AI Intelligence', precursors: 'SIF Precursors', lsr: 'Life-Saving Rules', riskmap: 'Risk Map',
  sites: 'Sites & Assets', contractors: 'Contractors', investigations: 'Investigations', capa: 'CAPA',
  inspections: 'Inspections', knowledge: 'Knowledge Base', analytics: 'Analytics', admin: 'Administration',
};

const MODULE_SECTIONS = [
  { title: 'Operations', keys: ['commandcenter', 'reports', 'alerts', 'copilot'] },
  { title: 'Intelligence', keys: ['ai', 'precursors', 'lsr', 'riskmap'] },
  { title: 'Enterprise', keys: ['sites', 'contractors', 'investigations', 'capa', 'inspections', 'knowledge'] },
  { title: 'Insight', keys: ['analytics', 'admin'] },
];

export default function Admin() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState('access');
  const audit = useFetch('/admin/audit');
  const models = useFetch('/admin/models');
  const quality = useFetch('/data-quality');
  const users = useFetch('/admin/users');
  const sites = useFetch('/analytics/sites');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="settings" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Administration')}</span></h1>
        <p className="text-sm text-slate-500">{t('Access Control · data quality · audit trail · model governance · users')}</p>
      </div>

      <TabBar
        tabs={[['access', t('Access Control')], ['users', t('Users & Roles')], ['data', t('Data Quality')], ['audit', t('Audit Trail')], ['models', t('AI Models')]].map(([id, l]) => ({ id, label: l }))}
        active={tab}
        onChange={setTab}
        idleClassName="text-slate-400"
        containerClassName="w-full rounded-lg border border-ink-700 bg-ink-900 p-1"
      />

      {tab === 'access' && <AccessControl data={users} />}
      {tab === 'users' && <Users data={users} sites={sites} />}
      {tab === 'data' && <DataQuality data={quality} />}
      {tab === 'audit' && <Audit data={audit} />}
      {tab === 'models' && <Models data={models} />}
    </div>
  );
}

/* ─── Access Control ─────────────────────────────────────────────── */

function AccessControl({ data }) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [draft, setDraft] = useState({}); // { userId: { module: bool } } pending changes

  const modSetOf = (u) => new Set(u.modules || []);
  const roleDefaultSetOf = (u) => new Set(u.role_default || []);
  const isLockedMod = (u, m) => (u.role === 'Administrator' && m === 'knowledge') || m === 'admin';
  const baseOn = (u, m) => modSetOf(u).has(m) && !(u.role === 'Administrator' && m === 'knowledge');
  const displayOn = (u, m) => (u.role === 'Administrator' && m === 'admin') ? true : draft[u.id]?.[m] ?? baseOn(u, m);

  const changedModules = (u) => {
    const changes = [];
    for (const m of allModules) {
      if (isLockedMod(u, m)) continue;
      const target = !!displayOn(u, m);
      if (target !== baseOn(u, m)) changes.push({ module: m, granted: target });
    }
    return changes;
  };

  const toggle = (u, m) => {
    if (isLockedMod(u, m)) return;
    setDraft((d) => {
      const prev = d[u.id]?.[m] ?? baseOn(u, m);
      return { ...d, [u.id]: { ...(d[u.id] || {}), [m]: !prev } };
    });
  };

  const saveChanges = async (u) => {
    const changes = changedModules(u);
    if (!changes.length) return;
    setSavingId(u.id);
    try {
      for (const c of changes) {
        await api(`/admin/users/${u.id}/modules`, { method: 'POST', body: { module: c.module, granted: c.granted } });
      }
      data.reload();
      setDraft((d) => { const { [u.id]: _, ...rest } = d; return rest; });
    } catch (e) { console.error(e); }
    setSavingId(null);
  };

  const resetAll = async (u) => {
    if (!confirm(t('Reset all module overrides to role defaults?'))) return;
    setSavingId(u.id);
    try {
      await api(`/admin/users/${u.id}/modules`, { method: 'POST', body: { reset: true } });
      data.reload();
      setDraft((d) => { const { [u.id]: _, ...rest } = d; return rest; });
    } catch (e) { console.error(e); }
    setSavingId(null);
  };

  if (data.loading) return <Spinner />;
  const users = data.data?.users || [];
  const allModules = data.data?.modules || [];

  return (
    <Card>
      <SectionTitle title={t('Module Access Control')} sub={t('Tick the modules you want to grant, then hit Save per user.')} />
      {!users.length && <Empty />}
      <div className="space-y-2">
        {users.map((u) => {
          const isExpanded = expandedId === u.id;
          const modSet = modSetOf(u);
          const roleDefaultSet = roleDefaultSetOf(u);
          const hasCustom = allModules.some((m) => modSet.has(m) !== roleDefaultSet.has(m));
          const changes = changedModules(u);
          return (
            <div key={u.id} className={`rounded-xl border ${isExpanded ? 'border-brand/50' : 'border-ink-700'} bg-ink-900 transition-colors`}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : u.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {(u.full_name || u.username || '?').slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{u.full_name || u.username}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className={`rounded border px-1.5 py-0.5 font-semibold ${ROLE_COLOR[u.role] || 'text-slate-400 bg-ink-800 border-ink-600'}`}>
                      {t(ROLE_TAG[u.role] || u.role)}
                    </span>
                    {u.site_name && <span>@ {u.site_name}</span>}
                    {hasCustom && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">{t('Custom')}</span>}
                  </div>
                </div>
                <span className="mr-1 rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                  {modSet.size}/{allModules.length}
                </span>
                {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              </button>

              {isExpanded && (
                <div className="border-t border-ink-700 px-4 pb-4 pt-3">
                  {MODULE_SECTIONS.map((sec) => (
                    <div key={sec.title} className="mb-3 last:mb-0">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{t(sec.title)}</div>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {sec.keys.map((m) => {
                          const locked = isLockedMod(u, m);
                          if (m === 'admin' && u.role !== 'Administrator') return null;
                          const on = displayOn(u, m);
                          const isDefault = roleDefaultSet.has(m);
                          const changed = draft[u.id]?.[m] !== undefined && !!draft[u.id]?.[m] !== baseOn(u, m);
                          return (
                            <button
                              key={m}
                              disabled={savingId === u.id || locked}
                              onClick={() => toggle(u, m)}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-ink-700 bg-ink-800 text-slate-500'
                              } ${changed ? `${on ? 'ring-1' : 'ring-1'} ring-amber-400/70` : ''} ${locked ? 'cursor-not-allowed opacity-70' : 'hover:bg-ink-700'}`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-ink-600 text-transparent'}`}>
                                {on ? <Check size={12} /> : <XIcon size={12} />}
                              </span>
                              <span className="min-w-0 truncate">{t(MODULE_LABELS[m] || m)}</span>
                              {changed && <span className="ml-auto rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold text-amber-400">{t('unsaved')}</span>}
                              {!isDefault && !changed && <span className="ml-auto rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold text-amber-400">{t('override')}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-700 pt-3">
                    <button
                      disabled={savingId === u.id || !changes.length}
                      onClick={() => saveChanges(u)}
                      className="tap items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      <Check size={12} /> {changes.length ? t('Save Changes ({n})', { n: changes.length }) : t('Save Changes')}
                    </button>
                    <button
                      disabled={savingId === u.id || u.role === 'Administrator'}
                      onClick={() => resetAll(u)}
                      className="tap items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-ink-700 disabled:opacity-50"
                    >
                      <RotateCcw size={12} /> {t('Reset to Role Default')}
                    </button>
                    {savingId === u.id && <Spinner size={14} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─── Users ───────────────────────────────────────────────────────── */

const ROLES = Object.keys(ROLE_TAG);

function Users({ data, sites }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  if (data.loading) return <Spinner />;
  const users = data.data?.users || [];
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">{t('Users & roles')}</h2>
          <p className="text-xs text-slate-500">{t('Role-Based Access Control — site-scoped data access')}</p>
        </div>
        <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setAdding(true)}><Plus size={14} /> {t('Add User')}</button>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr><th className="th">{t('Username')}</th><th className="th">{t('Name')}</th><th className="th">{t('Role')}</th><th className="th">{t('Site')}</th><th className="th">{t('Modules')}</th><th className="th">{t('Email')}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-ink-700/60">
                <td className="td font-mono text-xs">{u.username}</td>
                <td className="td font-semibold text-white">{u.full_name}</td>
                <td className="td"><span className={`chip border ${ROLE_COLOR[u.role] || 'border-ink-600 bg-ink-800 text-slate-300'}`}>{t(ROLE_TAG[u.role] || u.role)}</span></td>
                <td className="td text-xs text-slate-400">{u.site_name || t('All Sites')}</td>
                <td className="td"><span className="chip bg-ink-700 text-xs font-bold text-slate-300">{u.modules?.length ?? '—'}</span></td>
                <td className="td text-xs text-slate-400">{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <AddUserModal sites={sites} onClose={() => setAdding(false)} onDone={() => { setAdding(false); data.reload(); }} />}
    </Card>
  );
}

function AddUserModal({ sites, onClose, onDone }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', full_name: '', email: '', role: 'Site HSE', site_id: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await api.post('/admin/users', { ...form, site_id: form.site_id ? +form.site_id : null, email: form.email.trim() || null });
      onDone();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Plus size={16} /> {t('Add new user')}</span>}>
      <div className="space-y-2">
        <div>
          <label className="label">{t('Full name')} *</label>
          <input className="input" value={form.full_name} onChange={set('full_name')} placeholder={t('e.g. Site HSE Dibrugarh')} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">{t('Username')} *</label>
            <input className="input" value={form.username} onChange={set('username')} placeholder={t('e.g. site_hse_dbr')} />
          </div>
          <div>
            <label className="label">{t('Password')} *</label>
            <input type="password" className="input" value={form.password} onChange={set('password')} />
          </div>
        </div>
        <div>
          <label className="label">{t('Email')}</label>
          <input className="input" value={form.email} onChange={set('email')} placeholder={t('e.g. user@oil-india.in')} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">{t('Role')}</label>
            <select className="input" value={form.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_TAG[r] || r)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('Site')}</label>
            <select className="input" value={form.site_id} onChange={set('site_id')}>
              <option value="">{t('All Sites')}</option>
              {(sites.data?.sites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn-primary" disabled={busy || !form.username || !form.password || !form.full_name} onClick={submit}>
            {busy ? t('Saving…') : t('Create user')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Data Quality ───────────────────────────────────────────────── */

function DataQuality({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const q = data.data || {};
  const bars = [
    [t('AI-ready reports'), q.ai_ready, q.total, '#10b981'],
    [t('Missing location'), q.missing_location, q.total, '#f59e0b'],
    [t('Missing activity'), q.missing_activity, q.total, '#f59e0b'],
    [t('Low-confidence'), q.low_confidence, q.total, '#ef4444'],
    [t('Duplicates'), q.duplicates, q.total, '#8b5cf6'],
    [t('Unmapped LSR'), q.unmapped_lsr, q.total, '#06b6d4'],
  ];
  return (
    <Card>
      <SectionTitle title={t('Data Quality Dashboard')} sub={t('Monitoring the quality of the intelligence itself')} />
      <div className="grid gap-4 sm:grid-cols-2">
        {bars.map(([l, v, total, c]) => (
          <div key={l} className="rounded-lg border border-ink-700 bg-ink-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{l}</span>
              <span className="text-sm font-extrabold text-white">{fmt.num(v)} <span className="text-xs text-slate-500">/ {fmt.num(total)}</span></span>
            </div>
            <div className="mt-2"><Progress value={(v / (total || 1)) * 100} color={c} /></div>
            <div className="mt-1 text-[11px] text-slate-500">{Math.round((v / (total || 1)) * 100)}%</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Audit Trail ────────────────────────────────────────────────── */

function Audit({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = data.data?.audit || [];
  return (
    <Card>
      <SectionTitle title={t('Full audit trail')} sub={t('Nothing silently disappears — every decision is traceable')} />
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[620px]">
          <thead><tr><th className="th">{t('Action')}</th><th className="th">{t('Entity')}</th><th className="th">{t('User')}</th><th className="th">{t('Detail')}</th><th className="th">{t('Time')}</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-ink-700/60">
                <td className="td"><span className="chip border border-ink-600 bg-ink-800 text-slate-300">{a.action}</span></td>
                <td className="td text-xs text-slate-400">{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                <td className="td text-xs">{a.user_name}</td>
                <td className="td max-w-[280px] truncate text-xs text-slate-500">{a.detail}</td>
                <td className="td font-mono text-[10px] text-slate-500">{fmt.dt(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
    </Card>
  );
}

/* ─── AI Models ──────────────────────────────────────────────────── */

function Models({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const models = data.data?.models || [];
  const feedback = data.data?.feedback || [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t('Model versions')} sub={t('Every prediction stores its model version for explainability')} />
        {models.map((m) => {
          const mm = (() => { try { return JSON.parse(m.metrics || '{}'); } catch { return {}; } })();
          return (
            <div key={m.id} className={`mb-3 rounded-lg border p-4 ${m.active ? 'border-emerald-500/30' : 'border-ink-700'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words font-bold text-white">{m.name}</span>
                {m.active ? <span className="chip bg-emerald-500/15 text-emerald-400">● {t('Active')}</span> : <span className="chip bg-slate-500/15 text-slate-400">{t('Inactive')}</span>}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Mini l={t('Precision')} v={Math.round((mm.sif_precision || 0) * 100)} />
                <Mini l={t('Recall')} v={Math.round((mm.sif_recall || 0) * 100)} />
                <Mini l={t('LSR acc')} v={Math.round((mm.lsr_accuracy || 0) * 100)} />
              </div>
            </div>
          );
        })}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          {t('Model drift detection: when language changes ("line breaking" → "equipment opening"), monitoring flags performance degradation for retraining.')}
        </div>
      </Card>
      <Card>
        <SectionTitle title={t('Retraining signals')} sub={t('Human corrections = future training data')} />
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[480px]">
            <thead><tr><th className="th">{t('Report')}</th><th className="th">{t('Field')}</th><th className="th">{t('AI → Human')}</th></tr></thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id} className="border-t border-ink-700/60">
                  <td className="td font-mono text-[11px]">{f.report_no || f.report_id}</td>
                  <td className="td capitalize text-xs">{f.field}</td>
                  <td className="td text-xs"><span className="text-slate-500">{f.ai_value || '—'}</span> → <span className="text-emerald-400">{f.human_value}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Mini({ l, v }) {
  return <div><div className="text-base font-extrabold text-white">{v}%</div><div className="text-[9px] uppercase text-slate-500">{l}</div></div>;
}
