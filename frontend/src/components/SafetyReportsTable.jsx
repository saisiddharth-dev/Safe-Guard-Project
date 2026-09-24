import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Check, Search, X, SlidersHorizontal, ChevronsUpDown, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, RotateCw, MapPin, Clock, Sun, Moon, AlertTriangle,
  Flame, Wrench, Box, Car, Cog, Construction as ConstructionIcon, Forklift, Factory,
  Zap, Crosshair, Mountain, ClipboardCheck, ShieldOff, Brush, Shield, Sparkles,
} from 'lucide-react';
import { fmt, ALL_LSRS } from '../api';

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const RISK_PILL = {
  CRITICAL: { bg: '#FEE2E2', fg: '#DC2626' },
  HIGH: { bg: '#FFEDD5', fg: '#EA580C' },
  MEDIUM: { bg: '#FEF3C7', fg: '#CA8A04' },
  LOW: { bg: '#DCFCE7', fg: '#16A34A' },
};

const REVIEW_PILL = {
  auto_classified: { bg: '#DCFCE7', fg: '#15803D', icon: Check, pulse: false },
  pending_review: { bg: '#FEF3C7', fg: '#B45309', pulse: true },
  mandatory_review: { bg: '#FEE2E2', fg: '#B91C1C', pulse: true },
  reviewed: { bg: '#E0E7FF', fg: '#4338CA' },
};

const LANG = { english: 'English', hindi: 'Hindi', assamese: 'Assamese', bengali: 'Bengali', odia: 'Odia' };

const ACTIVITY_ICONS = {
  'Hot Work': Flame,
  'Maintenance': Wrench,
  'Confined Space Entry': Box,
  'Transportation': Car,
  'General Operation': Cog,
  'Construction': ConstructionIcon,
  'Lifting': Forklift,
  'Storage / Tank Work': Factory,
};

const LSR_ICONS = {
  'Energy Isolation': Zap,
  'Hot Work': Flame,
  'Confined Space': Box,
  'Line of Fire': Crosshair,
  'Working at Height': Mountain,
  'Safe Mechanical Lifting': Forklift,
  'Work Authorisation': ClipboardCheck,
  'Driving': Car,
  'Bypassing Safety Controls': ShieldOff,
  'General / Housekeeping': Brush,
};

