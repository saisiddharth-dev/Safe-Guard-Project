import { useEffect, useMemo, useRef, useState } from 'react';
import { Wand2, X } from 'lucide-react';

const WISIM_CSS = `
[data-wisim] .wisim-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 8px;
  background: #0f172a;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.05s ease;
}
[data-wisim] .wisim-btn:hover { background: #1e293b; }
[data-wisim] .wisim-btn:active { transform: scale(0.98); }
[data-wisim] .wisim-btn svg { color: #fbbf24; }

[data-wisim] .wisim-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}
[data-wisim] .wisim-modal.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

[data-wisim] .wisim-panel {
  width: 100%;
  max-width: 620px;
  max-height: 92vh;
  overflow-y: auto;
  position: relative;
  padding: 30px 32px 26px;
  border: 1px solid rgba(96, 165, 250, 0.25);
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 30px 90px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(15, 23, 42, 0.04);
  transform: translateY(12px) scale(0.98);
  transition: transform 0.25s ease;
}
[data-wisim] .wisim-modal.open .wisim-panel { transform: translateY(0) scale(1); }

[data-wisim] .wisim-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
[data-wisim] .wisim-close:hover { background: #0f172a; color: #ffffff; }

[data-wisim] .wisim-header { padding-right: 40px; }

[data-wisim] .wisim-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fff7ed;
  color: #f97316;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

[data-wisim] .wisim-header h2 {
  margin: 10px 0 6px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #0f172a;
}

[data-wisim] .wisim-sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #64748b;
}

[data-wisim] .wisim-section { margin-top: 22px; }

[data-wisim] .wisim-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: #334155;
}

[data-wisim] .wisim-pct {
  font-size: 13px;
  font-weight: 800;
  color: #2563eb;
}

[data-wisim] .wisim-program {
  width: 100%;
  padding: 12px 36px 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>") right 14px center / 12px no-repeat;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
[data-wisim] .wisim-program:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }

[data-wisim] .wisim-range {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: #e2e8f0;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  cursor: pointer;
}
[data-wisim] .wisim-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border: 3px solid #ffffff;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
  cursor: grab;
}
[data-wisim] .wisim-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 3px solid #ffffff;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
  cursor: grab;
}

[data-wisim] .wisim-results {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
  margin-top: 24px;
  padding: 18px;
  border: 1px solid #f1f5f9;
  border-radius: 14px;
  background: #f8fafc;
}

[data-wisim] .wisim-stat { flex: 1 1 120px; min-width: 0; }

[data-wisim] .wisim-stat-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #94a3b8;
}

[data-wisim] .wisim-stat-value {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #0f172a;
}
[data-wisim] .wisim-stat-after .wisim-stat-value { color: #16a34a; }

[data-wisim] .wisim-arrow { align-self: center; font-size: 20px; color: #94a3b8; }

[data-wisim] .wisim-impact {
  align-self: center;
  flex: 1 1 140px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #ecfdf5;
  text-align: center;
}
[data-wisim] .wisim-impact-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #059669;
}
[data-wisim] .wisim-impact-value {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 800;
  color: #047857;
}

[data-wisim] .wisim-meter { margin-top: 18px; }

[data-wisim] .wisim-meter-track {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #16a34a 0%, #eab308 55%, #ef4444 100%);
  overflow: hidden;
}
[data-wisim] .wisim-meter-fill {
  height: 100%;
  border-radius: 999px;
  background: #0f172a;
  transition: width 0.25s ease;
}

[data-wisim] .wisim-meter-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10.5px;
  font-weight: 600;
  color: #94a3b8;
}

[data-wisim] .wisim-projection {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}

[data-wisim] .wisim-proj-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12.5px;
}
[data-wisim] .wisim-proj-row span { color: #64748b; }
[data-wisim] .wisim-proj-row strong { color: #0f172a; text-align: right; }

[data-wisim] .wisim-note {
  margin: 16px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: #94a3b8;
}

/* ---------- dark theme ---------- */
html.dark [data-wisim] .wisim-panel { background: #121a2e; box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(148, 163, 184, 0.18); }
html.dark [data-wisim] .wisim-close { background: #1a243b; border-color: #314063; color: #94a3b8; }
html.dark [data-wisim] .wisim-close:hover { background: #25314d; color: #ffffff; }
html.dark [data-wisim] .wisim-badge { background: #2e2510; color: #fbbf24; }
html.dark [data-wisim] .wisim-header h2, html.dark [data-wisim] .wisim-label,
html.dark [data-wisim] .wisim-program, html.dark [data-wisim] .wisim-proj-row strong { color: #e6edf7; }
html.dark [data-wisim] .wisim-program { background-color: #1a243b; border-color: #314063; }
html.dark [data-wisim] .wisim-proj-row span { color: #8fa1b8; }
html.dark [data-wisim] .wisim-pct { color: #60a5fa; }

/* ---------- small screens ---------- */
@media (max-width: 480px) {
  [data-wisim] .wisim-modal { padding: 12px; }
  [data-wisim] .wisim-panel { padding: 22px 18px 18px; }
  [data-wisim] .wisim-results { flex-direction: column; align-items: stretch; }
  [data-wisim] .wisim-arrow { align-self: center; transform: rotate(90deg); }
  [data-wisim] .wisim-impact { width: 100%; }
  [data-wisim] .wisim-header h2 { font-size: 18px; }
  [data-wisim] .wisim-stat-value { font-size: 24px; }
}
`;

