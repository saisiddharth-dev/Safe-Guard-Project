import { useState } from 'react';
import { HardHat, Plus } from 'lucide-react';
import { api } from '../api';
import { Card, SectionTitle, Spinner, Progress, RiskBadge, Modal, fmt, useFetch, Icon, Dot } from '../components/UI';
import { useAuth } from '../AuthContext';
import { useI18n } from '../i18n';

const SPECIALTIES = ['Mechanical Maintenance', 'Construction & Civil', 'Drilling & Well Servicing', 'Pipelines & Storage', 'Well Interventions', 'Lifting & Rigging', 'General Services'];

export default function Contractors() {
  const { t } = useI18n();
  const { data, loading, reload } = useFetch('/contractors');
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  if (loading) return <Spinner />;
  const contractors = data?.contractors || [];

  const ordered = [...contractors].sort((a, b) => b.score - a.score);
  const canAdd = ['Administrator', 'Corporate HSE', 'Regional HSE'].includes(user?.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="hardhat" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Contractors')}</span></h1>
          <p className="text-sm text-slate-500">{t('Contractor safety intelligence · benchmarking · precursor density')}</p>
        </div>
        {canAdd && <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> {t('Add Contractor')}</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ordered.map((c, i) => (
          <Card key={c.id} className={`relative fade-up ${c.score < 60 ? 'border-red-500/40' : ''}`}>
            {i === 0 && <span className="absolute -top-2 right-2 flex items-center gap-1 chip bg-amber-400 text-ink-900"><Icon name="medal" size={13} /> {t('Best')}</span>}
            {c.score < 60 && <span className="absolute -top-2 right-2 flex items-center gap-1 chip bg-red-500 text-white"><Dot className="bg-white" /> {t('At risk')}</span>}
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700 text-lg"><HardHat size={17} className="text-brand" /></div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">{c.name}</div>
                <div className="text-[10px] text-slate-500">{c.specialty}</div>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-2xl font-extrabold text-white">{c.score}<span className="text-xs text-slate-500">/100</span></div>
              </div>
              <RiskBadge level={c.score >= 80 ? 'LOW' : c.score >= 65 ? 'MEDIUM' : 'HIGH'} />
            </div>
            <div className="mt-2">
              <Progress value={c.score} color={c.score >= 80 ? '#10b981' : c.score >= 65 ? '#f59e0b' : '#ef4444'} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
              <Cell l={t('Reports')} v={fmt.num(c.reports)} />
              <Cell l={t('SIF %')} v={`${c.sif_pct}%`} />
              <Cell l={t('CAPA close')} v={`${c.closure_rate}%`} />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle title={t('Benchmarking table')} sub={t('Site × activity × risk — separates site-specific from contractor-specific patterns')} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr>
              <th className="th">{t('Rank')}</th><th className="th">{t('Contractor')}</th><th className="th">{t('Specialty')}</th>
              <th className="th">{t('Score')}</th><th className="th">{t('Reports')}</th><th className="th">{t('SIF')}</th><th className="th">{t('Critical')}</th>
              <th className="th">{t('SIF %')}</th><th className="th">{t('CAPA closure')}</th>
            </tr></thead>
            <tbody>
              {ordered.map((c, i) => (
                <tr key={c.id} className="border-t border-ink-700/60">
                  <td className="td">{i + 1}</td>
                  <td className="td font-semibold text-white">{c.name}</td>
                  <td className="td text-slate-400">{c.specialty}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <Progress value={c.score} color={c.score >= 80 ? '#10b981' : c.score >= 65 ? '#f59e0b' : '#ef4444'} className="w-20" />
                      <span className="font-mono text-xs font-bold text-white">{c.score}</span>
                    </div>
                  </td>
                  <td className="td">{fmt.num(c.reports)}</td>
                  <td className="td">{fmt.num(c.sif)}</td>
                  <td className="td text-red-400">{fmt.num(c.critical)}</td>
                  <td className="td">{c.sif_pct}%</td>
                  <td className="td">{c.closure_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <AddContractor onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </div>
  );
}

function AddContractor({ onClose, onDone }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', specialty: SPECIALTIES[0], score: '70' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api.post('/contractors', { name: form.name, specialty: form.specialty, score: form.score });
      onDone();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('Add contractor')}>
      <div className="space-y-2">
        <div><label className="label">{t('Contractor name')} *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('e.g. Assam Engineering Co.')} /></div>
        <div><label className="label">{t('Specialty')}</label><select className="input" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>{SPECIALTIES.map((s) => <option key={s}>{t(s)}</option>)}</select></div>
        <div><label className="label">{t('Safety score (0–100)')}</label><input className="input" type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></div>
        <button className="btn-primary mt-3 w-full" onClick={submit} disabled={busy || !form.name.trim()}>{busy ? t('Saving…') : t('Add contractor')}</button>
      </div>
    </Modal>
  );
}

function Cell({ l, v }) {
  return <div className="rounded-md bg-ink-950 p-1.5"><div className="font-bold text-white">{v}</div><div className="text-[9px] uppercase text-slate-600">{l}</div></div>;
}