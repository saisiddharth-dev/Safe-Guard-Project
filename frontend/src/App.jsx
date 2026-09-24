import { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Brain, Target, Shield, Map as MapIcon, Factory,
  HardHat, SearchX, ClipboardCheck, ClipboardList, BookOpen,
  BarChart3, MessageSquareText, Bell, Settings2, Menu, LogOut, ChevronDown,
  AlertTriangle, X, ChevronRight, Lock, Fuel, Sun, Moon,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useI18n } from './i18n';
import { useTheme } from './ThemeContext';
import { startSyncEngine } from './queue/offlineQueue';
import Login from './pages/Login';
import CommandCenter from './pages/CommandCenter';
import Reports from './pages/Reports';
import AIIntelligence from './pages/AIIntelligence';
import SIFPrecursors from './pages/SIFPrecursors';
import LifeSavingRules from './pages/LifeSavingRules';
import RiskMap from './pages/RiskMap';
import Sites from './pages/Sites';
import Contractors from './pages/Contractors';
import Investigations from './pages/Investigations';
import CAPA from './pages/CAPA';
import Inspections from './pages/Inspections';
import Knowledge from './pages/Knowledge';
import Analytics from './pages/Analytics';
import Copilot from './pages/Copilot';
import AlertsPage from './pages/Alerts';
import Admin from './pages/Admin';

const NAV = [
  { section: 'Operations', items: [
    { to: '/', label: 'Command Center', icon: LayoutDashboard, end: true, module: 'commandcenter' },
    { to: '/analytics', label: 'Analytics', icon: BarChart3, module: 'analytics' },
    { to: '/reports', label: 'Safety Reports', icon: FileText, module: 'reports' },
    { to: '/alerts', label: 'Notifications', icon: Bell, module: 'alerts' },
    { to: '/copilot', label: 'Safety Copilot', icon: MessageSquareText, module: 'copilot' },
  ]},
  { section: 'Intelligence', items: [
    { to: '/ai', label: 'AI Intelligence', icon: Brain, module: 'ai' },
    { to: '/precursors', label: 'SIF Precursors', icon: Target, module: 'precursors' },
    { to: '/lsr', label: 'Life-Saving Rules', icon: Shield, module: 'lsr' },
    { to: '/riskmap', label: 'Risk Map', icon: MapIcon, module: 'riskmap' },
  ]},
  { section: 'Enterprise', items: [
    { to: '/sites', label: 'Sites & Assets', icon: Factory, module: 'sites' },
    { to: '/contractors', label: 'Contractors', icon: HardHat, module: 'contractors' },
    { to: '/investigations', label: 'Investigations', icon: SearchX, module: 'investigations' },
    { to: '/capa', label: 'CAPA', icon: ClipboardCheck, module: 'capa' },
    { to: '/inspections', label: 'Inspections', icon: ClipboardList, module: 'inspections' },
    { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen, module: 'knowledge' },
  ]},
  { section: 'Insight', items: [
    { to: '/admin', label: 'Administration', icon: Settings2, module: 'admin' },
  ]},
];

// Route path -> module key mapping (admin is the only default holder of `admin`)
const VIEWS = {
  '/': 'commandcenter', '/reports': 'reports', '/alerts': 'alerts', '/copilot': 'copilot',
  '/ai': 'ai', '/precursors': 'precursors', '/lsr': 'lsr', '/riskmap': 'riskmap',
  '/sites': 'sites', '/contractors': 'contractors', '/investigations': 'investigations',
  '/capa': 'capa', '/inspections': 'inspections', '/knowledge': 'knowledge',
  '/analytics': 'analytics', '/admin': 'admin',
};

// modules are only known after login/me; until then keep the core visible
function moduleList(user) {
  return user?.modules && user.modules.length ? user.modules : ['commandcenter', 'reports'];
}

const ROLE_TAG = {
  Administrator: 'Admin', Executive: 'CXO', 'Corporate HSE': 'Corp HSE',
  'Regional HSE': 'Reg HSE', 'Site HSE': 'Site HSE', Supervisor: 'Supervisor', Worker: 'Worker',
};

const MODULE_LABEL = {
  commandcenter: 'Command Center', analytics: 'Analytics', reports: 'Safety Reports',
  alerts: 'Notifications', copilot: 'Safety Copilot', ai: 'AI Intelligence',
  precursors: 'SIF Precursors', lsr: 'Life-Saving Rules', riskmap: 'Risk Map',
  sites: 'Sites & Assets', contractors: 'Contractors', investigations: 'Investigations',
  capa: 'CAPA', inspections: 'Inspections', knowledge: 'Knowledge Base', admin: 'Administration',
};

