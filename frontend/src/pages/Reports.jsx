import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Plus, FileText, Sparkles, Mic, Camera, Shield, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { api, fmt, riskColor, statusColor, ALL_LSRS, LSR_META } from '../api';
import { Card, RiskBadge, StatusBadge, Modal, Progress, Empty, Spinner, SectionTitle, Icon } from '../components/UI';
import { useAuth } from '../AuthContext';
import { useI18n } from '../i18n';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

function pjson(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

const LANG = { english: 'English', hindi: 'Hindi', assamese: 'Assamese', bengali: 'Bengali', odia: 'Odia' };

function ReportCard({ r, onOpen }) {
  const { t } = useI18n();
  const lsr = r.lsr_json?.[0] || (r.primary_lsr ? { rule: r.primary_lsr } : null);
  return (
    <button onClick={() => onOpen(r)} className="card w-full p-4 text-left transition-colors hover:border-brand">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-slate-500">{r.report_no}</span>
        <div className="flex items-center gap-1.5">
          <RiskBadge level={r.risk_level} />
          <StatusBadge status={r.review_status} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-200">{r.text_original}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {lsr && lsr.rule && (
          <span className="flex items-center gap-1.5 chip border border-ink-600 bg-ink-800 text-slate-300"><Icon name={LSR_META[lsr.rule]?.icon || 'warn'} size={13} /> {t(lsr.rule)}</span>
        )}
        {r.activity && <span className="flex items-center gap-1.5 chip bg-brand/10 text-brand"><Icon name="wrench" size={12} /> {r.activity}</span>}
        {r.site_name && <span className="flex items-center gap-1.5 chip bg-slate-500/10 text-slate-400"><Icon name="pin" size={12} /> {r.site_name}</span>}
        {r.audio_url && <span className="flex items-center gap-1.5 chip bg-emerald-500/10 text-emerald-400"><Icon name="mic" size={12} /> {t('Voice')}</span>}
        {!!r.sif_potential && <span className="flex items-center gap-1.5 chip bg-red-500/15 text-red-400"><Icon name="bomb" size={12} /> {t('SIF')}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="mono text-slate-500">{fmt.ago(r.created_at)}</span>
        <span className="text-xs text-slate-500">{r.shift} shift · {LANG[r.lang] || r.lang}</span>
      </div>
    </button>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initialTab = params.get('view') === 'review' ? 'review' : params.get('view') === 'mine' ? 'mine' : 'all';
  const [tab, setTab] = useState(initialTab);
  const [reports, setReports] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ activity: '', lsr: '', risk: '', site: '', q: '' });
  const [active, setActive] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
  if (tab === 'review') qs.set('status', 'pending_review');

  const load = () => {
    setLoading(true);
    api.get('/reports?' + qs.toString()).then((r) => { setReports(r.reports); setMeta(r.meta); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [tab, filters.activity, filters.lsr, filters.risk, filters.site, filters.q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="doc" size={22} /> {t('Safety Reports')}</h1>
          <p className="text-sm text-slate-500">{t('Free text, near miss, observation, hazard — AI-structured intelligence')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setSubmitOpen(true)}><Plus size={15} /> {t('Submit Report')}</button>
          <button className="btn-ghost" onClick={() => setTab('review')}><Shield size={15} /> {t('AI Review Queue')}</button>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input className="input !w-56" placeholder={t('Search text…')} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select className="input !w-44" value={filters.activity} onChange={(e) => setFilters({ ...filters, activity: e.target.value })}>
          <option value="">{t('All activities')}</option>
          {(meta?.activities || []).map((a) => <option key={a.activity}>{a.activity}</option>)}
        </select>
        <select className="input !w-48" value={filters.lsr} onChange={(e) => setFilters({ ...filters, lsr: e.target.value })}>
          <option value="">{t('All LSRs')}</option>
          {ALL_LSRS.map((r) => <option key={r}>{t(r)}</option>)}
        </select>
        <select className="input !w-40" value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}>
          <option value="">{t('All risk')}</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((r) => <option key={r}>{t(r)}</option>)}
        </select>
        <select className="input !w-40" value={filters.site} onChange={(e) => setFilters({ ...filters, site: e.target.value })}>
          <option value="">{t('All sites')}</option>
          {(meta?.sites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn-ghost" onClick={() => setFilters({ activity: '', lsr: '', risk: '', site: '', q: '' })}>{t('Clear')}</button>
      </div>

      {tab === 'review' && <ReviewSummary />}

      {loading ? <Spinner /> : reports.length === 0 ? <Empty message={t('No reports match. Try submitting one.')} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => <ReportCard key={r.id} r={r} onOpen={setActive} />)}
        </div>
      )}

      <ReportDetail report={active} onClose={() => setActive(null)} onSaved={() => { load(); }} />

      {submitOpen && (
        <Modal open onClose={() => setSubmitOpen(false)} title={t('Submit Safety Report')} wide>
          <SubmitReport onDone={() => { setSubmitOpen(false); load(); }} />
        </Modal>
      )}
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const { t } = useI18n();
  const tabs = [
    { id: 'all', label: t('All Reports') }, { id: 'review', label: t('AI Review Queue') }, { id: 'mine', label: t('My Reports') },
  ];
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === t.id ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ReviewSummary() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
      <b>{t('Human-in-the-Loop:')}</b> {t('Reports with 70–90% AI confidence need HSE review, <70% confidence are')} <b>{t('mandatory')}</b> {t('human review. Open a report and use the Review panel to confirm or correct the AI prediction — corrections are stored as training feedback.')}
    </div>
  );
}

