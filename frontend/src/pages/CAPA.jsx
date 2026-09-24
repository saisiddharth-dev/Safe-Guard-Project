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
        <div className="overflow-x-auto">
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
      <tr className="border-t border-ink-700/60">
        <td className="td font-mono text-[11px] text-slate-500">#{a.id}</td>
        <td className="td max-w-[220px]">
          <button className="text-left font-semibold text-white hover:text-brand" onClick={() => setOpen(true)}>{a.title}</button>
          <div className="text-[11px] text-slate-500">{a.assignee || t('Unassigned')}</div>
        </td>
        <td className="td font-mono text-[11px]">{a.report_no || '—'}</td>
        <td className="td text-xs">{a.site_name || '—'}</td>
        <td className="td"><PriorityBadge p={a.priority} /></td>
        <td className="td"><StatusBadge status={a.status} /></td>
        <td className="td text-xs">{fmt.date(a.due_date)}</td>
        <td className="td">{a.overdue ? <span className="chip bg-red-500/15 text-red-400">{t('!! OVERDUE')}</span> : <span className="text-slate-600">—</span>}</td>
        <td className="td">
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

function PriorityBadge({ p }) {
  const c = p === 'URGENT' ? 'bg-red-500/15 text-red-400' : p === 'HIGH' ? 'bg-orange-500/15 text-orange-400' : p === 'MEDIUM' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/15 text-slate-400';
  return <span className={`chip ${c}`}>{p}</span>;
}

function ActionModal({ a, onClose, setStatus, assignee, setAssignee }) {
  const { t } = useI18n();
  return (
    <Modal open onClose={onClose} title={`Action #${a.id} — ${a.title}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-ink-900 p-3"><div className="label">{t('Status')}</div><StatusBadge status={a.status} /></div>
          <div className="rounded-lg bg-ink-900 p-3"><div className="label">{t('Risk')}</div><RiskBadge level={a.risk_level || '—'} /></div>
          <div className="rounded-lg bg-ink-900 p-3"><div className="label">{t('Priority')}</div><PriorityBadge p={a.priority} /></div>
          <div className="rounded-lg bg-ink-900 p-3"><div className="label">{t('Due')}</div><div className="text-sm text-white">{fmt.date(a.due_date)}</div></div>
        </div>
        {a.description && <div className="rounded-lg bg-ink-900 p-3 text-sm text-slate-300">{a.description}</div>}
        {a.evidence && <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"><Icon name="paperclip" size={13} className="mt-0.5 shrink-0" /> <span>{a.evidence}</span></div>}
        {a.verification_note && <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-300"><Icon name="check" size={13} className="mt-0.5 shrink-0" /> <span>{a.verification_note}</span></div>}
        {a.status !== 'Closed' && (
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
            <div className="label">{t('Assign to (user id or blank)')}</div>
            <input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={t('e.g. 4')} />
            <div className="mt-2 flex flex-wrap gap-2">
              {['Assigned', 'In Progress', 'Pending Verification', 'Closed'].map((s) => (
                <button key={s} className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => { setStatus(a, s); onClose(); }}>{t('Mark')} {t(s)}</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-600">
          {a.status !== 'Closed'
            ? <span>{t('Status flow: Open → Assigned → In Progress → Pending Verification → Closed')}</span>
            : <span>{t('Status flow: Open → Assigned → In Progress → Pending Verification → Closed')} {t('· Closed actions can be reopened')}</span>}
        </div>
      </div>
    </Modal>
  );
}