function ProfileMenu({ user, onLogout, onClose }) {
  const { t } = useI18n();
  const { theme, isDark, setMode, mode } = useTheme();
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const themes = [
    { key: 'light', label: t('Light'), active: theme === 'light' && mode !== 'system' },
    { key: 'dark', label: t('Dark'), active: theme === 'dark' && mode !== 'system' },
    { key: 'system', label: t('System'), active: mode === 'system' },
  ];

  return (
    <div
      ref={ref}
      className="absolute bottom-[calc(100%+8px)] left-3 right-3 z-50 overflow-hidden rounded-xl border border-navy-600 bg-navy-850 shadow-2xl shadow-black/40 fade-up"
      role="menu"
    >
      <div className="flex items-center gap-2.5 border-b border-navy-700 px-3.5 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {(user?.full_name || user?.username || 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white">{user?.full_name || user?.username}</div>
          <div className="text-[10px] text-slate-400">{t(ROLE_TAG[user?.role] || user?.role)}</div>
        </div>
      </div>

      <div className="px-3.5 pb-1 pt-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {isDark ? <Moon size={11} className="text-slate-400" /> : <Sun size={11} className="text-slate-400" />}
          {t('Theme')}
        </div>
        <div className="flex gap-1 rounded-lg border border-navy-600 bg-navy-900 p-1">
          {themes.map((th) => (
            <button
              key={th.key}
              role="menuitemradio"
              aria-checked={th.active}
              onClick={() => setMode(th.key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                th.active
                  ? 'bg-brand text-white shadow'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {th.label}
            </button>
          ))}
        </div>
      </div>

      <div className="my-2 h-px bg-navy-700" />

      <button
        onClick={onLogout}
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-red-400"
      >
        <LogOut size={14} />
        {t('Logout')}
      </button>
    </div>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const modules = new Set(moduleList(user));
  const groups = NAV
    .map((group) => ({ ...group, items: group.items.filter((it) => modules.has(it.module)) }))
    .filter((group) => group.items.length);

  useEffect(() => { startSyncEngine(); }, []);

  // Lock background scroll while the mobile nav drawer is open so the fixed
  // sidebar only ever slides over a frozen page. Restored on close/unmount.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className={`navy-shell fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-navy-700 bg-navy-900/95 backdrop-blur transition-transform lg:relative lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-navy-700 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-cyan-500 text-white"><Fuel size={22} /></div>
          <div>
            <div className="text-sm font-extrabold leading-tight text-white">{t('OIL-SIF Intelligence')}</div>
            <div className="text-[10px] font-medium text-slate-400">{t('SIF Early-Warning Platform')}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group.section} className="mb-4">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t(group.section)}</div>
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    style={{ animationDelay: `${idx * 40}ms` }}
                    className={({ isActive }) =>
                      `nav-item nav-link mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold ${
                        isActive ? 'bg-brand/15 text-white shadow-[inset_2px_0_0_0_#2f7cf6]' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={16} className="nav-ico" />
                    <span>{t(item.label)}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="relative border-t border-navy-700 p-3">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
              {(user?.full_name || user?.username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-semibold text-white">{user?.full_name || user?.username}</div>
              <div className="text-[11px] text-slate-400">{t(ROLE_TAG[user?.role] || user?.role)}</div>
            </div>
            <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>
          {profileOpen && <ProfileMenu user={user} onLogout={logout} onClose={() => setProfileOpen(false)} />}
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="navy-shell sticky top-0 z-20 flex items-center gap-2 border-b border-navy-700 bg-navy-900/90 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setOpen(!open)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="pulse-dot absolute inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-400 sm:inline">{t('Intelligence Live')}</span>
          </div>
          <span className="min-w-0 truncate text-sm font-extrabold text-white sm:hidden">{t('OIL-SIF Intelligence')}</span>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <AIBanner />
            <span className="chip border border-navy-600 bg-navy-800 text-slate-300">v2.4</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-3 sm:p-4 lg:p-6"><OutletInner /></main>
      </div>
    </div>
  );
}

function AIBanner() {
  const { t } = useI18n();
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 sm:flex">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t('AI BRAIN ONLINE')}
    </span>
  );
}

function AccessDenied({ module }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
          <Lock size={26} />
        </div>
        <h2 className="mb-1 text-lg font-extrabold text-white">{t('Access Restricted')}</h2>
        <p className="mb-4 text-sm text-slate-400">
          {t('Your role does not grant access to')} <span className="font-semibold text-slate-300">{t(MODULE_LABEL[module] || module)}</span>.
          {t('Access is controlled by your administrator.')}
        </p>
        <NavLink to="/" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
          <LayoutDashboard size={15} /> {t('Go to Command Center')}
        </NavLink>
      </div>
    </div>
  );
}

function Guard({ module, children }) {
  const { user } = useAuth();
  if (!moduleList(user).includes(module)) return <AccessDenied module={VIEWS[module] || module} />;
  return children;
}

function OutletInner() {
  return (
    <Routes>
      <Route path="/" element={<Guard module="commandcenter"><CommandCenter /></Guard>} />
      <Route path="/reports/*" element={<Guard module="reports"><Reports /></Guard>} />
      <Route path="/ai" element={<Guard module="ai"><AIIntelligence /></Guard>} />
      <Route path="/precursors" element={<Guard module="precursors"><SIFPrecursors /></Guard>} />
      <Route path="/lsr" element={<Guard module="lsr"><LifeSavingRules /></Guard>} />
      <Route path="/riskmap" element={<Guard module="riskmap"><RiskMap /></Guard>} />
      <Route path="/sites" element={<Guard module="sites"><Sites /></Guard>} />
      <Route path="/contractors" element={<Guard module="contractors"><Contractors /></Guard>} />
      <Route path="/investigations" element={<Guard module="investigations"><Investigations /></Guard>} />
      <Route path="/capa" element={<Guard module="capa"><CAPA /></Guard>} />
      <Route path="/inspections" element={<Guard module="inspections"><Inspections /></Guard>} />
      <Route path="/knowledge" element={<Guard module="knowledge"><Knowledge /></Guard>} />
      <Route path="/analytics" element={<Guard module="analytics"><Analytics /></Guard>} />
      <Route path="/copilot" element={<Guard module="copilot"><Copilot /></Guard>} />
      <Route path="/alerts" element={<Guard module="alerts"><AlertsPage /></Guard>} />
      <Route path="/admin" element={<Guard module="admin"><Admin /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return <Shell />;
}