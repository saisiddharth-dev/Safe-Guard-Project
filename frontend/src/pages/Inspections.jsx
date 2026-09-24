import { useState } from 'react';
import { ClipboardList, Check, XCircle } from 'lucide-react';
import { Card, Spinner, Empty, Modal, StatusBadge, SectionTitle, fmt, useFetch, Icon } from '../components/UI';
import { useI18n } from '../i18n';

export default function Inspections() {
  const { t } = useI18n();
  const { data, loading } = useFetch('/inspections');
  const [view, setView] = useState(null);
  if (loading) return <Spinner />;
  const rows = data?.inspections || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="clipboard" size={22} /> {t('Inspections')}</h1>
        <p className="text-sm text-slate-500">{t('Digital inspection checklists · AI-classified findings · CAPA link')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((i) => (
          <Card key={i.id} className="cursor-pointer transition-colors hover:border-brand" onClick={() => setView(i)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{i.title}</span>
              <StatusBadge status={i.status} />
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Icon name="pin" size={12} /> {i.site_name} · {fmt.date(i.date || i.created_at)}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(i.findings || []).map((f, k) => <span key={k} className="flex items-center gap-1 chip bg-amber-500/10 text-amber-400"><Icon name="receipt" size={12} /> {f}</span>)}
            </div>
            <div className="mt-2 text-xs text-slate-500">{t('{n} checklist items', { n: i.checklist?.length || 0 })}</div>
          </Card>
        ))}
      </div>
      {!rows.length && <Empty />}

      {view && (
        <Modal open onClose={() => setView(null)} title={`${view.title} — ${view.site_name}`}>
          <div className="flex items-center gap-2">
            <StatusBadge status={view.status} />
            <span className="text-xs text-slate-500">{fmt.date(view.date || view.created_at)}</span>
          </div>
          <div className="mt-3">
            <div className="label">{t('Checklist')}</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(view.checklist || []).map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-slate-200">
                  <Check size={13} className="text-emerald-400" /> {c}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="label">{t('Findings')}</div>
            {(view.findings || []).map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <XCircle size={13} /> {f}
              </div>
            ))}
            {!view.findings?.length && <div className="text-xs text-slate-500">{t('No findings recorded.')}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}