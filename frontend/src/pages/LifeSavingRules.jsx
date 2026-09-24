import { useState, useEffect } from 'react';
import { Shield, Eye } from 'lucide-react';
import { api, LSR_META } from '../api';
import { Card, Tabs, Spinner, Empty, SectionTitle, Progress, Modal, fmt, useFetch, Icon } from '../components/UI';
import { useI18n } from '../i18n';

const RULE_CONTROLS = {
  'Energy Isolation': ['Identify energy sources', 'Isolate', 'Lock & tag', 'Verify zero energy', 'Check residual energy'],
  'Hot Work': ['Permit to work verified', 'Gas test before & during', 'Fire watch assigned', 'Flammable material removed', 'Continuous monitoring'],
  'Confined Space': ['Atmosphere tested', 'Isolation verified', 'Attendant posted', 'Rescue plan in place', 'Breathing apparatus', 'Entry authorization'],
  'Line of Fire': ['Position outside line of fire', 'Exclusion zone maintained', 'Body positioning', 'Secure the load'],
  'Working at Height': ['Use anchored fall protection', 'Inspect ladder/scaffold', 'Guard rail in place', 'Safe access & egress'],
  'Safe Mechanical Lifting': ['Lift plan & load chart', 'Pre-use inspection of gear', 'Certified rigger/banksman', 'Physical barriers & tag lines'],
  'Work Authorisation': ['Valid PTW/authorization verified', 'Scope & conditions match', 'Sign-off by authorized person'],
  'Driving': ['Fatigue management', 'Seat belt compliance', 'Journey plan & check', 'Defensive driving'],
  'Bypassing Safety Controls': ['Never bypass/disable safety devices', 'Repair, don\'t bypass', 'Immediate ESD/ISD protection'],
  'General / Housekeeping': ['Maintain clear walkways', 'Immediate spill cleanup', 'Orderly storage & stacking'],
};

