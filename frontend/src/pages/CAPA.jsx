import { useState } from 'react';
import { ClipboardCheck, SearchX, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Card, Spinner, Empty, Modal, StatusBadge, RiskBadge, SectionTitle, Progress, fmt, useFetch, Icon } from '../components/UI';
import { useI18n } from '../i18n';

const STATUSES = ['Open', 'Assigned', 'In Progress', 'Pending Verification', 'Closed', 'Reopened'];

const STATUS_COLOR = {
  'Open': 'bg-amber-500/15 text-amber-400',
  'Assigned': 'bg-sky-500/15 text-sky-400',
  'In Progress': 'bg-blue-500/15 text-blue-400',
  'Pending Verification': 'bg-violet-500/15 text-violet-400',
  'Closed': 'bg-emerald-500/15 text-emerald-400',
  'Reopened': 'bg-red-500/15 text-red-400',
};

const PRIORITY_BAR = {
  URGENT: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#64748b',
};

const STATUS_FLOW = ['Open', 'Assigned', 'In Progress', 'Pending Verification', 'Closed'];

export default function CAPA() {
  const { t } = useI18n();
  const { data, loading, reload } = useFetch('/actions');
  const [filter, setFilter] = useState('');
  const [updating, setUpdating] = useState(false);
  const [assignee, setAssignee] = useState('');

  if (loading) return <Spinner />;
  const actions = (data?.actions || [])
    .filter((a) => !filter || a.status === filter)
    .sort((a, b) => String(a.report_no || '').localeCompare(String(b.report_no || ''), undefined, { numeric: true }));
  const counts = {};
  for (const a of data?.actions || []) counts[a.status] = (counts[a.status] || 0) + 1;

  const setStatus = async (a, status) => {
    setUpdating(true);
    try {
      await api.patch(`/actions/${a.id}`, status === 'Closed'
        ? { status: 'Closed', verification_note: 'Closure verified by HSE' }
        : { status, assignee_id: assignee || undefined });
      reload();
    } catch (e) { alert(e.message); }
    finally { setUpdating(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="check" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('CAPA — Corrective & Preventive Action')}</span></h1>
        <p className="text-sm text-slate-500">{t('Every significant observation supports assign → act → verify → close')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(filter === s ? '' : s)}
            className={`card p-3 text-center transition-colors ${filter === s ? 'border-brand' : 'hover:border-ink-600'}`}>
            <div className="text-xl font-extrabold text-white">{counts[s] || 0}</div>
            <div className="text-[10px] font-bold uppercase text-slate-500">{t(s)}</div>
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle title={filter ? t('Actions — {filter}', { filter: t(filter) }) : t('All actions')} sub={t('{n} shown', { n: actions.length })} />
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[860px]">
            <thead><tr>
              <th className="th">#</th><th className="th">{t('Action')}</th><th className="th">{t('Report')}</th><th className="th">{t('Site')}</th>
              <th className="th">{t('Priority')}</th><th className="th">{t('Status')}</th><th className="th">{t('Due')}</th><th className="th">{t('Overdue')}</th><th className="th">{t('Workflow')}</th>
            </tr></thead>
            <tbody>
              {actions.map((a) => (
                <ActionRow key={a.id} a={a} setStatus={setStatus} updating={updating} assignee={assignee} setAssignee={setAssignee} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 lg:hidden">
          {actions.map((a) => (
            <ActionCard key={a.id} a={a} setStatus={setStatus} updating={updating} assignee={assignee} setAssignee={setAssignee} />
          ))}
        </div>
        {!actions.length && <Empty />}
      </Card>
    </div>
  );
}

function ActionRow({ a, setStatus, updating, assignee, setAssignee }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const next = a.status === 'Open' ? 'Assigned' : a.status === 'Assigned' ? 'In Progress' : a.status === 'In Progress' ? 'Pending Verification' : a.status === 'Pending Verification' ? 'Closed' : null;
  return (
    <>
      <tr className="cursor-pointer border-t border-ink-700/60 transition-colors hover:bg-ink-800/40" onClick={() => setOpen(true)}>
        <td className="td font-mono text-[11px] text-slate-500">#{a.id}</td>
        <td className="td max-w-[220px]">
          <button className="text-left font-semibold text-white hover:text-brand" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{a.title}</button>
          <div className="text-[11px] text-slate-500">{a.assignee || t('Unassigned')}</div>
        </td>
        <td className="td font-mono text-[11px]">{a.report_no || '—'}</td>
        <td className="td text-xs">{a.site_name || '—'}</td>
        <td className="td"><PriorityBadge p={a.priority} /></td>
        <td className="td"><StatusBadge status={a.status} /></td>
        <td className="td text-xs">{fmt.date(a.due_date)}</td>
        <td className="td">{a.overdue ? <span className="chip bg-red-500/15 text-red-400">{t('!! OVERDUE')}</span> : <span className="text-slate-600">—</span>}</td>
        <td className="td" onClick={(e) => e.stopPropagation()}>
          {next ? (
            <button className="btn-primary !px-2 !py-1 text-[11px]" disabled={updating} onClick={() => setStatus(a, next)}><Icon name="arrow" size={12} className="mr-1 inline" />{t(next)}</button>
          ) : (
            <button className="btn-ghost !px-2 !py-1 text-[11px]" disabled={updating} onClick={() => setStatus(a, 'Reopened')}><Icon name="undo" size={12} className="mr-1 inline" />{t('Reopen')}</button>
          )}
        </td>
      </tr>
      {open && <ActionModal a={a} onClose={() => setOpen(false)} setStatus={setStatus} assignee={assignee} setAssignee={setAssignee} />}
    </>
  );
}

function ActionCard({ a, setStatus, updating, assignee, setAssignee }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const next = a.status === 'Open' ? 'Assigned' : a.status === 'Assigned' ? 'In Progress' : a.status === 'In Progress' ? 'Pending Verification' : a.status === 'Pending Verification' ? 'Closed' : null;
  const bar = PRIORITY_BAR[a.priority] || '#64748b';
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-850/80 p-3 shadow-sm transition-all duration-200 hover:border-brand/60 hover:shadow-lg hover:shadow-slate-900/10 active:scale-[0.99] sm:p-3.5"
      >
        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ background: bar }} />
        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="min-w-0">
            <div className="clamp-2 text-sm font-bold text-white">{a.title}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{a.assignee || t('Unassigned')}{a.site_name ? ` · ${a.site_name}` : ''}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PriorityBadge p={a.priority} />
              <StatusBadge status={a.status} />
              <span className="chip border border-ink-600 bg-ink-800 text-slate-400">{a.report_no || '—'}</span>
              {a.overdue && <span className="chip bg-red-500/15 text-red-400">{t('!! OVERDUE')}</span>}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-slate-500">#{a.id}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700/60 pl-2 pt-2.5">
          <button
            className="text-[11px] font-semibold text-brand transition-colors group-hover:text-brand/90"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
          >
            {t('View detail')} <Icon name="arrow" size={12} className="inline" />
          </button>
          <span className="text-[11px] text-slate-500">{t('Due')}: {fmt.date(a.due_date)}</span>
          {next ? (
            <button className="btn-primary !px-3.5 text-xs" disabled={updating} onClick={(e) => { e.stopPropagation(); setStatus(a, next); }}><Icon name="arrow" size={12} className="mr-1 inline" />{t(next)}</button>
          ) : (
            <button className="btn-ghost !px-3.5 text-xs" disabled={updating} onClick={(e) => { e.stopPropagation(); setStatus(a, 'Reopened'); }}><Icon name="undo" size={12} className="mr-1 inline" />{t('Reopen')}</button>
          )}
        </div>
      </div>
      {open && <ActionModal a={a} onClose={() => setOpen(false)} setStatus={setStatus} assignee={assignee} setAssignee={setAssignee} />}
    </>
  );
}

function PriorityBadge({ p }) {
  const c = p === 'URGENT' ? 'bg-red-500/15 text-red-400' : p === 'HIGH' ? 'bg-orange-500/15 text-orange-400' : p === 'MEDIUM' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/15 text-slate-400';
  return <span className={`chip ${c}`}>{p}</span>;
}

function ActionModal({ a, onClose, setStatus, assignee, setAssignee }) {
  const { t } = useI18n();
  const bar = PRIORITY_BAR[a.priority] || '#64748b';
  const idx = STATUS_FLOW.indexOf(a.status);
  return (
    <Modal open onClose={onClose} title={`${t('Action')} #${a.id}`}>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-850 p-4 pr-5">
          <span className="absolute inset-y-0 left-0 w-1" style={{ background: bar }} />
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge p={a.priority} />
            <StatusBadge status={a.status} />
            {a.overdue && <span className="chip bg-red-500/15 text-red-400">{t('!! OVERDUE')}</span>}
          </div>
          <h4 className="mt-2 text-base font-bold leading-snug text-white">{a.title}</h4>
          {a.description && <p className="mt-2 text-sm leading-relaxed text-slate-400">{a.description}</p>}
          {(a.assignee || a.created_at) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {a.assignee && <span>{t('Assignee: {name}', { name: a.assignee })}</span>}
              {a.created_at && <span>{t('Raised')}: {fmt.ago(a.created_at)}</span>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
            <div className="label !mb-1">{t('Report')}</div>
            <div className="font-mono text-sm text-white">{a.report_no || '—'}</div>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
            <div className="label !mb-1">{t('Site')}</div>
            <div className="break-words text-sm text-white">{a.site_name || t('All Sites')}</div>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
            <div className="label !mb-1">{t('Risk')}</div>
            <RiskBadge level={a.risk_level || '—'} />
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
            <div className="label !mb-1">{t('Due')}</div>
            <div className={`text-sm font-semibold ${a.overdue ? 'text-red-400' : 'text-white'}`}>{fmt.date(a.due_date)}</div>
          </div>
        </div>

        {a.text_original && (
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
            <div className="label !mb-1">{t('Original report')}{a.report_no ? ` — ${a.report_no}` : ''}</div>
            <p className="text-xs italic leading-relaxed text-slate-400">“{a.text_original}”</p>
          </div>
        )}

        {a.evidence && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-300">
            <Icon name="paperclip" size={14} className="mt-0.5 shrink-0" />
            <span>{a.evidence}</span>
          </div>
        )}
        {a.verification_note && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs leading-relaxed text-sky-300">
            <Icon name="check" size={14} className="mt-0.5 shrink-0" />
            <span>{a.verification_note}</span>
          </div>
        )}

        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
          <div className="label !mb-2">{t('Status flow')}</div>
          <div className="flex items-center overflow-x-auto pb-1">
            {STATUS_FLOW.map((s, i) => (
              <div key={s} className="flex items-center">
                <span
                  className={`flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[10px] font-bold ${
                    s === a.status ? 'bg-brand text-white shadow' : i < idx || idx === -1 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-ink-800 text-slate-500'
                  }`}
                >
                  {i < idx || (s === a.status) ? <Icon name="check" size={10} /> : <span className="flex h-1.5 w-1.5 rounded-full bg-current" />}
                  {t(s)}
                </span>
                {i < STATUS_FLOW.length - 1 && <span className="mx-1 h-px w-4 shrink-0 bg-ink-600" />}
              </div>
            ))}
          </div>
          {a.status !== 'Closed' && (
            <div className="mt-3 border-t border-ink-700/60 pt-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="label">{t('Assign to (user id or blank)')}</label>
                  <input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={t('e.g. 4')} />
                </div>
                <button className="btn-ghost !px-3 text-xs" onClick={() => { setAssignee(''); }}>{t('Clear')}</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {['Assigned', 'In Progress', 'Pending Verification', 'Closed'].map((s) => (
                  <button key={s} className="btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={() => { setStatus(a, s); onClose(); }}>{t('Mark')} {t(s)}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 text-[10px] text-slate-600">{t('Status flow: Open → Assigned → In Progress → Pending Verification → Closed')}{a.status === 'Closed' ? ` ${t('· Closed actions can be reopened')}` : ''}</div>
        </div>
      </div>
    </Modal>
  );
}