import { useState, useEffect, useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  ArrowRight, Ban, BarChart3, Bell, Bolt, Bomb, BookOpen, Bot, Box, BrickWall,
  Brush, Car, CircleCheck, ClipboardList, CloudRain, Construction, Factory,
  FileText, Flame, Fuel, HardHat, Map, MapPin, Medal, Mic, Mountain, NotebookPen,
  Paperclip, Receipt, Repeat, Satellite, Search, Settings2, Shield, Siren,
  Target, TriangleAlert, Undo, Wrench, X, Zap,
} from 'lucide-react';
import { api, riskColor, statusColor, fmt } from '../api';
import { useI18n } from '../i18n';

const ICONS = {
  bolt: Bolt,
  flame: Flame,
  box: Box,
  target: Target,
  height: Mountain,
  construction: Construction,
  clipboard: ClipboardList,
  car: Car,
  ban: Ban,
  brush: Brush,
  fuel: Fuel,
  x: X,
  settings: Settings2,
  bot: Bot,
  warn: TriangleAlert,
  check: CircleCheck,
  pin: MapPin,
  bell: Bell,
  wrench: Wrench,
  arrow: ArrowRight,
  undo: Undo,
  satellite: Satellite,
  bomb: Bomb,
  report: FileText,
  siren: Siren,
  wall: BrickWall,
  repeat: Repeat,
  mic: Mic,
  doc: NotebookPen,
  search: Search,
  medal: Medal,
  chart: BarChart3,
  book: BookOpen,
  shield: Shield,
  map: Map,
  factory: Factory,
  hardhat: HardHat,
  receipt: Receipt,
  paperclip: Paperclip,
  env: CloudRain,
  zap: Zap,
};

export function Icon({ name, size = 16, className = '', ...rest }) {
  const C = ICONS[name];
  if (!C) return null;
  return <C size={size} className={className} {...rest} />;
}

export function Dot({ className = '', ...rest }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`} {...rest} />;
}

export function Card({ className = '', children, ...rest }) {
  return <div className={`card p-4 ${className}`} {...rest}>{children}</div>;
}

export function Stat({ label, value, sub, delta, danger, ok, icon, accent, spark }) {
  const up = Number(delta) > 0;
  const good = ok && !danger ? up : ok && danger ? !up : null;
  const gid = useId();
  const color = accent || '#2f7cf6';
  const data = Array.isArray(spark) ? spark.map((v, i) => ({ i, v: Number(v) || 0 })) : [];
  return (
    <Card className="fade-up relative overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1.5 hover:shadow-lg hover:shadow-slate-900/10 hover:border-brand/40">
      {accent && <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
          <div className="mt-1 text-3xl font-extrabold text-white">{value}</div>
        </div>
        {icon && <div className="text-xl opacity-80">{icon}</div>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && (
          <span className={`chip ${up ? (good === false ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400') : good === true ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {up ? '▲' : '▼'} {Math.abs(Number(delta)).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-slate-500">{sub}</span>}
      </div>
      {data.length > 1 && (
        <div className="mt-2.5 h-11 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${gid})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function RiskBadge({ level }) {
  const { t } = useI18n();
  return <span className={`chip border ${riskColor(level)}`}>{level ? t(level) : '—'}</span>;
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const raw = String(status || '').replace(/_/g, ' ');
  return <span className={`chip ${statusColor(status)}`}>{raw ? t(raw) : ''}</span>;
}

export function Progress({ value, color = '#2f7cf6', className = '' }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-700 ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className={`card max-h-[88vh] w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} overflow-y-auto fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 pb-3 pt-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button className="btn-ghost !px-2 !py-1" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="mt-4 px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === t.id ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(path)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, error, loading, reload: () => setTick(t => t + 1) };
}

export function Empty({ message }) {
  const { t } = useI18n();
  return <div className="py-10 text-center text-sm text-slate-500">{message ?? t('No data available')}</div>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-brand" />
    </div>
  );
}

export function HeatCell({ value, max }) {
  const v = Number(value) || 0;
  const ratio = max > 0 ? v / max : 0;
  const bg = v === 0
    ? 'bg-ink-800 text-slate-600'
    : ratio > 0.5 ? 'bg-red-500/70 text-white'
    : ratio > 0.2 ? 'bg-orange-500/60 text-white'
    : 'bg-amber-400/50 text-ink-900';
  return <div className={`flex h-12 items-center justify-center rounded-lg text-sm font-bold ${bg}`}>{v || '·'}</div>;
}

export function SectionTitle({ title, sub, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export { fmt };