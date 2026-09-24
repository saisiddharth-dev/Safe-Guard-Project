import { api } from '../api';
import { Card, Spinner, Empty, StatusBadge, SectionTitle, fmt, useFetch, Icon } from '../components/UI';
import { AlertTriangle, Siren, Check } from 'lucide-react';
import { useI18n } from '../i18n';

export default function AlertsPage() {
  const { t } = useI18n();
  const { data, loading, reload } = useFetch('/alerts');

  const ack = async (id) => { await api.post(`/alerts/${id}/ack`, {}); reload(); };

  if (loading) return <Spinner />;
  const alerts = data?.alerts || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white"><Icon name="bell" size={22} /> {t('Alert Center')}</h1>
        <p className="text-sm text-slate-500">{t('Intelligent escalation — no one watches a dashboard 24×7')}</p>
      </div>

      <Card className="border-amber-500/20">
        <div className="label">{t('Escalation ladder')}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="chip bg-red-500/15 text-red-400">{t('AI detects critical pattern')}</span>
          <Arrow />
          <span className="chip bg-amber-500/15 text-amber-400">{t('Site HSE Manager')}</span>
          <Arrow />
          <span className="chip bg-amber-500/15 text-amber-400">{t('No ack in 4h → Regional HSE')}</span>
          <Arrow />
          <span className="chip bg-amber-500/15 text-amber-400">{t('No action → Corporate HSE')}</span>
        </div>
      </Card>

      <div className="space-y-3">
        {alerts.map((a) => (
          <Card key={a.id} className={`fade-up ${a.status !== 'acknowledged' && a.severity === 'critical' ? 'border-red-500/40' : ''}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.severity === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                {a.severity === 'critical' ? <Siren size={17} /> : <AlertTriangle size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">{a.title}</span>
                  <StatusBadge status={a.status} />
                  <span className="chip border border-ink-600 bg-ink-800 text-slate-400">{a.severity}</span>
                  <span className="mono ml-auto text-slate-500">{fmt.ago(a.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{a.message}</p>
                {(a.location || a.activity) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {a.location && <span className="chip flex items-center gap-1 bg-slate-500/10 text-slate-400"><Icon name="pin" size={12} /> {a.location}</span>}
                    {a.activity && <span className="chip flex items-center gap-1 bg-slate-500/10 text-slate-400"><Icon name="wrench" size={12} /> {a.activity}</span>}
                  </div>
                )}
                {a.status === 'active' && (
                  <button className="btn-primary mt-2 !px-2.5 !py-1 text-[11px]" onClick={() => ack(a.id)}><Check size={12} /> {t('Acknowledge')}</button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {!alerts.length && <Empty message={t('No alerts.')} />}
      </div>
    </div>
  );
}

function Arrow() { return <span className="text-slate-600"><Icon name="arrow" size={14} /></span>; }