const CSS = `
.srt { --srt-bg:#ffffff; --srt-header:#F8FAFC; --srt-border:#EEF1F5; --srt-hover:#F5F8FF;
  --srt-text:#0F172A; --srt-muted:#64748B; --srt-accent:#2F7CF6; --srt-accent-soft:#EAF2FF;
  --srt-shadow:0 1px 3px rgba(0,0,0,.08); --srt-radius:14px;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif; color:var(--srt-text); }
html.dark .srt { --srt-bg:#121A2E; --srt-header:#16203A; --srt-border:#25314D; --srt-hover:#1A2440;
  --srt-text:#E6EDF7; --srt-muted:#8FA1B8; --srt-accent:#5B9BFF; --srt-accent-soft:#1E2A4A;
  --srt-shadow:0 1px 3px rgba(0,0,0,.5); }
.srt * { box-sizing:border-box; }
.srt .srt-wrap { background:var(--srt-bg); border:1px solid var(--srt-border); border-radius:var(--srt-radius);
  box-shadow:var(--srt-shadow); overflow:hidden; }

/* ---------- filter bar ---------- */
.srt .srt-filters { display:flex; flex-wrap:wrap; align-items:center; gap:.625rem; padding:.875rem 1rem;
  border-bottom:1px solid var(--srt-border); background:var(--srt-bg); }
.srt .srt-input { display:flex; align-items:center; gap:8px; border:1px solid #DDE3EC; border-radius:10px;
  background:#fff; padding:0 10px; height:38px; transition:border-color .15s ease, box-shadow .15s ease; }
.srt .srt-input:focus-within { border-color:var(--srt-accent); box-shadow:0 0 0 3px var(--srt-accent-soft); }
.srt .srt-input input, .srt .srt-input select { border:none; outline:none; background:transparent;
  font:inherit; font-size:13px; color:var(--srt-text); height:100%; width:100%; }
.srt .srt-input select { cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 6px center; padding-right:22px; }
.srt .srt-btn { display:inline-flex; align-items:center; gap:6px; border:1px solid #DDE3EC; background:#fff;
  color:#334155; border-radius:10px; height:38px; padding:0 14px; font:inherit; font-size:13px; font-weight:600;
  cursor:pointer; transition:background .15s ease, border-color .15s ease, transform .1s ease; white-space:nowrap; }
.srt .srt-btn:hover { border-color:#C9D4E4; background:#F8FAFC; }
.srt .srt-btn:active { transform:translateY(1px); }
.srt .srt-btn-clear { color:var(--srt-accent); border-color:var(--srt-accent-soft); background:var(--srt-accent-soft); }
.srt .srt-btn-clear:hover { background:#DDE9FF; border-color:#BFD6FF; }
.srt .srt-btn-primary { background:var(--srt-accent); color:#fff; border-color:var(--srt-accent); }
.srt .srt-btn-primary:hover { background:#2566E0; border-color:#2566E0; }
.srt .srt-filters-panel { padding:0 1rem .875rem; background:var(--srt-bg); }
.srt .srt-filters-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:.625rem; }

/* ---------- toolbar (tablet/mobile) ---------- */
.srt .srt-toolbar { display:flex; align-items:center; gap:.625rem; padding:.625rem 1rem; border-bottom:1px solid var(--srt-border); background:var(--srt-bg); }

/* ---------- table ---------- */
.srt .srt-scroll { overflow:auto; max-height:calc(100vh - 340px); min-height:420px; scrollbar-width:thin; scrollbar-color:#C6D0DC transparent; }
.srt .srt-scroll::-webkit-scrollbar { width:9px; height:9px; }
.srt .srt-scroll::-webkit-scrollbar-track { background:transparent; }
.srt .srt-scroll::-webkit-scrollbar-thumb { background:#C6D0DC; border-radius:6px; }
.srt .srt-scroll::-webkit-scrollbar-thumb:hover { background:#A8B6C8; }
.srt .srt-grid { display:grid; min-width:0; }
.srt .srt-th, .srt .srt-td { min-height:52px; padding:.5rem .75rem; display:flex; align-items:center; gap:6px;
  border-bottom:1px solid var(--srt-border); background:var(--srt-bg); font-size:13px; }
.srt .srt-td-ellipsis { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.srt .srt-th { position:sticky; top:0; z-index:6; background:var(--srt-header); text-transform:uppercase;
  font-size:11px; font-weight:700; letter-spacing:.05em; color:var(--srt-muted); border-bottom:1px solid #E3E9F2; }
.srt .srt-th-id, .srt .srt-td-id { position:sticky; left:0; z-index:4; }
.srt .srt-th-id { z-index:7; }
.srt .srt-row { display:contents; cursor:pointer; }
.srt .srt-row .srt-td { transition:background-color .15s ease; }
.srt .srt-row:hover .srt-td { background:var(--srt-hover); }
.srt .srt-row.srt-active .srt-td { background:#EAF2FF; box-shadow:inset 3px 0 0 var(--srt-accent); }
.srt .srt-row.srt-active:hover .srt-td { background:#DFEBFF; }
.srt .srt-row:hover .srt-td-id { background:var(--srt-hover); }
.srt .srt-desc { overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  line-height:1.4; font-size:13px; color:var(--srt-text); cursor:default; }
.srt .srt-id { font-family:'JetBrains Mono', ui-monospace, monospace; font-size:11.5px; font-weight:600; color:var(--srt-muted); white-space:nowrap; }
.srt .srt-sorthint { display:inline-flex; opacity:.45; color:#94A3B8; }
.srt .srt-th[data-sort] .srt-sorthint { opacity:1; color:var(--srt-accent); }
.srt .srt-th-btn { display:inline-flex; align-items:center; gap:5px; border:none; background:none; cursor:pointer;
  font:inherit; font-weight:700; letter-spacing:inherit; color:inherit; text-transform:inherit; padding:0; }
.srt .srt-empty-col { min-width:20px; }

/* ---------- pills / chips ---------- */
.srt .srt-pill { display:inline-flex; align-items:center; gap:5px; border-radius:999px; padding:3px 10px;
  font-size:11px; font-weight:700; white-space:nowrap; transition:transform .15s ease, box-shadow .15s ease; }
.srt .srt-row:hover .srt-pill { transform:translateY(-1px); box-shadow:0 2px 6px rgba(0,0,0,.12); }
.srt .srt-pill-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
.srt .srt-pill .srt-pill-dot { animation:srtPulse 1.4s ease-in-out infinite; }
@keyframes srtPulse { 0%,100%{opacity:.2; transform:scale(.8);} 50%{opacity:1; transform:scale(1);} }
.srt .srt-chip { display:inline-flex; align-items:center; gap:6px; border-radius:9px; padding:4px 9px; font-size:12px; font-weight:600; white-space:nowrap; }
.srt .srt-chip-activity { background:#EFF6FF; color:#1D4ED8; }
.srt .srt-chip-lsr { background:#F5F3FF; color:#6D28D9; }
.srt .srt-chip-site { background:#F1F5F9; color:#475569; }
.srt .srt-sif { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:8px;
  background:#FEF2F2; color:#DC2626; border:1px solid #FECACA; }

/* ---------- slide-over drawer ---------- */
.srt .srt-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); backdrop-filter:blur(3px); z-index:60; animation:srtFade .18s ease; }
.srt .srt-drawer { position:fixed; top:0; right:0; bottom:0; width:min(500px,100vw); background:#fff; z-index:61;
  display:flex; flex-direction:column; box-shadow:-20px 0 56px rgba(15,23,42,.24); animation:srtDrawer .32s cubic-bezier(.22,.9,.32,1); }
@keyframes srtDrawer { from { transform:translateX(100%); } to { transform:none; } }
@keyframes srtFade { from { opacity:0; } to { opacity:1; } }
.srt .srt-drawer-head { position:relative; background:linear-gradient(135deg,#0F172A 0%,#1C2E4A 60%,#24506F 100%);
  padding:1.25rem 1.25rem 1rem; color:#fff; overflow:hidden; }
.srt .srt-drawer-head::after { content:''; position:absolute; right:-40px; top:-60px; width:220px; height:220px; border-radius:50%;
  background:radial-gradient(circle, rgba(47,124,246,.28), transparent 65%); pointer-events:none; }
.srt .srt-drawer-eyebrow { font-size:9.5px; font-weight:800; letter-spacing:.16em; color:#8FA3C4; }
.srt .srt-drawer-head-row { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; margin-top:6px; position:relative; }
.srt .srt-drawer-id { font-family:'JetBrains Mono', ui-monospace, monospace; font-size:19px; font-weight:700; color:#fff; letter-spacing:.01em; }
.srt .srt-drawer-sub { font-size:12px; color:#A9BADC; margin-top:.3125rem; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.srt .srt-drawer-sub b { color:#E2E8F0; font-weight:600; }
.srt .srt-drawer-riskbar { height:5px; background:linear-gradient(90deg, var(--srt-accent), #2F7CF6); }
.srt .srt-head-close { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; flex:0 0 32px;
  border-radius:9px; border:none; background:rgba(255,255,255,.1); color:#E2E8F0; cursor:pointer; transition:background .12s ease, color .12s ease; }
.srt .srt-head-close:hover { background:rgba(255,255,255,.2); color:#fff; }
.srt .srt-drawer-badges { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; padding:.75rem 1.25rem 0; }
.srt .srt-detail-close { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; flex:0 0 32px;
  border-radius:9px; border:1px solid #E3E9F2; background:#fff; color:#64748B; cursor:pointer; transition:background .12s ease, color .12s ease, border-color .12s ease; }
.srt .srt-detail-close:hover { background:#F1F5F9; color:#0F172A; border-color:#CBD7E6; }
.srt .srt-detail-body { flex:1; overflow-y:auto; padding:.875rem 1.25rem 1.25rem; }
.srt .srt-detail-sec-label { font-size:10.5px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:#94A3B8; margin:18px 0 8px; display:flex; align-items:center; gap:6px; }
.srt .srt-detail-sec-label:first-child { margin-top:2px; }
.srt .srt-detail-sec-label::before { content:''; width:3px; height:11px; border-radius:2px; background:var(--srt-accent); }
.srt .srt-detail-desc { border:1px solid #E3E9F2; border-radius:12px; background:#F8FAFC; padding:14px 16px;
  font-size:13.5px; line-height:1.6; color:var(--srt-text); white-space:pre-wrap; }
.srt .srt-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.625rem; }
.srt .srt-detail-fbox { border:1px solid #EEF1F5; border-radius:10px; background:#fff; padding:10px 12px; }
.srt .srt-bar { height:6px; border-radius:999px; background:#E8EDF4; overflow:hidden; margin-top:6px; }
.srt .srt-bar > span { display:block; height:100%; border-radius:999px; background:var(--srt-accent); }

/* stats band */
.srt .srt-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.5rem; padding:.875rem 1.25rem 0; }
.srt .srt-stat { border:1px solid #EEF1F5; border-radius:11px; background:#fff; padding:9px 10px; min-width:0; }
.srt .srt-stat-label { font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#94A3B8; }
.srt .srt-stat-val { font-size:14px; font-weight:800; color:var(--srt-text); margin-top:3px; display:flex; align-items:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
@media (max-width: 400px) {
  .srt .srt-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
}

/* LSR list */
.srt .srt-lsr { border:1px solid #E3E9F2; border-radius:11px; background:#fff; padding:11px 13px; margin-bottom:8px; }
.srt .srt-lsr-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.srt .srt-lsr-name { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:700; color:var(--srt-text); }
.srt .srt-lsr-pct { font-size:11.5px; font-weight:700; color:var(--srt-muted); font-family:'JetBrains Mono',ui-monospace,monospace; }
.srt .srt-lsr-cf { display:flex; align-items:center; gap:8px; }
.srt .srt-lsr-cf .srt-bar { width:72px; margin:0; }
.srt .srt-prim { font-size:9px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#B91C1C;
  background:#FEE2E2; border-radius:6px; padding:2px 6px; }
.srt .srt-lsr-controls { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
.srt .srt-lsr-ctl { font-size:11px; color:#64748B; background:#F1F5F9; border:1px solid #E7EDF6; border-radius:7px; padding:2px 8px; }

/* AI intelligence */
.srt .srt-ai-box { border:1px solid #E3E9F2; border-radius:11px; background:#FBFCFE; padding:12px 14px; margin-bottom:10px; }
.srt .srt-ai-ex { display:flex; align-items:flex-start; gap:7px; font-size:13px; color:#334155; line-height:1.45; padding:3px 0; }
.srt .srt-ai-ex .srt-chev { color:var(--srt-accent); margin-top:1px; flex:0 0 auto; }
.srt .srt-ai-action { display:flex; align-items:flex-start; gap:8px; font-size:13px; color:#334155; line-height:1.45; padding:3px 0; }
.srt .srt-ai-action .srt-check { color:#16A34A; margin-top:1.5px; flex:0 0 auto; }
.srt .srt-evidence { display:flex; flex-wrap:wrap; gap:5px; }
.srt .srt-ev-chip { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:11px; color:#1D4ED8; background:#EFF6FF;
  border:1px solid #DBEAFE; border-radius:7px; padding:2px 8px; }
.srt .srt-reason { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:11px; color:#6D28D9; background:#F5F3FF;
  border:1px solid #EDE9FE; border-radius:7px; padding:2px 8px; }
.srt .srt-meta-row { font-size:11.5px; color:var(--srt-muted); }
.srt .srt-meta-row b { font-family:'JetBrains Mono',ui-monospace,monospace; color:#475569; font-weight:700; }
.srt .srt-detail-foot { flex:0 0 auto; display:flex; align-items:center; gap:.625rem; padding:.875rem 1.25rem; border-top:1px solid var(--srt-border); background:#FCFDFE; }
.srt .srt-detail-foot .srt-btn { flex:1; justify-content:center; height:44px; border-radius:11px; font-size:13.5px; }
.srt .srt-btn-ghost2 { background:#F1F5F9; border-color:#E3E9F2; color:#334155; }
.srt .srt-btn-ghost2:hover { background:#E7EDF6; border-color:#CBD7E6; }

/* ---------- footer / pagination ---------- */
.srt .srt-footer { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.625rem;
  padding:.75rem 1rem; border-top:1px solid var(--srt-border); background:var(--srt-bg); font-size:12.5px; color:var(--srt-muted); }
.srt .srt-pg { display:flex; align-items:center; gap:.25rem; }
.srt .srt-pg-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px;
  border:1px solid #DDE3EC; background:#fff; color:#334155; border-radius:9px; cursor:pointer; font:inherit;
  transition:background .12s ease, border-color .12s ease, color .12s ease; }
.srt .srt-pg-btn:hover:not(:disabled) { background:var(--srt-hover); border-color:var(--srt-accent); color:var(--srt-accent); }
.srt .srt-pg-btn:disabled { opacity:.4; cursor:not-allowed; }
.srt .srt-pg-select { border:1px solid #DDE3EC; border-radius:8px; padding:.25rem .375rem; font:inherit; font-size:12px; color:var(--srt-muted); background:#fff; cursor:pointer; outline:none; }

/* ---------- skeleton ---------- */
.srt .srt-sk-row { display:contents; }
.srt .srt-sk { height:12px; border-radius:6px; background:linear-gradient(90deg,#EEF1F5 25%,#F5F8FF 37%,#EEF1F5 63%);
  background-size:400% 100%; animation:srtShimmer 1.3s ease infinite; }
@keyframes srtShimmer { 0%{background-position:100% 0;} 100%{background-position:0 0;} }

/* ---------- empty / error ---------- */
.srt .srt-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;
  padding:56px 20px; text-align:center; min-height:320px; }
.srt .srt-state-title { font-size:15px; font-weight:700; color:var(--srt-text); }
.srt .srt-state-sub { font-size:13px; color:var(--srt-muted); max-width:360px; }
.srt .srt-err { display:flex; align-items:center; gap:10px; margin:12px 16px 0; padding:11px 14px; border-radius:10px;
  background:#FEF2F2; border:1px solid #FECACA; color:#B91C1C; font-size:13px; }

/* ---------- mobile cards ---------- */
.srt .srt-cards { padding:.75rem; display:flex; flex-direction:column; gap:.625rem; }
.srt .srt-card { background:var(--srt-bg); border:1px solid var(--srt-border); border-radius:12px; padding:.75rem .875rem;
  cursor:pointer; transition:border-color .15s ease, box-shadow .15s ease, transform .12s ease; position:relative; }
.srt .srt-card:hover { border-color:#CBD7E6; box-shadow:0 4px 14px rgba(15,23,42,.08); transform:translateY(-1px); }
.srt .srt-card.srt-active { border-color:var(--srt-accent); box-shadow:0 0 0 1px var(--srt-accent), 0 4px 14px rgba(47,124,246,.16); }
.srt .srt-card-top { display:flex; align-items:center; gap:.625rem; min-width:0; }
.srt .srt-card-top .srt-id { min-width:0; overflow:hidden; text-overflow:ellipsis; }
.srt .srt-card-top .srt-pill, .srt .srt-card-top .srt-sif { flex:0 0 auto; }
.srt .srt-card-meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; margin-top:.625rem; }
.srt .srt-card-meta .srt-chip { justify-content:flex-start; }
.srt .srt-card-desc { margin-top:.5rem; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
  line-height:1.45; font-size:13px; color:var(--srt-text); }
.srt .srt-card-foot { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.5rem; margin-top:.75rem;
  padding-top:.625rem; border-top:1px dashed var(--srt-border); font-size:12px; color:var(--srt-muted); }

/* ---------- field label ---------- */
.srt .srt-fld { display:flex; flex-direction:column; gap:2px; min-width:0; }
.srt .srt-fld-label { font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#94A3B8; }
.srt .srt-fld-val { font-size:13px; font-weight:600; color:var(--srt-text); display:flex; align-items:center; gap:5px;
  flex-wrap:wrap; min-width:0; overflow-wrap:anywhere; }
.srt .srt-fld-val svg { flex:0 0 auto; }

/* ---------- mobile tightening ---------- */
@media (max-width: 767px) {
  .srt .srt-toolbar { padding:.625rem .75rem; }
  .srt .srt-filters { padding:.75rem; }
  .srt .srt-filters-panel { padding:0 .75rem .75rem; }
  .srt .srt-cards { padding:.625rem; }
  .srt .srt-card { padding:.75rem; }
  .srt .srt-drawer-head { padding:1rem 1rem .75rem; }
  .srt .srt-drawer-badges { padding:.75rem 1rem 0; }
  .srt .srt-drawer-id { font-size:16px; }
  .srt .srt-detail-body { padding:.875rem 1rem 1rem; }
  .srt .srt-detail-foot { padding:.75rem 1rem; }
  .srt .srt-footer { padding:.75rem; }
  /* 44px touch targets on phones */
  .srt .srt-input { height:44px; }
  .srt .srt-btn { height:44px; }
  .srt .srt-head-close, .srt .srt-detail-close, .srt .srt-pg-btn { width:44px; height:44px; flex-basis:44px; }
  .srt .srt-drawer-head-row .srt-head-close { flex:0 0 44px; }
}

/* ---------- dark theme ---------- */
html.dark .srt .srt-input, html.dark .srt .srt-btn, html.dark .srt .srt-drawer,
html.dark .srt .srt-detail-fbox, html.dark .srt .srt-stat, html.dark .srt .srt-lsr,
html.dark .srt .srt-pg-select { background:#16203A; border-color:#2E3D63; }
html.dark .srt .srt-input { box-shadow:none; }
html.dark .srt .srt-detail-desc { background:#16203A; border-color:#2E3D63; }
html.dark .srt .srt-detail-close { background:#16203A; border-color:#2E3D63; color:#8FA1B8; }
html.dark .srt .srt-detail-close:hover { background:#25314D; color:#fff; border-color:#314063; }
html.dark .srt .srt-chip-site { background:#25314D; color:#B6C3D6; }
html.dark .srt .srt-lsr-ctl { background:#1A2440; color:#8FA1B8; border-color:#2E3D63; }
html.dark .srt .srt-ai-box { background:#16203A; border-color:#2E3D63; }
html.dark .srt .srt-ai-ex, html.dark .srt .srt-ai-action { color:#B6C3D6; }
html.dark .srt .srt-btn-ghost2 { background:#25314D; color:#E6EDF7; border-color:#314063; }
`;