// ---------------------------------------------------------------------------
function SubmitReport({ onDone }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [lang, setLang] = useState('english');
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [contractor, setContractor] = useState('');
  const [contractors, setContractors] = useState([]);
  const [shift, setShift] = useState('Day');
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioDur, setAudioDur] = useState(0);
  const camRef = useRef(null);
  const docRef = useRef(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const recStartRef = useRef(0);
  const transcriberRef = useRef(null);
  const stopTranscribeRef = useRef(false);
  const MAX_REC_MS = 60000;

  useEffect(() => {
    api.get('/sites').then((r) => setSites(r.sites)).catch(() => {});
    api.get('/contractors').then((r) => setContractors(r.contractors)).catch(() => {});
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopTranscribeRef.current = true;
      try { transcriberRef.current?.stop(); } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recRef.current && recRef.current.state !== 'inactive') { try { recRef.current.stop(); } catch {} }
    };
  }, []);

  const blobToB64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(blob);
  });

  const stopTranscribe = () => {
    stopTranscribeRef.current = true;
    try { transcriberRef.current?.stop(); } catch {}
    transcriberRef.current = null;
  };

  const startTranscribe = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    stopTranscribeRef.current = false;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim();
      if (said) setText((prev) => (prev.trim() ? prev + ' ' + said : said));
    };
    rec.onend = () => { if (!stopTranscribeRef.current) { try { rec.start(); } catch {} } };
    rec.onerror = () => {};
    transcriberRef.current = rec;
    try { rec.start(); } catch {}
  };

  const stopRecording = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    stopTranscribe();
    if (recRef.current && recRef.current.state !== 'inactive') {
      try { recRef.current.stop(); } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  };

  const toggleRecording = async () => {
    if (recording) { stopRecording(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert(t('Voice recording is not supported in this browser. Use Chrome or Edge, or type the report.'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (chunks.length) {
          const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
          setAudioBlob(blob);
          setAudioUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(blob); });
          setAudioDur(Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000)));
        }
      };
      rec.onerror = () => stopRecording();
      recRef.current = rec;
      recStartRef.current = Date.now();
      timerRef.current = setTimeout(stopRecording, MAX_REC_MS);
      setAudioBlob(null);
      setAudioUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
      setAudioDur(0);
      rec.start();
      setRecording(true);
      startTranscribe();
    } catch (e) {
      alert(t('Microphone access blocked. Allow mic permission to record voice, or type the report.'));
    }
  };

  const removeAudio = () => {
    setAudioBlob(null);
    setAudioUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setAudioDur(0);
  };

  const appendText = (txt) => {
    const clean = (txt || '').replace(/\s*\n{3,}/g, '\n\n').trim();
    if (clean) setText((t) => (t.trim() ? t + '\n\n' + clean : clean));
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });

  const readPdf = async (file) => {
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let txt = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      txt += content.items.map((it) => it.str || '').join(' ') + '\n';
    }
    txt = txt.trim();
    if (!txt) throw new Error(t('This PDF has no selectable text (scanned image?). Try the Camera OCR or type by hand.'));
    appendText(txt);
  };

  const readDocx = async (file) => {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const txt = (result.value || '').trim();
    if (!txt) throw new Error(t('No readable text found in this Word document.'));
    appendText(txt);
  };

  const ocrImage = async (file) => {
    const dataUrl = await fileToDataUrl(file);
    const { data } = await Tesseract.recognize(dataUrl, 'eng', { logger: () => {} });
    const txt = (data.text || '').trim();
    if (!txt) throw new Error(t('No text found in the photo. Take a clearer, closer picture or type by hand.'));
    appendText(txt);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    setProcessing(name.endsWith('.pdf') ? t('Extracting text from PDF…')
      : name.endsWith('.docx') ? t('Extracting text from Word document…')
      : file.type.startsWith('image/') ? t('Reading photo (AI OCR)…')
      : t('Reading file…'));
    try {
      if (name.endsWith('.pdf')) await readPdf(file);
      else if (name.endsWith('.docx')) await readDocx(file);
      else if (file.type.startsWith('image/')) await ocrImage(file);
      else if (/\.(txt|md|csv|log|json)$/.test(name)) appendText(await file.text());
      else throw new Error(t('Unsupported file type. Use PDF, DOCX, image or a text file.'));
    } catch (e) {
      alert(e.message || t('Could not read that file. Type or use voice input instead.'));
    } finally {
      setProcessing(null);
    }
  };

  const submitAll = async () => {
    if (!text.trim() || analyzing || submitting) return;
    setAnalyzing(true); setSubmitting(true);
    try {
      const ai = await api.post('/ai/analyze', { text, lang });
      const payload = { text, type: 'Observation', lang, site_id: site || undefined, contractor_id: contractor || undefined, shift };
      if (audioBlob) {
        payload.audio_base64 = await blobToB64(audioBlob);
        payload.audio_mime = audioBlob.type || 'audio/webm';
        payload.audio_duration = audioDur;
      }
      await api.post('/reports', payload);
      setText(''); 
      removeAudio();
      onDone();
    } catch (e) { alert(e.message || t('AI Brain offline: unable to analyze report')); }
    finally { setAnalyzing(false); setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="fade-up">
        <SectionTitle title={t('AI Report Intake')} sub={t('Speak, type or paste. AI extracts SIF, LSR, hazard, activity, barrier.')} />

        <div className="flex flex-wrap items-center gap-2">
          <button className={`btn ${recording ? 'bg-red-600 text-white' : 'btn-primary'}`} onClick={toggleRecording} disabled={submitting}>
            {recording ? <Loader2 className="animate-spin" size={15} /> : <Mic size={15} />} {recording ? t('Listening… stop') : t('Voice')}
          </button>
          <button className="btn-ghost" onClick={() => camRef.current?.click()} disabled={submitting || !!processing}><Camera size={15} /> {t('Camera')}</button>
          <button className="btn-ghost" onClick={() => docRef.current?.click()} disabled={submitting || !!processing}><FileText size={15} /> {t('PDF / DOCX')}</button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={docRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.log,.json" className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {processing && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand">
            <Loader2 className="animate-spin" size={13} /> {processing}
          </div>
        )}
        {recording && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {t('Recording… click')} <b>{t('Voice / Listening… stop')}</b> {t('to finish')}
          </div>
        )}
        {audioUrl && !recording && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <audio controls src={audioUrl} className="h-8 w-full max-w-[260px]" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Icon name="mic" size={13} /> {t('Voice attached · {n}s', { n: audioDur })}</span>
            <button className="btn-ghost !px-2 !py-1 text-[11px]" onClick={removeAudio}>{t('Remove')}</button>
          </div>
        )}

        <div className="mt-4">
          <label className="label">{t('Report description *')}</label>
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder={t('e.g. "During maintenance of the compressor, technician started opening the flange before confirming zero pressure…"')}
            value={text} onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><label className="label">{t('Language')}</label>
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LANG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="label">{t('Site')}</label>
            <select className="input" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="">—</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">{t('Contractor')}</label>
            <select className="input" value={contractor} onChange={(e) => setContractor(e.target.value)}>
              <option value="">—</option>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">{t('Shift')}</label>
            <select className="input" value={shift} onChange={(e) => setShift(e.target.value)}>
              <option>{t('Day')}</option><option>{t('Night')}</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
          <button className="btn-primary" onClick={submitAll} disabled={!text.trim() || analyzing || submitting}>
            {analyzing || submitting ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
            {analyzing ? t('Analyzing…') : submitting ? t('Submitting…') : t('Submit Report')}
          </button>
          <span className="ml-auto text-xs text-slate-500">{t('AI analyzes & saves the report automatically')}</span>
        </div>
      </Card>

      {(analyzing || submitting) && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Loader2 className="animate-spin text-brand" size={18} />
            {analyzing ? t('AI Brain analyzing & classifying the report…') : t('Saving the report…')}
          </div>
        </Card>
      )}
    </div>
  );
}

