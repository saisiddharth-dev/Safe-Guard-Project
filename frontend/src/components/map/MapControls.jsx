import { useState } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Home, Flame } from 'lucide-react';

const CtlBtn = ({ label, onClick, active, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`group relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#003366] shadow-md shadow-slate-900/10 ring-1 ring-ink-600 transition-all duration-200 hover:scale-110 hover:shadow-lg ${
      active ? 'bg-[#003366] text-white ring-[#003366]' : ''
    }`}
  >
    {children}
    <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#003366] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
      {label}
    </span>
  </button>
);

const LEGEND = [
  { label: 'High SIF', color: '#ef4444', sub: '> 0.85' },
  { label: 'Medium', color: '#FF8C00', sub: '0.70 – 0.85' },
  { label: 'Low', color: '#00A86B', sub: '< 0.70' },
];

export default function MapControls({ onZoomIn, onZoomOut, onReset, heatmap, onToggleHeatmap }) {
  const [showLegend, setShowLegend] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.8, type: 'spring', stiffness: 200, damping: 22 }}
      className="absolute right-3 top-3 z-[600] flex flex-col items-end gap-2 sm:right-4 sm:top-4"
    >
      <div className="flex flex-col gap-2">
        <CtlBtn label="Zoom in" onClick={onZoomIn}><ZoomIn size={17} /></CtlBtn>
        <CtlBtn label="Zoom out" onClick={onZoomOut}><ZoomOut size={17} /></CtlBtn>
        <CtlBtn label="Reset view" onClick={onReset}><Home size={17} /></CtlBtn>
        <CtlBtn label="Toggle heatmap" onClick={onToggleHeatmap} active={heatmap}><Flame size={17} /></CtlBtn>
      </div>

      {showLegend && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="mt-1 w-40 rounded-xl bg-white p-2.5 shadow-md shadow-slate-900/10 ring-1 ring-ink-600"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Legend</span>
            <button
              aria-label="Hide legend"
              onClick={() => setShowLegend(false)}
              className="text-xs font-bold text-slate-400 transition hover:text-[#003366]"
            >
              ×
            </button>
          </div>
          {LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-2 py-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="flex-1 text-[11px] font-semibold text-slate-700">{item.label}</span>
              <span className="font-mono text-[9px] text-slate-400">{item.sub}</span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}