function Sorter({ dir }) {
  if (!dir) return <span className="srt-sorthint"><ChevronsUpDown size={13} /></span>;
  return <span className="srt-sorthint">{dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>;
}

function reviewOf(r) {
  return String(r.review_status || '').toLowerCase();
}

function pjson(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

function DetailCard({ r, onClose, onView }) {
  const rs = RISK_PILL[r.risk_level] || { bg: '#F1F5F9', fg: '#64748B' };
  const rv = REVIEW_PILL[reviewOf(r)];
  const RevIcon = rv && rv.icon;
  const rule = r.primary_lsr || r.lsr_json?.[0]?.rule || '';
  const LsrIcon = LSR_ICONS[rule] || Shield;
  const ActIcon = ACTIVITY_ICONS[r.activity] || Wrench;
  const confNum = r.sif_confidence != null ? Math.round((r.sif_confidence || 0) * 100) : null;
  const conf = confNum != null ? `${confNum}%` : '—';
  const lsrs = pjson(r.lsr_json);
  const explanation = pjson(r.explanation_json);
  const actions = pjson(r.recommended_actions);
  const evidence = pjson(r.evidence_json);
  const reasons = pjson(r.reason_codes);
  const sub = r.submitter || r.submitter_id || '—';
  const location = r.site_name || r.site || r.location_text || '—';
  const type = r.type || r.source || 'Observation';
  return (
    <div className="srt-drawer" role="dialog" aria-modal="true" aria-label={`Report ${r.report_no || ''} details`}>
      <div className="srt-drawer-head">
        <div className="srt-drawer-eyebrow">Safety Report</div>
        <div className="srt-drawer-head-row">
          <div>
            <div className="srt-drawer-id">{r.report_no || ''}</div>
            <div className="srt-drawer-sub">
              <span><b>{type}</b></span>
              <span style={{ opacity: 0.5 }}>·</span>
              <Clock size={12} /> {fmt.ago(r.created_at)}
              <span style={{ opacity: 0.5 }}>·</span>
              <MapPin size={12} /> {location}
            </div>
          </div>
          <button className="srt-head-close" onClick={onClose} aria-label="Close details"><X size={17} /></button>
        </div>
      </div>
      <div className="srt-drawer-riskbar" style={{ background: `linear-gradient(90deg, ${rs.fg}, ${rs.fg}66)` }} />

      <div className="srt-drawer-badges">
        <span className="srt-pill" style={{ background: rs.bg, color: rs.fg }}>{r.risk_level || '—'}</span>
        {rv ? (
          <span className="srt-pill" style={{ background: rv.bg, color: rv.fg }}>
            {rv.pulse && <span className="srt-pill-dot" />}
            {RevIcon && !rv.pulse && <RevIcon size={12} strokeWidth={2.8} />}
            {reviewOf(r).replace(/_/g, ' ')}
          </span>
        ) : <span className="srt-chip" style={{ background: '#F1F5F9', color: '#64748B' }}>{r.review_status || '—'}</span>}
        {r.sif_potential && <span className="srt-sif" title="SIF potential"><AlertTriangle size={13} /></span>}
      </div>

      <div className="srt-stats">
        <div className="srt-stat">
          <div className="srt-stat-label">AI Confidence</div>
          <div className="srt-stat-val">{conf}</div>
          {confNum != null && <div className="srt-bar"><span style={{ width: `${confNum}%` }} /></div>}
        </div>
        <div className="srt-stat">
          <div className="srt-stat-label">SIF potential</div>
          <div className="srt-stat-val" style={{ color: r.sif_potential ? '#DC2626' : '#16A34A' }}>
            {r.sif_potential ? 'YES' : 'NO'}
          </div>
        </div>
        <div className="srt-stat">
          <div className="srt-stat-label">Shift</div>
          <div className="srt-stat-val">{r.shift === 'Night' ? <Moon size={13} /> : <Sun size={13} />} {r.shift || '—'}</div>
        </div>
        <div className="srt-stat">
          <div className="srt-stat-label">Submitted</div>
          <div className="srt-stat-val">{fmt.ago(r.created_at).replace(' ago', '')}</div>
        </div>
      </div>

      <div className="srt-detail-body">
        <div className="srt-detail-sec-label">Report description</div>
        <div className="srt-detail-desc">{r.text_original || ''}</div>

        {(r.hazard || r.barrier_failure || r.potential_consequence || r.root_cause) && (
          <>
            <div className="srt-detail-sec-label">AI classification</div>
            <div className="srt-detail-grid">
              {r.hazard && <div className="srt-detail-fbox"><div className="srt-fld-label">Hazard</div><div className="srt-fld-val"><span className="min-w-0">{r.hazard}</span></div></div>}
              {r.barrier_failure && <div className="srt-detail-fbox"><div className="srt-fld-label">Barrier failure</div><div className="srt-fld-val"><span className="min-w-0">{r.barrier_failure}</span></div></div>}
              {r.potential_consequence && <div className="srt-detail-fbox"><div className="srt-fld-label">Potential consequence</div><div className="srt-fld-val"><span className="min-w-0">{r.potential_consequence}</span></div></div>}
              {r.root_cause && <div className="srt-detail-fbox"><div className="srt-fld-label">Root cause</div><div className="srt-fld-val"><span className="min-w-0">{r.root_cause}</span></div></div>}
            </div>
          </>
        )}

        <div className="srt-detail-sec-label">Key details</div>
        <div className="srt-detail-grid">
          <div className="srt-detail-fbox"><div className="srt-fld-label">Activity</div><div className="srt-fld-val"><ActIcon size={13} /> <span className="min-w-0">{r.activity || '—'}</span></div></div>
          <div className="srt-detail-fbox"><div className="srt-fld-label">Primary LSR</div><div className="srt-fld-val"><LsrIcon size={13} /> <span className="min-w-0">{rule || '—'}</span></div></div>
          <div className="srt-detail-fbox"><div className="srt-fld-label">Language</div><div className="srt-fld-val"><span className="min-w-0">{LANG[r.lang] || r.lang || '—'}</span></div></div>
          <div className="srt-detail-fbox"><div className="srt-fld-label">Submitter</div><div className="srt-fld-val"><span className="min-w-0">{sub}</span></div></div>
        </div>

        {lsrs.length > 0 && (
          <>
            <div className="srt-detail-sec-label">Life-Saving Rules mapped</div>
            {lsrs.slice(0, 4).map((l) => {
              const LIcon = LSR_ICONS[l.rule] || Shield;
              const pct = Math.round((l.confidence || 0) * 100);
              const primary = l.primary || l.primary === 1 || l.is_primary === 1;
              return (
                <div className="srt-lsr" key={l.rule}>
                  <div className="srt-lsr-row">
                    <span className="srt-lsr-name"><LIcon size={14} style={{ color: '#6D28D9' }} /> {l.rule}</span>
                    <span className="srt-lsr-cf">
                      {primary && <span className="srt-prim">Primary</span>}
                      <span className="srt-lsr-pct">{pct}%</span>
                      <span className="srt-bar"><span style={{ width: `${pct}%` }} /></span>
                    </span>
                  </div>
                  {(l.controls || []).length > 0 && (
                    <div className="srt-lsr-controls">
                      {(l.controls || []).slice(0, 5).map((c, i) => <span key={i} className="srt-lsr-ctl">{c}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {(explanation.length > 0 || actions.length > 0 || evidence.length > 0 || reasons.length > 0) && (
          <div className="srt-ai-box">
            <div className="srt-detail-sec-label" style={{ margin: '0 0 8px' }}><Sparkles size={12} style={{ color: 'var(--srt-accent)' }} /> AI Intelligence</div>
            {explanation.length > 0 && (
              <div>
                {explanation.slice(0, 5).map((ex, i) => (
                  <div key={i} className="srt-ai-ex"><ChevronRight size={13} className="srt-chev" />{ex}</div>
                ))}
              </div>
            )}
            {actions.length > 0 && (
              <div style={{ marginTop: explanation.length > 0 ? 10 : 0 }}>
                <div className="srt-stat-label" style={{ marginBottom: 4 }}>Recommended actions</div>
                {actions.slice(0, 4).map((a, i) => (
                  <div key={i} className="srt-ai-action"><Check size={13} className="srt-check" />{a}</div>
                ))}
              </div>
            )}
            {evidence.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="srt-stat-label" style={{ marginBottom: 5 }}>Key evidence</div>
                <div className="srt-evidence">{evidence.slice(0, 6).map((e, i) => <span key={i} className="srt-ev-chip">{e}</span>)}</div>
              </div>
            )}
            {reasons.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="srt-stat-label" style={{ marginBottom: 5 }}>Reason codes</div>
                <div className="srt-evidence">{reasons.slice(0, 6).map((rc, i) => <span key={i} className="srt-reason">{rc}</span>)}</div>
              </div>
            )}
            <div className="srt-meta-row" style={{ marginTop: 12 }}>
              Analyzed by <b>{r.model || 'SIF-v2.4'}</b> · Lang <b>{r.lang}</b>
            </div>
          </div>
        )}
      </div>

      <div className="srt-detail-foot">
        <button className="srt-btn srt-btn-ghost2" onClick={onClose}>Close</button>
        <button className="srt-btn srt-btn-primary" onClick={onView}>Open full report <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="128" height="110" viewBox="0 0 128 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="22" y="14" width="72" height="82" rx="10" fill="#EEF1F5" />
      <rect x="30" y="24" width="56" height="6" rx="3" fill="#D7DFEA" />
      <rect x="30" y="38" width="48" height="5" rx="2.5" fill="#E3E9F2" />
      <rect x="30" y="50" width="52" height="5" rx="2.5" fill="#E3E9F2" />
      <rect x="30" y="62" width="40" height="5" rx="2.5" fill="#E3E9F2" />
      <circle cx="87" cy="86" r="24" fill="#fff" stroke="#C6D0DC" strokeWidth="3" />
      <circle cx="79" cy="78" r="11" fill="#EAF2FF" stroke="#2F7CF6" strokeWidth="3" />
      <path d="M92 90 L102 100 M99 97 L103 101" stroke="#2F7CF6" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M40 76 l14 10 20-26" stroke="#2F7CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M108 14 l7 7 M114.5 17.5 l7-7" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
      <circle cx="112" cy="30" r="3" fill="#93C5FD" />
    </svg>
  );
}

const COLUMNS = [
  { key: 'report_no', label: 'Report ID', sortable: true, w: 'minmax(120px,.8fr)', table: true },
  { key: 'description', label: 'Description', sortable: false, w: 'minmax(280px,2.2fr)', table: true },
  { key: 'risk', label: 'Risk', sortable: true, w: 'minmax(110px,.8fr)', table: true },
  { key: 'review', label: 'Review', sortable: true, w: 'minmax(150px,1fr)', table: true },
  { key: 'activity', label: 'Activity', sortable: true, w: 'minmax(160px,1.1fr)', table: true },
  { key: 'lsr', label: 'LSR', sortable: true, w: 'minmax(170px,1.2fr)', table: true },
  { key: 'sif', label: 'SIF', sortable: true, w: 'minmax(70px,.5fr)', table: false },
  { key: 'site', label: 'Site', sortable: true, w: 'minmax(150px,1fr)', table: false },
  { key: 'shift', label: 'Shift', sortable: true, w: 'minmax(90px,.6fr)', table: false },
  { key: 'lang', label: 'Language', sortable: false, w: 'minmax(100px,.7fr)', table: true },
  { key: 'reported', label: 'Reported', sortable: true, w: 'minmax(120px,.9fr)', table: true },
];

function useMedia(query) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const q = window.matchMedia(query);
    const handle = (e) => setM(e.matches);
    setM(q.matches);
    if (q.addEventListener) { q.addEventListener('change', handle); return () => q.removeEventListener('change', handle); }
    if (q.addListener) { q.addListener(handle); return () => q.removeListener(handle); }
    return undefined;
  }, [query]);
  return m;
}

export default function SafetyReportsTable({ reports, meta, loading, error, onRetry, tab, user, activeId, onOpen }) {
  const isMobile = useMedia('(max-width: 767px)');
  const isTablet = useMedia('(min-width:768px) and (max-width:1024px)');
  const [filters, setFilters] = useState({ q: '', activity: '', lsr: '', risk: '', site: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [sort, setSort] = useState({ key: 'risk', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [expandedId, setExpandedId] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => { setPage(0); }, [filters.q, filters.activity, filters.lsr, filters.risk, filters.site, tab]);

  const rows = useMemo(() => {
    const list = Array.isArray(reports) ? reports : [];
    const q = (filters.q || '').trim().toLowerCase();
    return list.filter((r) => {
      if (tab === 'review' && r.review_status !== 'pending_review') return false;
      if (tab === 'mine' && r.submitter_id !== user?.id) return false;
      if (filters.activity && r.activity !== filters.activity) return false;
      if (filters.lsr && (r.primary_lsr || r.lsr_json?.[0]?.rule) !== filters.lsr) return false;
      if (filters.risk && r.risk_level !== filters.risk) return false;
      if (filters.site && Number(r.site_id) !== Number(filters.site)) return false;
      if (q) {
        const hay = ((r.text_original || '') + ' ' + (r.report_no || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, filters, tab, user]);

  const sortValue = (key, r) => {
    if (key === 'risk') return RISK_ORDER[r.risk_level] || 0;
    if (key === 'reported') return r.created_at ? new Date(r.created_at).getTime() : 0;
    if (key === 'lsr') return (r.primary_lsr || r.lsr_json?.[0]?.rule) || '';
    if (key === 'lang') return LANG[r.lang] || r.lang || '';
    return (r[key] || '');
  };

  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = sortValue(sort.key, a);
      const vb = sortValue(sort.key, b);
      let c;
      if (typeof va === 'number' && typeof vb === 'number') c = va - vb;
      else c = String(va).localeCompare(String(vb));
      if (c === 0) c = (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0);
      return c * dir;
    });
    return arr;
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  useEffect(() => {
    if (!expandedId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setExpandedId(null); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [expandedId]);

  const activities = useMemo(() => {
    if (meta?.activities?.length) return meta.activities.map((a) => a.activity);
    return [...new Set((reports || []).map((r) => r.activity).filter(Boolean))];
  }, [meta, reports]);

  const sites = useMemo(() => {
    if (meta?.sites?.length) return meta.sites;
    const m = new Map();
    (reports || []).forEach((r) => { if (r.site_id != null && r.site_name) m.set(r.site_id, { id: r.site_id, name: r.site_name }); });
    return [...m.values()];
  }, [meta, reports]);

  const clearFilters = () => setFilters({ q: '', activity: '', lsr: '', risk: '', site: '' });
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const lsrOf = (r) => r.primary_lsr || r.lsr_json?.[0]?.rule || '';
  const boardView = isMobile ? 'card' : isTablet ? 'tablet' : 'desktop';
  const visibleCols = COLUMNS.filter((c) => (boardView === 'desktop' || c.table));
  const allCols = COLUMNS.filter((c) => {
    if (boardView === 'desktop') return true;
    if (!c.table) return showExtra;
    return true;
  });
  const gridCols = boardView === 'desktop' ? COLUMNS : (showExtra ? COLUMNS : visibleCols);

  const renderFilterControls = () => (
    <>
      <div className="srt-input srt-q">
        <Search size={15} color="#94A3B8" />
        <input placeholder="Search text or report ID…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        {filters.q && <button className="srt-inline-x" onClick={() => setFilters({ ...filters, q: '' })} aria-label="Clear search"><X size={14} /></button>}
      </div>
      <div className="srt-input">
        <select value={filters.activity} onChange={(e) => setFilters({ ...filters, activity: e.target.value })} aria-label="Activity">
          <option value="">All activities</option>
          {activities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="srt-input">
        <select value={filters.lsr} onChange={(e) => setFilters({ ...filters, lsr: e.target.value })} aria-label="LSR">
          <option value="">All LSRs</option>
          {ALL_LSRS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="srt-input">
        <select value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })} aria-label="Risk">
          <option value="">All risk</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="srt-input">
        <select value={filters.site} onChange={(e) => setFilters({ ...filters, site: e.target.value })} aria-label="Site">
          <option value="">All sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {activeFilterCount > 0 && <button className="srt-btn srt-btn-clear" onClick={clearFilters}><X size={13} /> Clear</button>}
    </>
  );

  useEffect(() => {
    if (gridRef.current) { gridRef.current.scrollLeft = 0; gridRef.current.scrollTop = 0; }
  }, [sort, tab]);

  const renderCell = (col, r) => {
    switch (col.key) {
      case 'report_no':
        return <span className="srt-id">{r.report_no || ''}</span>;
      case 'description':
        return <span className="srt-desc" title={r.text_original || ''}>{r.text_original || ''}</span>;
      case 'risk': {
        const s = RISK_PILL[r.risk_level] || { bg: '#F1F5F9', fg: '#64748B' };
        return <span className="srt-pill" aria-label={`Risk ${r.risk_level}`} style={{ background: s.bg, color: s.fg }}>{r.risk_level || '—'}</span>;
      }
      case 'review': {
        const s = REVIEW_PILL[reviewOf(r)];
        if (!s) return <span className="srt-chip" style={{ background: '#F1F5F9', color: '#64748B' }}>{r.review_status || '—'}</span>;
        const Icon = s.icon;
        return (
          <span className="srt-pill" style={{ background: s.bg, color: s.fg }}>
            {s.pulse && <span className="srt-pill-dot" />}
            {Icon && !s.pulse && <Icon size={12} strokeWidth={2.8} />}
            {reviewOf(r).replace(/_/g, ' ')}
          </span>
        );
      }
      case 'activity': {
        const Icon = ACTIVITY_ICONS[r.activity] || Wrench;
        return <span className="srt-chip srt-chip-activity">{r.activity ? <><Icon size={13} /> {r.activity}</> : '—'}</span>;
      }
      case 'lsr': {
        const rule = lsrOf(r);
        const Icon = LSR_ICONS[rule] || Shield;
        return <span className="srt-chip srt-chip-lsr">{rule ? <><Icon size={13} /> {rule}</> : '—'}</span>;
      }
      case 'sif':
        return r.sif_potential ? <span className="srt-sif" title="SIF potential"><AlertTriangle size={14} /></span> : <span className="srt-empty-col" />;
      case 'site':
        return <span className="srt-chip srt-chip-site">{r.site_name ? <><MapPin size={13} /> {r.site_name}</> : '—'}</span>;
      case 'shift': {
        const Icon = r.shift === 'Night' ? Moon : Sun;
        return <span className="srt-chip" style={{ background: '#F8FAFC', color: '#475569' }}><Icon size={13} /> {r.shift || '—'}</span>;
      }
      case 'lang':
        return <span style={{ fontSize: 12.5, color: 'var(--srt-muted)' }}>{LANG[r.lang] || r.lang || '—'}</span>;
      case 'reported':
        return <span style={{ fontSize: 12.5, color: 'var(--srt-muted)', whiteSpace: 'nowrap' }}><Clock size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{fmt.ago(r.created_at)}</span>;
      default:
        return null;
    }
  };

  // ---------- loading skeleton ----------
  if (loading && !reports.length) {
    const sk = ['report_no', 'description', 'risk', 'review', 'activity', 'lsr', 'sif', 'site', 'shift'];
    const skCols = boardView === 'card' ? ['a', 'b', 'c'] : skColsFor(boardView);
    return (
      <div className="srt">
        <style>{CSS}</style>
        <div className="srt-wrap">
          <div className="srt-filters" style={{ opacity: 0.65, pointerEvents: 'none' }}>
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="srt-sk" style={{ width: i === 0 ? 220 : 150, height: 38 }} />)}
          </div>
          {boardView === 'card' ? (
            <div className="srt-cards">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="srt-card" style={{ pointerEvents: 'none' }}>
                <div className="srt-sk" style={{ width: 120 }} />
                <div className="srt-sk" style={{ width: '100%', marginTop: 10 }} />
                <div className="srt-sk" style={{ width: '82%', marginTop: 6 }} />
              </div>)}
            </div>
          ) : (
            <div className="srt-scroll">
              <div className="srt-grid">
                {gridCols.map((c) => <div key={`h-${c.key}`} className={`srt-th${c.key === 'report_no' ? ' srt-th-id' : ''}`} style={{ gridColumn: `${gridCols.indexOf(c) + 1}` }}><span className="srt-sk" style={{ height: 8, width: c.key === 'description' ? 180 : 52 }} /></div>)}
                {[0, 1, 2, 3, 4, 5].map((ri) => gridCols.map((c, ci) => (
                  <div key={`${ri}-${c.key}`} className={`srt-td${c.key === 'report_no' ? ' srt-td-id' : ''}`} style={{ gridColumn: `${ci + 1}`, gridRow: `${ri + 2}` }}>
                    <span className="srt-sk" style={{ width: c.key === 'description' ? '85%' : c.key === 'report_no' ? 80 : 44 }} />
                  </div>
                )))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- compact column set for skeleton desktop ----------
  function skColsFor(view) {
    return view === 'card' ? ['a', 'b', 'c'] : COLUMNS.filter((c) => (view === 'desktop' ? true : c.table)).map((c) => c.key);
  }

  return (
    <div className="srt">
      <style>{CSS}</style>
      <div className="srt-wrap">
        {error && (
          <div className="srt-err" role="alert">
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> {String(error)}</span>
            {onRetry && <button className="srt-btn srt-btn-clear" onClick={onRetry}><RotateCw size={13} /> Retry</button>}
          </div>
        )}

        {/* ---------- filter bar ---------- */}
        {!isMobile ? (
          <div className="srt-filters">{renderFilterControls()}</div>
        ) : (
          <>
            <div className="srt-toolbar">
              <button className="srt-btn" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
                <SlidersHorizontal size={14} /> Filters{activeFilterCount > 0 && <span style={{ background: 'var(--srt-accent)', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{activeFilterCount}</span>}
              </button>
              {activeFilterCount > 0 && <button className="srt-btn srt-btn-clear" onClick={clearFilters}><X size={13} /> Clear</button>}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--srt-muted)' }}>{sorted.length} reports</span>
            </div>
            {filtersOpen && <div className="srt-filters-panel"><div className="srt-filters-grid">{renderFilterControls()}</div></div>}
          </>
        )}

        {/* ---------- tablet extra columns toggle ---------- */}
        {isTablet && !isMobile && (
          <div className="srt-toolbar" style={{ paddingTop: 0, paddingBottom: 8, justifyContent: 'flex-end' }}>
            <button className="srt-btn" onClick={() => setShowExtra((s) => !s)} aria-expanded={showExtra}>
              {showExtra ? <ChevronsUpDown size={14} /> : <ChevronsUpDown size={14} />} {showExtra ? 'Hide extra columns' : 'Show extra columns'}
            </button>
          </div>
        )}

        {/* ---------- content ---------- */}
        {boardView === 'card' ? (
          <div className="srt-cards">
            {paged.map((r) => {
              const rs = RISK_PILL[r.risk_level] || { bg: '#F1F5F9', fg: '#64748B' };
              const rv = REVIEW_PILL[reviewOf(r)];
              const RevIcon = rv && rv.icon;
              return (
                <div key={r.id} className={`srt-card${expandedId === r.id ? ' srt-active' : ''}`} onClick={() => toggleExpand(r.id)}>
                    <div className="srt-card-top">
                      <span className="srt-id" style={{ fontSize: 12 }}>{r.report_no || ''}</span>
                      <span style={{ flex: 1 }} />
                      {r.sif_potential && <span className="srt-sif" title="SIF potential"><AlertTriangle size={13} /></span>}
                      <span className="srt-pill" style={{ background: rs.bg, color: rs.fg }}>{r.risk_level || '—'}</span>
                    </div>
                  <div className="srt-card-desc">{r.text_original || ''}</div>
                  <div className="srt-card-meta">
                    {(() => { const I = ACTIVITY_ICONS[r.activity] || Wrench; return <div className="srt-fld"><span className="srt-fld-label">Activity</span><span className="srt-fld-val"><I size={13} /> <span className="min-w-0">{r.activity || '—'}</span></span></div>; })()}
                    {(() => { const rule = lsrOf(r); const I = LSR_ICONS[rule] || Shield; return <div className="srt-fld"><span className="srt-fld-label">LSR</span><span className="srt-fld-val"><I size={13} /> <span className="min-w-0">{rule || '—'}</span></span></div>; })()}
                    <div className="srt-fld"><span className="srt-fld-label">Site</span><span className="srt-fld-val"><MapPin size={13} /> <span className="min-w-0">{r.site_name || '—'}</span></span></div>
                    {(() => { const I = r.shift === 'Night' ? Moon : Sun; return <div className="srt-fld"><span className="srt-fld-label">Shift</span><span className="srt-fld-val"><I size={13} /> <span className="min-w-0">{r.shift || '—'}</span></span></div>; })()}
                  </div>
                  <div className="srt-card-foot">
                    <span style={{ color: 'var(--srt-muted)' }}><Clock size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{fmt.ago(r.created_at)}</span>
                    {rv ? (
                      <span className="srt-pill" style={{ background: rv.bg, color: rv.fg }}>
                        {rv.pulse && <span className="srt-pill-dot" />}
                        {RevIcon && !rv.pulse && <RevIcon size={12} strokeWidth={2.8} />}
                        {reviewOf(r).replace(/_/g, ' ')}
                      </span>
                    ) : <span className="srt-chip" style={{ background: '#F1F5F9', color: '#64748B' }}>{r.review_status || '—'}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="srt-scroll" ref={gridRef}>
            <div className="srt-grid" style={{ gridTemplateColumns: gridCols.map((c) => c.w).join(' ') }}>
              {gridCols.map((c, i) => (
                <div key={`h-${c.key}`} className={`srt-th${c.key === 'report_no' ? ' srt-th-id' : ''}`} style={{ gridColumn: i + 1 }} data-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'asc' : 'desc') : undefined}>
                  {c.sortable ? (
                    <button className="srt-th-btn" onClick={() => toggleSort(c.key)} aria-label={`Sort by ${c.label}`}>
                      {c.label} <Sorter dir={sort.key === c.key ? sort.dir : null} />
                    </button>
                  ) : c.label}
                </div>
              ))}

              {paged.map((r, idx) => {
                const gi = idx + 2;
                const act = r.id === activeId || r.id === expandedId;
                return (
                  <div key={r.id} className={`srt-row${act ? ' srt-active' : ''}`} onClick={() => toggleExpand(r.id)}>
                    {gridCols.map((c, ci) => (
                      <div key={c.key} className={`srt-td${c.key === 'report_no' ? ' srt-td-id' : ''}`}
                        style={{ gridColumn: ci + 1, gridRow: gi }}>
                        {renderCell(c, r)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {!loading && sorted.length === 0 && !error && (
              <div className="srt-state">
                <EmptyIllustration />
                <div className="srt-state-title">{activeFilterCount > 0 ? 'No reports match your filters' : tab === 'mine' ? 'You have not submitted any reports yet' : 'No reports yet'}</div>
                <div className="srt-state-sub">{activeFilterCount > 0 ? 'Clear the filters to see every report.' : 'Submit your first report and it will appear here with AI classification.'}</div>
                {activeFilterCount > 0 && <button className="srt-btn srt-btn-clear" onClick={clearFilters}><X size={13} /> Clear filters</button>}
              </div>
            )}
          </div>
        )}

        {/* ---------- mobile empty state ---------- */}
        {boardView === 'card' && !loading && sorted.length === 0 && !error && (
          <div className="srt-state">
            <EmptyIllustration />
            <div className="srt-state-title">{activeFilterCount > 0 ? 'No reports match your filters' : 'No reports yet'}</div>
            <div className="srt-state-sub">{activeFilterCount > 0 ? 'Clear the filters to see every report.' : 'Submit your first report and it will appear here.'}</div>
            {activeFilterCount > 0 && <button className="srt-btn srt-btn-clear" onClick={clearFilters}><X size={13} /> Clear filters</button>}
          </div>
        )}

        {/* ---------- footer ---------- */}
        {sorted.length > 0 && (
          <div className="srt-footer">
            <span>
              Showing <b style={{ color: 'var(--srt-text)' }}>{start + 1}–{Math.min(start + pageSize, sorted.length)}</b> of <b style={{ color: 'var(--srt-text)' }}>{sorted.length}</b>
            </span>
            <div className="srt-pg">
              <select className="srt-pg-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} aria-label="Rows per page">
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
              <span style={{ margin: '0 6px' }}>Page {safePage + 1} of {pageCount}</span>
              <button className="srt-pg-btn" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <button className="srt-pg-btn" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {expandedId != null && (() => {
        const active = (reports || []).find((x) => x.id === expandedId);
        if (!active) return null;
        return (
          <>
            <div className="srt-overlay" onClick={() => setExpandedId(null)} />
            <DetailCard r={active} onClose={() => setExpandedId(null)} onView={() => onOpen?.(active)} />
          </>
        );
      })()}
    </div>
  );
}