import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Map as MapIcon, Phone, User, Mail, Calendar, Users, Box, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { getRiskColor } from '../../utils/geoUtils';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

const popupSpring = { type: 'spring', stiffness: 320, damping: 26, mass: 0.9 };

export default function SitePopup({ site, onClose, onViewMap }) {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [showDetails, setShowDetails] = useState(false);
  if (!site) return null;

  const color = getRiskColor(site.density);
  const pct = Math.round((site.density || 0) * 100);

  const sheet = {
    initial: { opacity: 0, y: isMobile ? 120 : 28, scale: isMobile ? 1 : 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: isMobile ? 120 : 28, scale: isMobile ? 1 : 0.94 },
  };

  const details = [
    { icon: Briefcase, label: 'Contractor', value: site.contractor },
    { icon: User, label: 'Site Manager', value: site.site_manager },
    { icon: Phone, label: 'Manager Contact', value: site.manager_phone },
    { icon: Mail, label: 'Manager Email', value: site.manager_email },
    { icon: Box, label: 'Operations', value: site.operations },
    { icon: MapPin, label: 'Region', value: [site.region, site.state].filter(Boolean).join(', ') || site.district },
    { icon: Calendar, label: 'Commissioned', value: site.commissioned },
    { icon: Users, label: 'Workforce', value: site.workforce ? `${site.workforce} personnel` : '' },
  ];

  const hasDetails = details.some((d) => d.value);

  return (
    <AnimatePresence>
      {site && (
      <motion.div
        key="backdrop"
        className="absolute inset-0 z-[500] flex"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          key={site.id}
          initial={sheet.initial}
          animate={sheet.animate}
          exit={sheet.exit}
          transition={popupSpring}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`${site.name} site details`}
          className={`m-auto w-full overflow-y-auto rounded-2xl border border-ink-600 bg-white shadow-2xl shadow-slate-900/30 ${
            isMobile ? 'max-h-[86%] self-end rounded-b-none max-w-none' : 'max-h-[90%] max-w-md'
          }`}
        >
          <div className="relative flex items-start justify-between rounded-t-2xl bg-gradient-to-r from-[#003366] to-[#0e2a52] px-5 py-4 text-white">
            <div>
              <div className="flex items-center gap-2 text-white">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Live</span>
              </div>
              <h3 className="mt-1 text-lg font-extrabold leading-tight text-white">{site.name}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-200">
                <MapPin size={12} className="text-slate-300" />
                <span>{site.district}</span>
                <span className="text-slate-400">·</span>
                <span>{site.state}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={`Close ${site.name} popup`}
              className="rounded-full bg-white/10 p-1.5 text-white transition hover:scale-110 hover:bg-white/20"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Reports" value={site.reports} />
              <Metric label="SIF Count" value={site.sifCount} />
              <Metric label="Density" value={`${pct}%`} accent={color} />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span>SIF Density</span>
                <span style={{ color }}>{pct}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 22, delay: 0.15 }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-ink-700 bg-ink-800 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Primary Contractor</div>
              <div className="mt-0.5 text-sm font-bold text-slate-800">{site.contractor}</div>
              <button
                className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#003366] bg-[#003366] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0e2a52]"
                aria-label="Contact site manager"
              >
                <Phone size={13} /> Contact Site Manager
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-xs font-semibold text-white transition hover:scale-[1.02] hover:bg-brand-dark"
                aria-label="View site details"
              >
                <Briefcase size={14} /> View Site Details {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button
                onClick={onViewMap}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:scale-[1.02] hover:bg-ink-700"
                aria-label="Center map on this site"
              >
                <MapIcon size={14} /> View on Map
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showDetails && hasDetails && (
                <motion.div
                  key="site-details"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="overflow-hidden rounded-xl border border-ink-700">
                    {details.map((d, i) => (
                      <DetailRow key={d.label} {...d} last={i === details.length - 1} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800 p-2.5">
      <div className="text-lg font-extrabold" style={{ color: accent || '#003366' }}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, last }) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-3 bg-white px-3.5 py-2.5 ${last ? '' : 'border-b border-ink-700'}`}>
      <Icon size={15} className="shrink-0 text-[#003366]" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate text-sm font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}