const CHECKLISTS = {
  'Hot Work': ['Gas test?', 'Permit?', 'Fire watch?', 'Flammable material removed?', 'Continuous monitoring?'],
  'Confined Space': ['Atmosphere tested?', 'Isolation verified?', 'Attendant?', 'Rescue plan?', 'Breathing apparatus?', 'Entry authorization?'],
  'Energy Isolation': ['Identify energy sources?', 'Isolate', 'Lock & tag', 'Verify zero energy', 'Check residual energy'],
  'Working at Height': ['Anchored fall protection?', 'Ladder/scaffold inspected?', 'Guard rail?', 'Safe access & egress?'],
  'Safe Mechanical Lifting': ['Lift plan & load chart?', 'Gear pre-use inspected?', 'Certified rigger/banksman?', 'Barriers & tag lines?'],
  'Line of Fire': ['Outside line of fire?', 'Exclusion zone?', 'Body positioning?', 'Load secured?'],
};

function Checklist({ rule }) {
  const { t } = useI18n();
  const items = CHECKLISTS[rule] || [];
  const [state, setState] = useState({});
  if (!items.length) return <div className="text-sm text-slate-500">{t('General observation — reviews captured at review stage.')}</div>;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300"><Icon name={LSR_META[rule]?.icon || 'warn'} size={14} /> {t('{rule} verification checklist', { rule: t(rule) })}</div>
      {items.map((it) => (
        <label key={it} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-blue-500" checked={!!state[it]} onChange={(e) => setState({ ...state, [it]: e.target.checked })} />
          <span className={state[it] ? 'text-emerald-400 line-through' : 'text-slate-300'}>{t(it)}</span>
        </label>
      ))}
    </div>
  );
}