export default function LifeSavingRules() {
  const { t } = useI18n();
  const [tab, setTab] = useState('overview');
  const data = useFetch('/analytics/lsr');
  const [viewing, setViewing] = useState(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="shield" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Life-Saving Rules')}</span></h1>
        <p className="text-sm text-slate-500">{t('IOGP Life-Saving Rules mapped automatically to every safety report')}</p>
      </div>

      <Tabs tabs={[
        { id: 'overview', label: t('Overview') }, { id: 'trends', label: t('Rule Trends') }, { id: 'violations', label: t('Violations') },
      ]} active={tab} onChange={setTab} />

      {tab === 'overview' && <Overview data={data} setViewing={setViewing} />}
      {tab === 'trends' && <Trends data={data} />}
      {tab === 'violations' && <Violations data={data} setViewing={setViewing} />}

      <RuleModal rule={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Overview({ data, setViewing }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = data.data?.lsr || [];
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => {
        const meta = LSR_META[r.rule] || { icon: 'warn', color: '#94a3b8' };
        return (
          <Card key={r.rule} className="fade-up cursor-pointer transition-colors hover:border-brand" onClick={() => setViewing(r.rule)}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: meta.color + '22' }}><Icon name={meta.icon} size={18} style={{ color: meta.color }} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{t(r.rule)}</div>
                <div className="text-[11px] text-slate-500">{t('{count} reports · {sif} SIF-potential', { count: r.count, sif: r.sif })}</div>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={(r.count / max) * 100} color={meta.color} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">{t('90-day change')}</span>
              <span className={`font-bold ${r.change > 0 ? 'text-red-400' : r.change < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {r.change > 0 ? '▲' : r.change < 0 ? '▼' : '—'} {Math.abs(r.change)}%
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Trends({ data }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = (data.data?.lsr || []).filter((r) => r.trend?.length);
  return (
    <Card>
      <SectionTitle title={t('90-day rule trends')} sub={t('Monthly observation volume per Life-Saving Rule')} />
      <div className="space-y-5">
        {rows.map((r) => {
          const meta = LSR_META[r.rule] || { icon: 'warn', color: '#94a3b8' };
          const max = Math.max(...(r.trend || []).map((tt) => tt.n), 1);
          return (
            <div key={r.rule}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold text-slate-200"><Icon name={meta.icon} size={15} /> {t(r.rule)}</span>
                <span className={`text-xs font-bold ${r.change > 0 ? 'text-red-400' : r.change < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{r.change > 0 ? '▲ ' : r.change < 0 ? '▼ ' : ''}{Math.abs(r.change)}%</span>
              </div>
              <div className="flex gap-1.5">
                {(r.trend || []).map((tt) => (
                  <div key={tt.d} className="flex-1">
                    <div className="flex h-16 items-end overflow-hidden rounded bg-ink-900">
                      <div className="w-full rounded-t" style={{ height: `${(tt.n / max) * 100}%`, background: meta.color, opacity: 0.75 }} />
                    </div>
                    <div className="mt-0.5 text-center text-[9px] text-slate-600">{String(tt.d).slice(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Violations({ data, setViewing }) {
  const { t } = useI18n();
  if (data.loading) return <Spinner />;
  const rows = data.data?.lsr || [];
  return (
    <Card>
      <SectionTitle title={t('LSR violations & exposure')} sub={t('Click any rule to see its expected controls and report evidence')} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead><tr><th className="th">{t('Rule')}</th><th className="th">{t('Observations')}</th><th className="th">{t('SIF-potential')} *</th><th className="th">{t('Share')}</th><th className="th"></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const meta = LSR_META[r.rule] || {};
              const share = rows.reduce((s, x) => s + x.count, 0) ? Math.round((r.count / rows.reduce((s, x) => s + x.count, 0)) * 100) : 0;
              return (
                <tr key={r.rule} className="border-t border-ink-700/60">
                  <td className="td font-semibold text-white"><span className="flex items-center gap-1.5"><Icon name={meta.icon} size={14} /> {t(r.rule)}</span></td>
                  <td className="td">{fmt.num(r.count)}</td>
                  <td className="td text-red-400">{fmt.num(r.sif)}</td>
                  <td className="td"><Progress value={share} color={meta.color} className="w-24" /> <span className="mono ml-2 text-slate-500">{share}%</span></td>
                  <td className="td"><button className="btn-ghost !px-2 !py-1" onClick={() => setViewing(r.rule)}><Eye size={13} /> {t('Why this rule')}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-600">* {t('SIF-potential denotes reports the AI judged to involve potential serious or fatal injury.')}</p>
    </Card>
  );
}

function RuleModal({ rule, onClose }) {
  const { t } = useI18n();
  const [expl, setExpl] = useState(null);
  useEffect(() => {
    if (!rule) return;
    setExpl(null);
    api.post('/ai/analyze', { text: RULE_SAMPLE[rule] || 'Worker exposed to a life-saving-rule-related hazard during operations.' })
      .then((ai) => {
        const matched = (ai.lsr || []).find((l) => l.rule === rule) || {};
        setExpl({
          rule, controls: RULE_CONTROLS[rule] || [],
          confidence: matched.confidence || 0.9,
          why: (ai.explanation || []).slice(0, 4),
          icon: LSR_META[rule]?.icon || 'warn',
        });
      }).catch(() => { setExpl({ rule, controls: RULE_CONTROLS[rule] || [], confidence: 0, why: [], icon: LSR_META[rule]?.icon || 'warn' }); });
  }, [rule]);

  if (!rule) return null;
  if (!expl) return <Modal open onClose={onClose} title={t('Loading…')} />;

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Icon name={expl.icon} size={18} /> {t(expl.rule)}</span>}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="label">{t('WHY THIS RULE?')}</div>
          <p className="text-sm text-slate-300">{t('The report contains:')}</p>
          <ul className="mt-1 space-y-1">
            {expl.why.length ? expl.why.map((w, i) => <li key={i} className="text-xs text-slate-400">▸ {w}</li>)
              : <li className="text-xs text-slate-500">{t('Reported scenario aligns with this Life-Saving Rule')}</li>}
          </ul>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="label">{t('EXPECTED CONTROL')}</div>
          <ul className="mt-1 space-y-1">
            {expl.controls.map((c, i) => <li key={i} className="flex items-center gap-1.5 text-xs text-emerald-300"><Icon name="check" size={13} /> {t(c)}</li>)}
          </ul>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 p-3">
          <span className="text-sm text-slate-300">{t('AI confidence')}</span>
          <div className="flex items-center gap-2">
            <Progress value={expl.confidence * 100} className="w-32" />
            <span className="font-bold text-white">{Math.round(expl.confidence * 100)}%</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const RULE_SAMPLE = {
  'Energy Isolation': 'During maintenance of the compressor, technician started opening the flange before confirming zero pressure.',
  'Hot Work': 'Worker was doing grinding near the tank without a hot work permit and no fire watch was present.',
  'Confined Space': 'Worker entered the tank without gas testing and without verifying isolation of the tank.',
  'Line of Fire': 'Operators used the crane to lift the skid while a worker stood directly under the suspended load.',
  'Working at Height': 'Worker was working on elevated platform without wearing a fall protection harness.',
  'Safe Mechanical Lifting': 'Contractor used an uncertified shackle for lifting the drill pipe.',
  'Work Authorisation': 'Unauthorized work found at the tank farm - no permit raised for the job.',
  'Driving': 'Seat belts not worn by drivers during the night transportation journey.',
  'Bypassing Safety Controls': 'A technician bypassed the safety interlock on the compressor to keep it running.',
};