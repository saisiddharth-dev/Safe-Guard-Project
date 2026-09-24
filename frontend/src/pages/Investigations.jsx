import { useState } from 'react';
import { SearchX, Sparkles, Plus } from 'lucide-react';
import { api } from '../api';
import { Card, Spinner, Empty, Modal, StatusBadge, RiskBadge, SectionTitle, fmt, useFetch, Icon } from '../components/UI';
import { useI18n } from '../i18n';

const CAUSE_STACK = ['Immediate Cause', 'Barrier Failure', 'Underlying Cause', 'Root Cause', 'Corrective Action'];

export default function Investigations() {
  const { t } = useI18n();
  const { data, loading, reload } = useFetch('/investigations');
  const [view, setView] = useState(null);
  const [newInv, setNewInv] = useState(false);

  if (loading) return <Spinner />;
  const rows = data?.investigations || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="warn" size={22} /> {t('Investigations & RCA')}</h1>
          <p className="text-sm text-slate-500">{t('AI-assisted root-cause analysis — HSE investigator validation required')}</p>
        </div>
        <button className="btn-primary" onClick={() => setNewInv(true)}><Plus size={15} /> {t('New Investigation')}</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((i) => (
          <Card key={i.id} className="cursor-pointer transition-colors hover:border-brand" onClick={() => setView(i)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{i.title}</span>
              <StatusBadge status={i.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-slate-400">{i.summary || i.text_original}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono">{i.report_no}</span>
              <span>{fmt.ago(i.created_at)}</span>
              {i.investigator && <span className="flex items-center gap-1"><Icon name="target" size={12} /> {i.investigator}</span>}
            </div>
          </Card>
        ))}
      </div>
      {!rows.length && <Empty message={t('No investigations yet.')} />}

      {view && <InvestigationDetail inv={view} onClose={() => setView(null)} onUpdate={reload} />}
      {newInv && <NewInvestigation onClose={() => setNewInv(false)} onCreated={() => { setNewInv(false); reload(); }} />}
    </div>
  );
}

function InvestigationDetail({ inv, onClose, onUpdate }) {
  const { t } = useI18n();
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const contributing = (() => { try { return JSON.parse(inv.contributing || '[]'); } catch { return []; } })();
  const timeline = (() => { try { return JSON.parse(inv.timeline || '[]'); } catch { return []; } })();

  const runAI = async () => {
    setBusy(true);
    try {
      const r = await api.post('/ai/analyze', { text: inv.summary || inv.text_original || 'investigation' });
      setAi({
        immediate: 'Isolation not verified.' + (r.barrier_failures?.[0] ? ` Barrier: ${r.barrier_failures[0]}.` : ''),
        contributing: [...(r.barrier_failures || []).slice(0, 3), ...(r.root_cause || []).slice(0, 2)],
        root: `Weak ${(r.root_cause?.[0] || 'process').toLowerCase()} control identified from "${(r.hazards?.[0] || 'hazard')}" exposure.`,
      });
    } catch { setAi({ immediate: 'AI offline — supply manual analysis.', contributing: [], root: 'Manual entry required.' }); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={inv.title} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={inv.status} />
          {inv.report_no && <span className="chip border border-ink-600 bg-ink-800 text-slate-300">{t('Report {n}', { n: inv.report_no })}</span>}
          {inv.investigator && <span className="chip border border-ink-600 bg-ink-800 text-slate-300">{t('Investigator: {name}', { name: inv.investigator })}</span>}
        </div>

        <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
          <div className="label">{t('Report text')}</div>
          <p className="text-sm text-slate-300">{inv.text_original || '—'}</p>
        </div>

        <div>
          <div className="label">{t('Cause analysis stack')}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StackItem label={t('Immediate')} value={inv.immediate_cause} />
            <Arrow />
            <StackItem label={t('Contributing')} value={contributing.join(', ')} />
            <Arrow />
            <StackItem label={t('Root cause')} value={inv.root_cause} accent />
          </div>
        </div>

        {timeline.length > 0 && (
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
            <div className="label">{t('Reconstructed timeline')}</div>
            <div className="space-y-1">
              {timeline.map((tt, i) => <div key={i} className="flex items-center gap-2 font-mono text-[11px] text-slate-400"><span className="text-brand">▸</span>{tt}</div>)}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-ink-700 p-3">
          <div className="flex items-center justify-between">
            <div className="label !mb-0">{t('AI-assisted RCA')}</div>
            <button className="btn-ghost !px-2 !py-1 text-[11px]" onClick={runAI} disabled={busy}><Sparkles size={12} /> {busy ? t('Generating…') : t('Generate suggestion')}</button>
          </div>
          {ai ? (
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div><b className="text-slate-400">{t('Immediate cause:')}</b> {ai.immediate}</div>
              <div><b className="text-slate-400">{t('Contributing factors:')}</b> {ai.contributing.join('; ') || '—'}</div>
              <div><b className="text-slate-400">{t('Potential systemic cause:')}</b> {ai.root}</div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                <Icon name="warn" size={13} className="mt-0.5 shrink-0" />
                <span>{t('AI-assisted analysis — HSE investigator validation required before use in official findings.')}</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">{t('Click generate — the AI proposes immediate causes, contributing factors and potential systemic causes clearly labelled as assistant output.')}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function StackItem({ label, value, accent }) {
  if (!value) return null;
  return (
    <div className={`rounded-lg border p-2.5 ${accent ? 'border-red-500/40 bg-red-500/10' : 'border-ink-700 bg-ink-900'}`}>
      <div className="text-[9px] font-bold uppercase text-slate-500">{label}</div>
      <div className="max-w-[180px] truncate text-xs text-slate-200">{value}</div>
    </div>
  );
}
function Arrow() { return <span className="text-slate-600"><Icon name="arrow" size={14} /></span>; }

function NewInvestigation({ onClose, onCreated }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ report_id: '', title: '', immediate_cause: '', root_cause: '', summary: '' });
  const create = async () => {
    try {
      await api.post('/investigations', { report_id: form.report_id ? +form.report_id : null, title: form.title, immediate_cause: form.immediate_cause, root_cause: form.root_cause, summary: form.summary });
      onCreated();
    } catch (e) { alert(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={t('Start an investigation')}>
      <div className="space-y-2">
        <div><label className="label">{t('Report id (optional)')}</label><input className="input" value={form.report_id} onChange={(e) => setForm({ ...form, report_id: e.target.value })} placeholder="12" /></div>
        <div><label className="label">{t('Title')} *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('Investigation: Energy Isolation')} /></div>
        <div><label className="label">{t('Summary')}</label><textarea className="input min-h-[70px]" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
        <div><label className="label">{t('Immediate cause')}</label><input className="input" value={form.immediate_cause} onChange={(e) => setForm({ ...form, immediate_cause: e.target.value })} /></div>
        <div><label className="label">{t('Root cause')}</label><input className="input" value={form.root_cause} onChange={(e) => setForm({ ...form, root_cause: e.target.value })} /></div>
        <button className="btn-primary mt-3 w-full" onClick={create} disabled={!form.title}>{t('Create investigation')}</button>
      </div>
    </Modal>
  );
}