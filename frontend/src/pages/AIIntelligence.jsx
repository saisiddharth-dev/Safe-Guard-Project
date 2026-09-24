import { useState, useEffect } from 'react';
import { Sparkles, Search, Send } from 'lucide-react';
import { api, fmt, LSR_META } from '../api';
import { Card, Tabs, useFetch, Spinner, Empty, SectionTitle, Progress, Icon } from '../components/UI';
import { AIExtractPanel } from './Reports';
import { useI18n } from '../i18n';

export default function AIIntelligence() {
  const { t } = useI18n();
  const [tab, setTab] = useState('classify');
  const metrics = useFetch('/ai/metrics');
  const [feedback, setFeedback] = useState([]);

  useEffect(() => {
    api.get('/admin/models').then((d) => setFeedback(d.feedback || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="bot" size={22} /> {t('AI Intelligence')}</h1>
        <p className="text-sm text-slate-500">{t('Classification · Extraction · Explainability · Similarity · Model health')}</p>
      </div>

      <Tabs tabs={[
        { id: 'classify', label: t('SIF Classifier') }, { id: 'extract', label: t('Hazard / Extraction') },
        { id: 'similar', label: t('Similar Cases') }, { id: 'model', label: t('Model Dashboard') },
        { id: 'feedback', label: t('Human Feedback Loop') },
      ]} active={tab} onChange={setTab} />

      {tab === 'classify' && <ClassifyTab />}
      {tab === 'extract' && <ExtractTab />}
      {tab === 'similar' && <SimilarTab />}
      {tab === 'model' && <ModelTab metrics={metrics} />}
      {tab === 'feedback' && <FeedbackTab feedback={feedback} />}
    </div>
  );
}

function ClassifyTab() {
  const { t } = useI18n();
  const [text, setText] = useState('Worker entered the confined space without gas testing and without verifying isolation of the tank.');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(null);

  const run = async () => {
    setBusy(true); setAi(null);
    try { setAi(await api.post('/ai/analyze', { text })); } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t('SIF Classification Playground')} sub={t('Explainable AI — every prediction includes confidence + evidence')} />
        <textarea className="input min-h-[140px] resize-y" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t('Describe an observation…')} />
        <div className="mt-2 flex gap-2">
          <button className="btn-primary" onClick={run} disabled={busy || !text.trim()}>
            {busy ? t('Classifying…') : (<><Sparkles size={15} /> {t('Classify')}</>)}
          </button>
          {[
            'Worker was doing grinding near the tank without a hot work permit and no fire watch was present.',
            'Operators used the crane to lift the skid while a worker stood directly under the suspended load.',
            'Housekeeping issue: oil spill left in the workshop area could cause slips.',
          ].map((s, i) => <button key={i} className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => setText(s)}>{t('Sample {n}', { n: i + 1 })}</button>)}
        </div>
      </Card>

      <div className="space-y-3">
        {busy && <Card><div className="flex items-center gap-2 text-sm text-slate-400"><Sparkles className="animate-pulse text-brand" size={16} /> {t('AI Brain at work…')}</div></Card>}
        {ai && <AIExtractPanel ai={ai} text={text} />}
      </div>
    </div>
  );
}

