import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Home, Flame } from 'lucide-react';
import { useI18n } from '../../i18n';

const CtlBtn = ({ label, onClick, active, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`group relative flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-white text-[#003366] shadow-md shadow-slate-900/10 ring-1 ring-ink-600 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 ${
      active ? 'bg-[#003366] text-[#ffffff] ring-[#003366]' : ''
    }`}
  >
    {children}
    <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#003366] px-2 py-1 text-[10px] font-semibold text-[#ffffff] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  </button>
);

export default function MapControls({ onZoomIn, onZoomOut, onReset, heatmap, onToggleHeatmap }) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, type: 'spring', stiffness: 200, damping: 22 }}
      className="absolute bottom-3 right-3 z-[600] flex flex-col items-center gap-2 sm:bottom-4 sm:right-4"
    >
      <CtlBtn label={t('Zoom in')} onClick={onZoomIn}><ZoomIn size={17} /></CtlBtn>
      <CtlBtn label={t('Zoom out')} onClick={onZoomOut}><ZoomOut size={17} /></CtlBtn>
      <CtlBtn label={t('Reset view')} onClick={onReset}><Home size={17} /></CtlBtn>
      <CtlBtn label={t('Toggle heatmap')} onClick={onToggleHeatmap} active={heatmap}><Flame size={17} /></CtlBtn>
    </motion.div>
  );
}