export function AIExtractPanel({ ai, text }) {
  const { t } = useI18n();
  const sif = ai.sif || {};
  return (
    <Card className="border-brand/40 fade-up">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Sparkles size={15} className="text-brand" /> {t('AI Extraction')}</h3>
        <span className="font-mono text-[10px] text-slate-500">{ai.model || 'SIF-v2.4'} · {ai.language}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniFact label={t('SIF Potential')} value={sif.prediction ? t('YES') : t('NO')} tone={sif.prediction ? 'red' : 'green'} />
        <MiniFact label={t('Confidence')} value={`${Math.round((sif.confidence || 0) * 100)}%`} />
        <MiniFact label={t('Risk Level')} value={t(sif.risk_level) || t('LOW')} tone={sif.risk_level === 'CRITICAL' ? 'red' : sif.risk_level === 'HIGH' ? 'orange' : 'green'} />
        <MiniFact label={t('Activity')} value={ai.activity || '—'} />
        <MiniFact label={t('Location')} value={ai.location || '—'} />
        <MiniFact label={t('Hazard')} value={(ai.hazards || [])[0] || '—'} />
      </div>

      <div className="mt-3">
        <div className="label">{t('Life-Saving Rules (multi-label)')}</div>
        <div className="flex flex-wrap gap-1.5">
          {(ai.lsr || []).map((l) => (
            <span key={l.rule} className={`flex items-center gap-1.5 chip border ${l.primary ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
              <Icon name={LSR_META[l.rule]?.icon || 'warn'} size={13} /> {t(l.rule)} · {(l.confidence * 100).toFixed(0)}% {l.primary && `· ${t('PRIMARY')}`}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="label">{t('Barrier failures')}</div>
        <div className="flex flex-wrap gap-1.5">
          {(ai.barrier_failures || []).map((b, i) => <span key={i} className="flex items-center gap-1.5 chip bg-orange-500/10 text-orange-400"><Icon name="wall" size={13} /> {b}</span>)}
          {!ai.barrier_failures?.length && <span className="text-xs text-slate-500">—</span>}
        </div>
      </div>

      <div className="mt-3">
        <div className="label">{t('Why was this classified?')}</div>
        <ul className="space-y-1">
          {(ai.explanation || []).map((ex, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300"><span className="text-brand">▸</span>{ex}</li>
          ))}
        </ul>
      </div>

      {ai.reason_codes?.length > 0 && (
        <div className="mt-3">
          <div className="label">{t('Reason codes')}</div>
          <div className="flex flex-wrap gap-1"><span className="font-mono text-[10px] text-slate-500">{ai.reason_codes.join(' · ')}</span></div>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
        <div className="label">{t('Recommended actions')}</div>
        {(ai.recommended_actions || []).map((a, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5 text-xs text-slate-300"><Icon name="check" size={13} className="text-emerald-400" />{a}</div>
        ))}
      </div>
    </Card>
  );
}

function MiniFact({ label, value, tone }) {
  const colors = { red: 'text-red-400', orange: 'text-orange-400', green: 'text-emerald-400' };
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-2.5">
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-extrabold ${colors[tone] || 'text-white'}`}>{String(value ?? '—')}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ReportDetail({ report, onClose, onSaved }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);
  const [similar, setSimilar] = useState(null);
  const [tab, setTab] = useState('overview');
  const [actionForm, setActionForm] = useState({ title: '', priority: 'MEDIUM', due_date: '' });

  useEffect(() => {
    if (!report) return;
    setDetail(null); setSimilar(null); setTab('overview');
    api.get(`/reports/${report.id}`).then(setDetail).catch(() => setDetail({ report }));
    api.get(`/reports/${report.id}/similar`).then(setSimilar).catch(() => {});
  }, [report]);

  if (!report) return null;
  const r = detail?.report || report;
  const tabLabel = { overview: t('Overview'), ai: t('AI'), review: t('Review'), actions: t('Actions'), similar: t('Similar') };

  const review = async (patch) => {
    await api.patch(`/reports/${r.id}`, patch);
    const nd = await api.get(`/reports/${r.id}`);
    setDetail(nd);
    onSaved();
  };

  const createAction = async () => {
    await api.post('/actions', { report_id: r.id, ...actionForm });
    setActionForm({ title: '', priority: 'MEDIUM', due_date: '' });
    const nd = await api.get(`/reports/${r.id}`);
    setDetail(nd);
  };

  return (
    <Modal open onClose={onClose} title={`${r.report_no} — ${t(r.type || 'Observation')}`} wide>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <RiskBadge level={r.risk_level} />
        <StatusBadge status={r.review_status} />
        <span className="chip border border-ink-600 bg-ink-800 text-slate-300">{t('SIF-potential: {val}', { val: r.sif_potential ? t('YES') : t('NO') })}</span>
        <span className="chip border border-ink-600 bg-ink-800 text-slate-300">{t('Confidence: {pct}%', { pct: Math.round((r.sif_confidence || 0) * 100) })}</span>
        <span className="chip border border-ink-600 bg-ink-800 text-slate-300">{r.site_name || r.site || t('Unknown site')} · {r.shift}</span>
      </div>

      <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
        {['overview', 'ai', 'review', 'actions', 'similar'].map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === k ? 'bg-brand text-white' : 'text-slate-400'}`}>{tabLabel[k]}</button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm leading-relaxed text-slate-200">{r.text_original}</div>
            {r.audio_url && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-1.5 label"><Icon name="mic" size={13} /> {t('Voice attachment')} {r.audio_duration ? `(${Math.round(r.audio_duration)}s)` : ''}</div>
                <audio controls src={`/api/reports/${r.id}/audio`} className="h-9 w-full" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <KV k={t('Activity')} v={r.activity} /> <KV k={t('Location')} v={r.location_text || r.site_name} />
              <KV k={t('Hazard')} v={r.hazard} /> <KV k={t('Barrier failure')} v={r.barrier_failure} />
              <KV k={t('Potential consequence')} v={r.potential_consequence} /> <KV k={t('Root cause')} v={r.root_cause} />
              <KV k={t('Submitter')} v={r.submitter} /> <KV k={t('Submitted')} v={fmt.dt(r.created_at)} />
            </div>
            {r.review_note && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{t('HSE review:')} {r.review_note}</div>}
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-3">
            {pjson(r.explanation_json).length > 0 && (
              <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
                <div className="label">{t('AI explanation')}</div>
                <ul className="space-y-1">{pjson(r.explanation_json).map((e, i) => <li key={i} className="text-xs text-slate-300">▸ {e}</li>)}</ul>
              </div>
            )}
            <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
              <div className="label">{t('LSR mapping')}</div>
              <div className="space-y-2">
                {pjson(r.lsrs?.length ? r.lsrs : r.lsr_json).map((l) => (
                  <div key={l.rule} className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5"><Icon name={LSR_META[l.rule]?.icon || 'warn'} size={16} /><span className="text-sm font-semibold text-white">{t(l.rule)}</span></span>
                    <span className="text-xs text-slate-500">{Math.round((l.confidence || 0) * 100)}%</span>
                    {l.is_primary ? <span className="chip bg-red-500/15 text-red-400">{t('Primary')}</span> : null}
                    {l.human_value && <span className="chip bg-emerald-500/15 text-emerald-400">{t('Human: {val}', { val: l.human_value })}</span>}
                  </div>
                ))}
              </div>
            </div>
            {pjson(r.recommended_actions || r.recommended_actions_json).length > 0 && (
              <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
                <div className="label">{t('Recommended actions')}</div>
                {pjson(r.recommended_actions || r.recommended_actions_json).map((a, i) => <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300"><Icon name="check" size={13} className="text-emerald-400" /> {a}</div>)}
              </div>
            )}
            <div className="mono text-slate-600">{t('model:')} {r.model} · {t('evidence:')} {pjson(r.evidence_json).join(', ') || '—'}</div>
          </div>
        )}

        {tab === 'review' && (
          <div className="space-y-3">
            <ReviewPanel r={r} onReview={review} />
          </div>
        )}

        {tab === 'actions' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-ink-700 bg-ink-900 p-3">
              <div className="label">{t('Create corrective action')}</div>
              <input className="input" placeholder={t('Action title (e.g. Verify isolation procedure)')} value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select className="input" value={actionForm.priority} onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })}>
                  {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p}>{p}</option>)}
                </select>
                <input className="input" type="date" value={actionForm.due_date} onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })} />
              </div>
              <button className="btn-primary mt-2" onClick={createAction} disabled={!actionForm.title}>{t('Raise CAPA')}</button>
            </div>
            {(r.actions || []).map((a) => (
              <div key={a.id} className="rounded-lg border border-ink-700 bg-ink-900 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{a.title}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{t('Due {date} · {priority}{overdue}', { date: fmt.date(a.due_date), priority: a.priority, overdue: a.overdue ? ` · ${t('OVERDUE')}` : '' })}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'similar' && (
          <SimilarPanel similar={similar} base={r} onOpen={onSaved} />
        )}
      </div>
    </Modal>
  );
}

function KV({ k, v }) {
  return <div className="rounded-lg border border-ink-700 bg-ink-900 p-2.5"><div className="text-[10px] font-bold uppercase text-slate-500">{k}</div><div className="text-sm text-slate-200">{v || '—'}</div></div>;
}

function ReviewPanel({ r, onReview }) {
  const { t } = useI18n();
  const [sif, setSif] = useState(r.sif_potential);
  const [lsr, setLsr] = useState(r.primary_lsr || '');
  const [note, setNote] = useState('');
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="label">{t('Human verification (stored as AI feedback)')}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="label">{t('SIF potential')}</div>
          <div className="flex gap-2">
            <button onClick={() => setSif(1)} className={`btn flex-1 ${sif ? 'bg-red-600 text-white' : 'bg-ink-800 text-slate-400'}`}>{t('YES')}</button>
            <button onClick={() => setSif(0)} className={`btn flex-1 ${!sif ? 'bg-emerald-600 text-white' : 'bg-ink-800 text-slate-400'}`}>{t('NO')}</button>
          </div>
        </div>
        <div>
          <div className="label">{t('Primary LSR')}</div>
          <select className="input" value={lsr} onChange={(e) => setLsr(e.target.value)}>
            <option value="">—</option>
            {ALL_LSRS.map((r) => <option key={r}>{t(r)}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-2">
        <div className="label">{t('Review note')}</div>
        <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn-primary mt-3" onClick={() => onReview({ sif_potential: sif, primary_lsr: lsr || undefined, review_status: 'reviewed', review_note: note || 'Reviewed by HSE' })}>
        {t('Record review & save')}
      </button>
    </div>
  );
}

function SimilarPanel({ similar, base }) {
  const { t } = useI18n();
  if (!similar) return <Spinner />;
  const results = similar.results || [];
  return (
    <div>
      <div className="mb-2 text-xs text-slate-400">{t('Similar reports to')} <b className="text-white">{base.report_no}</b>: <b className="text-brand">{results.length}</b> {t('found')}</div>
      <div className="space-y-2">
        {results.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
            <Progress value={s.score * 100} className="w-16" />
            <span className="mono text-slate-400">{s.id}</span>
            <span className="text-xs text-slate-600">{s.date || ''}</span>
            <span className="flex-1 truncate text-sm text-slate-300">{s.text}</span>
          </div>
        ))}
        {!results.length && <Empty message={t('No similar reports found.')} />}
      </div>
    </div>
  );
}