function buildPrograms(top_failed_barriers, lsr, activities) {
  const barrier = (Array.isArray(top_failed_barriers) ? top_failed_barriers : []).slice(0, 4).map((b, i) => ({
    id: `barrier-${i}`,
    label: `Strengthen barrier: ${b.barrier}`,
    factor: Math.round((0.35 + i * 0.03) * 100) / 100,
    group: 'Failed Barriers',
  }));

  const lsrRows = (Array.isArray(lsr) ? lsr : []).filter((r) => r.rule).slice(0, 4);
  if (!lsrRows.length) {
    lsrRows.push(...[{ rule: 'Energy Isolation' }, { rule: 'Work Authorisation' }, { rule: 'Line of Fire' }, { rule: 'Working at Height' }]);
  }
  const totalHigh = lsrRows.reduce((s, r) => s + (Number(r.high) || Number(r.count) || 0), 0) || 1;
  const lsrProg = lsrRows.map((r, i) => ({
    id: `lsr-${i}`,
    label: `${r.rule} compliance program`,
    factor: Math.round(Math.min(0.5, 0.3 + ((Number(r.high) || Number(r.count) || 0) / totalHigh) * 0.2) * 100) / 100,
    group: 'Life-Saving Rules',
  }));

  const actRows = (Array.isArray(activities) ? activities : []).filter((a) => a.activity && a.n).slice(0, 3);
  const totalAct = actRows.reduce((s, a) => s + Number(a.n), 0) || 1;
  const actProg = actRows.map((a, i) => ({
    id: `act-${i}`,
    label: `Control program: ${a.activity}`,
    factor: Math.round(Math.min(0.48, 0.28 + (Number(a.n) / totalAct) * 0.18) * 100) / 100,
    group: 'High-Risk Activities',
  }));

  const seen = new Set();
  return [...barrier, ...lsrProg, ...actProg].filter((p) => {
    const k = p.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function WhatIfSimulator({ daily_trend = [], top_failed_barriers = [], lsr = [], activities = [] }) {
  const [open, setOpen] = useState(false);
  const [coverage, setCoverage] = useState(60);
  const [sel, setSel] = useState(0);
  const modalRef = useRef(null);

  const baseline = useMemo(() => {
    const totalReports = daily_trend.reduce((s, d) => s + (Number(d.total) || 0), 0);
    const weightedSum = daily_trend.reduce((s, d) => s + (Number(d.avg_score) || 0) * (Number(d.total) || 0), 0);
    const critHigh = daily_trend.reduce((s, d) => s + (Number(d.critical) || 0) + (Number(d.high) || 0), 0);
    return {
      totalReports,
      critHigh,
      avgScore: totalReports ? Math.round((weightedSum / totalReports) * 10) / 10 : 0,
    };
  }, [daily_trend]);

  const programs = useMemo(
    () => buildPrograms(top_failed_barriers, lsr, activities),
    [top_failed_barriers, lsr, activities]
  );

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of programs) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    return [...map.entries()];
  }, [programs]);

  useEffect(() => {
    if (sel >= programs.length) setSel(0);
  }, [programs.length, sel]);

  const program = programs[sel] || programs[0];
  const impact = Math.min(0.7, (coverage / 100) * (program?.factor || 0));
  const after = Math.max(0, Math.round(baseline.avgScore * (1 - impact) * 10)) / 10;
  const dropPct = Math.round(impact * 100);
  const afterCritHigh = Math.max(0, Math.round(baseline.critHigh * (1 - impact)));
  const meter = Math.min(100, dropPct * 1.4);

  const openModal = () => {
    setOpen(true);
    requestAnimationFrame(() => document.getElementById('wisim-program')?.focus());
  };
  const closeModal = () => setOpen(false);

  return (
    <div data-wisim="wrap">
      <style>{WISIM_CSS}</style>

      <button type="button" className="wisim-btn" onClick={openModal}>
        <Wand2 size={16} />
        What-If Simulator
      </button>

      <div
        className={`wisim-modal${open ? ' open' : ''}`}
        ref={modalRef}
        aria-hidden={!open}
        onClick={(e) => { if (e.target === modalRef.current) closeModal(); }}
      >
        <div className="wisim-panel" role="dialog" aria-modal="true" aria-labelledby="wisim-title">
          <button type="button" className="wisim-close" aria-label="Close" onClick={closeModal}>
            <X size={18} />
          </button>

          <div className="wisim-header">
            <div className="wisim-badge">What-If Simulator</div>
            <h2 id="wisim-title">How much will our SIF risk drop?</h2>
            <p className="wisim-sub">Model the impact of a safety program on incidents that haven&apos;t happened yet.</p>
          </div>

          <div className="wisim-section">
            <label className="wisim-label" htmlFor="wisim-program">Safety program / intervention</label>
            <select id="wisim-program" className="wisim-program" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
              {groups.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((p) => (
                    <option key={p.id} value={programs.indexOf(p)}>{p.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="wisim-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="wisim-label" htmlFor="wisim-coverage">Workforce coverage / barriers closed</label>
              <span className="wisim-pct">{coverage}%</span>
            </div>
            <input
              id="wisim-coverage"
              className="wisim-range"
              type="range"
              min={0}
              max={100}
              value={coverage}
              step={5}
              onChange={(e) => setCoverage(Number(e.target.value))}
            />
          </div>

          <div className="wisim-results">
            <div className="wisim-stat">
              <div className="wisim-stat-label">Current avg SIF risk score</div>
              <div className="wisim-stat-value">{baseline.avgScore.toFixed(1)}</div>
            </div>
            <div className="wisim-arrow">&rarr;</div>
            <div className="wisim-stat wisim-stat-after">
              <div className="wisim-stat-label">Projected after program</div>
              <div className="wisim-stat-value">{after.toFixed(1)}</div>
            </div>
            <div className="wisim-impact">
              <div className="wisim-impact-label">Projected risk reduction</div>
              <div className="wisim-impact-value">&minus;{dropPct}%</div>
            </div>
          </div>

          <div className="wisim-meter">
            <div className="wisim-meter-track">
              <div className="wisim-meter-fill" style={{ width: `${meter}%` }} />
            </div>
            <div className="wisim-meter-labels">
              <span>Risk retained</span>
              <span>Risk removed</span>
            </div>
          </div>

          <div className="wisim-projection">
            <div className="wisim-proj-row">
              <span>High-risk reports over the period</span>
              <strong>{baseline.critHigh} &rarr; {afterCritHigh}</strong>
            </div>
            <div className="wisim-proj-row">
              <span>Program</span>
              <strong>{program?.label} &middot; {coverage}% coverage</strong>
            </div>
          </div>

          <p className="wisim-note">Estimates are based on current barrier-failure patterns and AI severity distributions. They model direction and magnitude, not guarantees.</p>
        </div>
      </div>
    </div>
  );
}