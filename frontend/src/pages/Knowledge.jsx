import { useState } from 'react';
import { BookOpen, Search, Plus } from 'lucide-react';
import { api } from '../api';
import { Card, Spinner, Empty, Modal, SectionTitle, useFetch, Icon } from '../components/UI';
import { useAuth } from '../AuthContext';
import { useI18n } from '../i18n';

const CATS = ['All', 'SOP', 'IOGP Rule', 'OIL SOP', 'Policies', 'JSA', 'Risk Assessment', 'Incident Reports', 'Lessons Learned', 'Training Material'];

export default function Knowledge() {
  const { t } = useI18n();
  const { data, loading, reload } = useFetch('/knowledge');
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [view, setView] = useState(null);
  const [upload, setUpload] = useState(false);

  if (loading) return <Spinner />;
  let docs = (data?.docs || []).filter((d) => cat === 'All' || d.category === cat);
  if (q) docs = docs.filter((d) => (d.title + d.content + (d.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase()));

  const canUpload = ['Administrator', 'Corporate HSE'].includes(user?.role);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="book" size={22} /> {t('Enterprise Knowledge Base')}</h1>
          <p className="text-sm text-slate-500">{t('IOGP rules, OIL SOPs, JSA references, incident reports, lessons learned')}</p>
        </div>
        {canUpload && <button className="btn-primary" onClick={() => setUpload(true)}><Plus size={15} /> {t('Add document')}</button>}
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input className="input !pl-9" placeholder={t('Search knowledge base…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${cat === c ? 'bg-brand text-white' : 'bg-ink-800 text-slate-400'} `}>{t(c)}</button>)}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((d) => (
          <Card key={d.id} className="cursor-pointer transition-colors hover:border-brand" onClick={() => setView(d)}>
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-brand" />
              <span className="text-sm font-bold text-white">{d.title}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">{d.category}</div>
            <p className="mt-2 line-clamp-3 text-xs text-slate-400">{d.content}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(d.tags || []).map((t, i) => <span key={i} className="chip bg-brand/10 text-brand">{t}</span>)}
            </div>
          </Card>
        ))}
      </div>
      {!docs.length && <Empty />}

      {view && (
        <Modal open onClose={() => setView(null)} title={`${view.title}`} wide>
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-3"><span className="chip bg-brand/10 text-brand">{view.category}</span></div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{view.content}</p>
        </Modal>
      )}

      {upload && <UploadModal onClose={() => setUpload(false)} onDone={() => { setUpload(false); reload(); }} />}
    </div>
  );
}

function UploadModal({ onClose, onDone }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ title: '', category: 'SOP', content: '', tags: '' });
  const submit = async () => {
    try {
      await api.post('/knowledge', { ...form, tags: form.tags.split(',').map((tg) => tg.trim()).filter(Boolean) });
      onDone();
    } catch (e) { alert(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={t('Add knowledge document')}>
      <div className="space-y-2">
        <div><label className="label">{t('Title')} *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="label">{t('Category')}</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.filter((c) => c !== 'All').map((c) => <option key={c}>{t(c)}</option>)}</select></div>
        <div><label className="label">{t('Content')} *</label><textarea className="input min-h-[140px]" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
        <div><label className="label">{t('Tags (comma separated)')}</label><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder={t('energy isolation, loto, permit')} /></div>
        <button className="btn-primary mt-3 w-full" onClick={submit} disabled={!form.title || !form.content}>{t('Save to knowledge base')}</button>
      </div>
    </Modal>
  );
}