import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Map as MapIcon, Phone, Mail, User, Calendar, Users, Box, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { getRiskColor } from '../../utils/geoUtils';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [showDetails, setShowDetails] = useState(false);
  if (!site) return null;

  const density = Number(site.density) || 0;
  const color = getRiskColor(density);
  const pct = Math.round(density * 100);
  const phone = site.manager_phone;
  const email = site.manager_email;
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;
  const mailHref = email ? `mailto:${email}` : null;
  const contactHref = telHref || mailHref;
  const contactIsMail = Boolean(mailHref && !telHref);
  const showContractorCard = Boolean(telHref || mailHref);

  const sheet = {
    initial: { opacity: 0, y: isMobile ? 140 : -30, scale: isMobile ? 1 : 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: isMobile ? 140 : -30, scale: isMobile ? 1 : 0.95 },
  };

  const details = [
    { icon: Briefcase, label: t('Contractor'), value: site.contractor },
    { icon: User, label: t('Site Manager'), value: site.site_manager },
    { icon: Phone, label: t('Manager Contact'), value: phone },
    { icon: Mail, label: t('Manager Email'), value: email },
    { icon: Box, label: t('Operations'), value: site.operations },
    { icon: MapPin, label: t('Region'), value: [site.region, site.state].filter(Boolean).join(', ') || site.district },
    { icon: Calendar, label: t('Commissioned'), value: site.commissioned },
    { icon: Users, label: t('Workforce'), value: site.workforce ? t('{n} personnel', { n: site.workforce }) : '' },
  ];

  const hasDetails = details.some((d) => d.value);

  return (
    <AnimatePresence>
      {site && [
        <motion.div
          key="backdrop"
          className="absolute inset-0 z-[500]"
          style={{ background: 'rgba(2, 8, 23, 0.55)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />,
        <motion.div
          key="popup"
          className={`pointer-events-none absolute inset-0 z-[700] flex justify-center ${isMobile ? 'items-end' : 'items-center'}`}
          initial={sheet.initial}
          animate={sheet.animate}
          exit={sheet.exit}
          transition={popupSpring}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${site.name} site details`}
            className={`pointer-events-auto w-full overflow-y-auto overscroll-contain bg-white shadow-2xl shadow-slate-900/30 ${
              isMobile
                ? 'max-h-[85vh] rounded-t-2xl rounded-b-none border-x border-t border-ink-600'
                : 'max-h-[90%] max-w-md rounded-2xl border border-ink-600'
            }`}
          >
            <div className="relative flex items-start justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-[#003366] to-[#0e2a52] px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6ee7b7]">
                    {t('Live')}
                  </span>
                </div>
                <h3 className="mt-1.5 truncate text-lg font-extrabold leading-tight text-[#ffffff]">{site.name}</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#cbd5e1]">
                  <MapPin size={12} className="shrink-0 text-[#94a3b8]" />
                  <span className="truncate">{site.district || site.region}</span>
                  {site.state && (
                    <>
                      <span className="text-[#64748b]">·</span>
                      <span className="truncate">{site.state}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={`${t('Close')} ${site.name}`}
                className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#ffffff] transition hover:scale-105 hover:bg-white/25 active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label={t('Reports')} value={site.reports} />
                <Metric label={t('SIF Count')} value={site.sifCount} />
                <Metric label={t('Density')} value={`${pct}%`} accent={color} />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span>{t('SIF Density')}</span>
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

              {showContractorCard && (
                <div className="rounded-xl border border-ink-700 bg-ink-800 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Primary Contractor')}</div>
                  <div className="mt-0.5 text-sm font-bold text-slate-800">{site.contractor || '—'}</div>
                  {contactHref && (
                    <a
                      href={contactHref}
                      className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#003366] bg-[#003366] px-3 py-2.5 text-xs font-semibold text-[#ffffff] transition hover:bg-[#0e2a52]"
                      aria-label={`${t('Contact Site Manager')} — ${site.site_manager || site.name}`}
                    >
                      {contactIsMail ? <Mail size={13} /> : <Phone size={13} />}
                      {t('Contact Site Manager')}
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  aria-expanded={showDetails}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-xs font-semibold text-white transition hover:scale-[1.02] hover:bg-brand-dark"
                  aria-label={t('View Site Details')}
                >
                  <Briefcase size={14} />
                  {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {t('View Site Details')}
                </button>
                <button
                  onClick={onViewMap}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:scale-[1.02] hover:bg-ink-700"
                  aria-label={t('View on Map')}
                >
                  <MapIcon size={14} /> {t('View on Map')}
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
          </div>
        </motion.div>,
      ]}
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