function ExtractTab() {
  const { t } = useI18n();
  const [text, setText] = useState('Contractor carried out welding near the crude tank with no gas test and no fire watch while standing on an unsecured ladder.');
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState(null);

  const run = async () => {
    setBusy(true); setAi(null);
    try { setAi(await api.post('/ai/analyze', { text })); } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t('Entity Extraction')} sub={t('Activity · Hazard · Barrier · Consequence · Root cause · Location')} />
        <textarea className="input min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary mt-3" onClick={run} disabled={busy}>{t('Extract Entities')}</button>
      </Card>
      {ai && (
        <Card>
          <SectionTitle title={t('Extracted intelligence')} />
          <Grid label={t('Activity')} value={ai.activity} />
          <Grid label={t('Activities')} value={(ai.activities || []).join(', ')} />
          <Grid label={t('Hazards')} value={(ai.hazards || []).join(', ')} />
          <Grid label={t('Barrier failures')} value={(ai.barrier_failures || []).join(', ')} />
          <Grid label={t('Potential consequence')} value={(ai.potential_consequence || []).join(', ')} />
          <Grid label={t('Root cause')} value={(ai.root_cause || []).join(', ')} />
          <Grid label={t('Location')} value={ai.location} />
          <Grid label={t('Language')} value={ai.language} />
          <Grid label={t('Translation')} value={ai.translated_text !== text ? ai.translated_text : '—'} />
          <div className="mt-2 rounded-lg border border-ink-700 bg-ink-900 p-3">
            <div className="label">{t('Quality flags')}</div>
            <div className="flex flex-wrap gap-1.5">{(ai.quality_flags || []).map((f) => <span key={f} className="chip bg-amber-500/10 text-amber-400">{f}</span>)}
              {!ai.quality_flags?.length && <span className="flex items-center gap-1 text-xs text-emerald-400"><Icon name="check" size={13} /> {t('AI-ready')}</span>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Grid({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-700/60 py-2 last:border-0">
      <div className="text-[11px] font-bold uppercase text-slate-500">{label}</div>
      <div className="text-right text-sm text-slate-200">{value || '—'}</div>
    </div>
  );
}

function SimilarTab() {
  const { t } = useI18n();
  const [text, setText] = useState('Worker nearly exposed to pressure release while opening flange during maintenance.');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  const run = async () => {
    setBusy(true); setResults(null);
    try {
      const reports = await api.get('/reports?limit=400');
      const docs = reports.reports.map((r) => ({ id: r.id, text: r.text_original, date: r.created_at, site: r.site_name }));
      const r = await api.post('/ai/similar', { text, docs });
      setResults(r.results);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t('Similar Incident Search')} sub={t('Semantic search — finds related safety cases across the enterprise')} />
        <textarea className="input min-h-[100px]" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary mt-3" onClick={run} disabled={busy}>{busy ? t('Searching…') : (<><Search size={15} /> {t('Find Similar Reports')}</>)}</button>
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3 text-xs text-slate-400">
          <b className="text-slate-300">{t('Semantic:')}</b> {t('"workers exposed to stored energy" also finds hydraulic / pneumatic / residual pressure cases.')}
        </div>
      </Card>
      <Card>
        <SectionTitle title={t('Similar reports')} />
        {busy ? <Spinner /> : results ? (
          <div className="space-y-2">
            {results.map((s) => (
              <div key={s.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3">
                <div className="flex items-center gap-2">
                  <span className="mono text-slate-500">{s.id}</span>
                  <Progress value={s.score * 100} className="w-20" />
                  <span className="text-xs font-bold text-white">{Math.round(s.score * 100)}%</span>
                  {s.site && <span className="chip flex items-center gap-1 bg-slate-500/10 text-slate-400"><Icon name="pin" size={12} /> {s.site}</span>}
                  <span className="ml-auto text-[11px] text-slate-600">{s.date}</span>
                </div>
                <div className="mt-1.5 text-xs text-slate-300">{s.text}</div>
              </div>
            ))}
            {!results.length && <Empty message={t('No results.')} />}
          </div>
        ) : <Empty message={t('Run a search to see similar reports.')} />}
      </Card>
    </div>
  );
}

function ModelTab({ metrics }) {
  const { t } = useI18n();
  const m = metrics?.data;
  const mm = m?.metrics || {};
  const items = [
    [t('SIF Precision'), mm.sif_precision, '#2f7cf6'], [t('SIF Recall'), mm.sif_recall, '#06b6d4'],
    [t('LSR Accuracy'), mm.lsr_accuracy, '#10b981'], [t('F1 Score'), mm.f1, '#f59e0b'], [t('ROC-AUC'), mm.auc, '#8b5cf6'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle title={t('Model Dashboard')} sub={t('Version {model} · trained on {n} samples', { model: m?.model || 'SIF-v2.4', n: fmt.num(mm.trained_on) })} />
        <div className="space-y-4">
          {items.map(([l, v, c]) => (
            <div key={l}>
              <div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{l}</span><span className="font-bold text-white">{Math.round((v || 0) * 100)}%</span></div>
              <Progress value={(v || 0) * 100} color={c} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle title={t('AI quality signals')} sub={t('Feedback from HSE reviewers is the learning loop')} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-4 text-center">
            <div className="text-3xl font-extrabold text-white">{fmt.num(m?.feedback_count || 0)}</div>
            <div className="mt-1 text-[11px] font-bold uppercase text-slate-500">{t('Human corrections recorded')}</div>
          </div>
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-4 text-center">
            <div className="flex items-center justify-center text-3xl font-extrabold text-emerald-400"><Icon name="check" size={26} /></div>
            <div className="mt-1 text-[11px] font-bold uppercase text-slate-500">{t('Explainability enabled')}</div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
          <div className="mono text-slate-500">{m?.model || 'SIF-v2.4'} · {t('updated {date}', { date: m?.metrics?.updated_at || '—' })}</div>
          <div className="mt-1 text-xs text-slate-400">{t('Every prediction stores model version, confidence & timestamp so historical decisions remain explainable.')}</div>
        </div>
      </Card>
    </div>
  );
}

function FeedbackTab({ feedback }) {
  const { t } = useI18n();
  return (
    <Card>
      <SectionTitle title={t('Human feedback loop')} sub={t('HSE reviewer corrections forming the training dataset for future model versions')} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr>
            <th className="th">{t('Report')}</th><th className="th">{t('Field')}</th><th className="th">{t('AI said')}</th>
            <th className="th">{t('Human corrected')}</th><th className="th">{t('Reviewer')}</th><th className="th">{t('When')}</th>
          </tr></thead>
          <tbody>
            {feedback.map((f) => (
              <tr key={f.id} className="border-t border-ink-700/60">
                <td className="td font-mono text-[11px]">{f.report_no}</td>
                <td className="td capitalize">{f.field}</td>
                <td className="td"><span className="chip bg-slate-500/10 text-slate-400">{f.ai_value || '—'}</span></td>
                <td className="td"><span className="chip bg-emerald-500/15 text-emerald-400">{f.human_value || '—'}</span></td>
                <td className="td">{f.reviewer || '—'}</td>
                <td className="td text-xs text-slate-500">{fmt.ago(f.created_at)}</td>
              </tr>
            ))}
            {!feedback.length && <tr><td className="td"><Empty message={t('No corrections yet — review a report to build the feedback set.')} /></td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}