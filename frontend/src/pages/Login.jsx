import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useI18n, LANGUAGES } from '../i18n';

// Real seeded accounts (backend/seed.js) — credentials are NOT changed, all share demo123.
const LG_ROLES = [
  { u: 'admin', label: 'Administrator', role: 'ADMIN' },
  { u: 'executive', label: 'Executive / CXO', role: 'EXECUTIVE' },
  { u: 'corp_hse', label: 'Corporate HSE', role: 'CORP HSE' },
  { u: 'reg_hse_a', label: 'Regional HSE — Assam', role: 'REG HSE' },
  { u: 'site_hse_a', label: 'Site HSE — Duliajan', role: 'SITE HSE' },
  { u: 'supervisor', label: 'Field Supervisor', role: 'SUPERVISOR' },
  { u: 'worker', label: 'Field Worker', role: 'WORKER' },
];

const LG_CSS = `
.eff-login * { margin: 0; padding: 0; box-sizing: border-box; }
.eff-login { font-family: Inter, system-ui, sans-serif; }
.eff-login.login-overlay { position: fixed; inset: 0; z-index: 5000; overflow: hidden; transition: opacity 0.5s ease, visibility 0.5s ease; }

.eff-login .lg-nav { position: relative; z-index: 30; min-height: 70px; height: auto; display: flex; flex-wrap: wrap; align-items: center; padding: 0 28px; background: #ffffff; border-bottom: 1px solid rgba(15, 23, 42, 0.08); box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.07); }
.eff-login .lg-nav-left { display: flex; align-items: center; gap: 11px; animation: lgFadeScale 0.5s ease both; }
.eff-login .lg-nav-logo { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 0; }
.eff-login .lg-nav-brand { display: flex; flex-direction: column; line-height: 1.15; }
.eff-login .lg-nav-brand strong { font-size: 16px; font-weight: 700; letter-spacing: 0.3px; color: #1a1a1a; }
.eff-login .lg-nav-brand span { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 2px; }
.eff-login .lg-nav-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.eff-login .lg-lang select { appearance: none; -webkit-appearance: none; padding: 7px 28px 7px 12px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 999px; background-color: rgba(15, 23, 42, 0.04); background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>"); background-repeat: no-repeat; background-position: right 9px center; color: #1a1a1a; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; }
.eff-login .lg-lang select:hover { border-color: rgba(15, 23, 42, 0.24); background-color: rgba(15, 23, 42, 0.08); }
.eff-login .lg-lang select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15); }
.eff-login .lg-login-btn { padding: 10px 30px; border: 1px solid #0f172a; border-radius: 999px; background: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.22); transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease; }
.eff-login .lg-login-btn:hover { background: #2563eb; border-color: #2563eb; color: #ffffff; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35); transform: translateY(-1px); }
.eff-login .lg-login-btn:active { transform: translateY(0) scale(0.98); }
.eff-login .lg-hero { position: relative; z-index: 20; height: calc(100vh - 70px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 24px 30vh; }
.eff-login .lg-hero::before { content: ""; position: absolute; left: 50%; top: 38%; width: min(1100px, 90vw); height: 560px; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(37, 99, 235, 0.16) 0%, rgba(37, 99, 235, 0.07) 38%, transparent 68%); pointer-events: none; }
.eff-login .lg-eyebrow { position: relative; font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #1d4ed8; margin-bottom: 22px; animation: lgFadeUp 0.8s ease both; animation-delay: 100ms; }
.eff-login .lg-headline { position: relative; font-family: Georgia, "Times New Roman", serif; font-size: 128px; font-weight: 400; letter-spacing: 6px; line-height: 1; color: #0b1220; margin: 0; text-shadow: 0 14px 34px rgba(11, 18, 32, 0.22); animation: lgHeadlineIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 200ms; }
.eff-login .lg-divider { position: relative; display: block; width: 0; height: 2px; background: linear-gradient(90deg, #2563eb 0%, #0f172a 100%); margin: 26px auto 24px; animation: lgDividerIn 0.6s ease both; animation-delay: 500ms; }
.eff-login .lg-subtitle { position: relative; font-size: 14px; line-height: 1.7; color: #334155; max-width: 520px; margin: 0 auto 34px; animation: lgFadeUp 0.8s ease both; animation-delay: 700ms; }
.eff-login .lg-cta { position: relative; padding: 15px 36px; border: 1px solid #0f172a; border-radius: 999px; background: #0f172a; color: #ffffff; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; cursor: pointer; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.28); transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease; animation: lgFadeUp 0.8s ease both; animation-delay: 900ms; }
.eff-login .lg-cta:hover { background: #2563eb; border-color: #2563eb; color: #ffffff; box-shadow: 0 12px 30px rgba(37, 99, 235, 0.4); transform: translateY(-2px); }
.eff-login .lg-cta:active { transform: translateY(0); }
.eff-login .lg-side { position: absolute; top: 55%; z-index: 20; display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #1e293b; animation: lgFadeIn 0.8s ease both; animation-delay: 1100ms; }
.eff-login .lg-side-left { left: 7%; }
.eff-login .lg-side-right { right: 7%; }
.eff-login .lg-side-dot { width: 6px; height: 6px; border-radius: 50%; animation: lgSidePulse 3s ease-in-out infinite; }
.eff-login .lg-dot-red { background: #c8102e; box-shadow: 0 0 8px rgba(200, 16, 46, 0.4); }
.eff-login .lg-dot-amber { background: #ea580c; box-shadow: 0 0 8px rgba(234, 88, 12, 0.4); }
.eff-login .lg-earth-scene { position: absolute; left: 50%; bottom: -38vh; transform: translateX(-50%); width: min(880px, 62vw); pointer-events: none; z-index: 5; }
.eff-login .lg-atmos-glow { position: absolute; inset: -8%; border-radius: 50%; box-shadow: 0 0 60px 14px rgba(100, 175, 255, 0.35), 0 0 120px 40px rgba(70, 140, 255, 0.18), inset 0 0 40px 10px rgba(150, 210, 255, 0.5); background: radial-gradient(circle, rgba(120, 195, 255, 0.5) 0%, rgba(70, 140, 255, 0.16) 55%, transparent 78%); filter: blur(8px); animation: lgAtmosBreathe 6s ease-in-out infinite; }
.eff-login .lg-earth { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 30% 26%, #a9d4f6 0%, #5b9add 20%, #3473bb 42%, #1d5299 66%, #10336e 100%); box-shadow: inset 8px 10px 34px rgba(255, 255, 255, 0.22), inset -20px -16px 44px rgba(4, 16, 40, 0.65), inset 0 0 64px rgba(90, 170, 255, 0.28), 0 40px 84px rgba(30, 80, 190, 0.32), 0 12px 34px rgba(15, 23, 42, 0.2); }
.eff-login .lg-earth::before { content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; box-shadow: inset 2px -2px 6px rgba(160, 216, 255, 0.5), inset -4px 4px 10px rgba(8, 26, 60, 0.55); }
.eff-login .lg-earth::after { content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(circle at 24% 20%, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.12) 28%, rgba(255, 255, 255, 0) 52%), linear-gradient(122deg, rgba(70, 130, 240, 0.1) 0%, rgba(148, 202, 255, 0.14) 22%, rgba(255, 158, 84, 0.22) 36%, rgba(255, 96, 60, 0.18) 42%, rgba(13, 27, 58, 0.16) 47%, rgba(6, 16, 40, 0.62) 70%, rgba(2, 7, 24, 0.94) 100%); }
.eff-login .lg-day-rotor, .eff-login .lg-lights-rotor, .eff-login .lg-cloud-rotor { position: absolute; inset: 0; display: flex; width: 400%; will-change: transform; }
.eff-login .lg-day-rotor { animation: lgEarthSpin 70s linear infinite; }
.eff-login .lg-lights-rotor { animation: lgEarthSpin 70s linear infinite; mix-blend-mode: screen; -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 18%, rgba(0, 0, 0, 0.55) 34%, #000 56%, #000 100%); mask-image: linear-gradient(to right, transparent 0%, transparent 18%, rgba(0, 0, 0, 0.55) 34%, #000 56%, #000 100%); }
.eff-login .lg-cloud-rotor { animation: lgCloudSpin 95s linear infinite reverse; }
.eff-login .lg-tex-copy { width: 50%; height: 100%; flex-shrink: 0; background-repeat: repeat-x; background-size: auto 100%; background-position: 0 50%; }
.eff-login .lg-earth-day { background-image: url(/earth/earth_day.jpg); }
.eff-login .lg-earth-lights { background-image: url(/earth/earth_lights.png); }
.eff-login .lg-earth-clouds { background-image: url(/earth/earth_clouds.png); }
.eff-login .lg-earth-noise { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 50%; pointer-events: none; mix-blend-mode: overlay; opacity: 0.65; }
.eff-login .lg-orbit { position: absolute; left: 50%; top: 50%; width: 172%; height: 172%; transform: translate(-50%, -50%); border: 1px solid rgba(37, 99, 235, 0.22); border-radius: 50%; animation: lgOrbitTurn 40s linear infinite; }
.eff-login .lg-satellite { position: absolute; top: -4px; left: 50%; width: 8px; height: 8px; border-radius: 50%; background: #ea580c; box-shadow: 0 0 10px rgba(234, 88, 12, 0.85), 0 0 4px rgba(234, 88, 12, 0.9); }
.eff-login .lg-card-modal { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 23, 42, 0.35); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); opacity: 0; pointer-events: none; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease; }
.eff-login .lg-card-modal.open { opacity: 1; pointer-events: auto; visibility: visible; }
.eff-login .lg-card { width: 100%; max-width: 420px; max-height: calc(100vh - 48px); overflow-y: auto; overscroll-behavior: contain; position: relative; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(96, 165, 250, 0.28); border-radius: 22px; backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 30px 90px rgba(15, 23, 42, 0.55), 0 0 40px rgba(37, 99, 235, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08); padding: 36px 34px 28px; box-sizing: border-box; transform: scale(0.98); transition: box-shadow 0.3s ease; animation: lgCardIn 0.35s ease both; }
.eff-login .lg-card::-webkit-scrollbar { width: 7px; }
.eff-login .lg-card::-webkit-scrollbar-thumb { background: rgba(96, 165, 250, 0.3); border-radius: 5px; }
.eff-login .lg-card::before { content: ""; position: absolute; inset: 0; border-radius: 22px; pointer-events: none; background: linear-gradient(150deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 65%); }
.eff-login .lg-card-close { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 9px; background: rgba(15, 23, 42, 0.4); color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2; transition: background 0.15s ease, color 0.15s ease; }
.eff-login .lg-card-close:hover { background: rgba(51, 65, 85, 0.8); color: #ffffff; }
.eff-login .lg-card-header { text-align: center; margin-bottom: 26px; }
.eff-login .lg-logo-3d { position: relative; width: 80px; height: 80px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
.eff-login .lg-oil-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(249, 115, 22, 0.85); box-shadow: 0 0 18px rgba(249, 115, 22, 0.35), inset 0 0 12px rgba(249, 115, 22, 0.25); animation: lgRingPulse 3.2s ease-in-out infinite; }
.eff-login .lg-oil-drop { width: 58px; height: 58px; position: relative; z-index: 2; filter: drop-shadow(0 10px 20px rgba(37, 99, 235, 0.5)); animation: lgDropBob 4.5s ease-in-out infinite; }
.eff-login .lg-card-header h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; margin: 0 0 7px; }
.eff-login .lg-card-header p { font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0 auto; max-width: 280px; }
.eff-login .lg-form { display: flex; flex-direction: column; gap: 15px; }
.eff-login .lg-field label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; color: #cbd5e1; margin-bottom: 7px; }
.eff-login .lg-field select { width: 100%; padding: 13px 36px 13px 14px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 12px; background-color: rgba(15, 23, 42, 0.45); background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>"); background-repeat: no-repeat; background-position: right 14px center; color: #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; }
.eff-login .lg-field select option { background: #1e293b; color: #e2e8f0; }
.eff-login .lg-field select:hover { border-color: rgba(148, 163, 184, 0.4); background-color: rgba(15, 23, 42, 0.62); }
.eff-login .lg-field select:focus { border-color: rgba(96, 165, 250, 0.75); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25), 0 0 18px rgba(37, 99, 235, 0.18); }
.eff-login .lg-input { position: relative; display: flex; align-items: center; }
.eff-login .lg-input-icon { position: absolute; left: 14px; width: 17px; height: 17px; color: #64748b; pointer-events: none; z-index: 1; transition: color 0.2s ease; }
.eff-login .lg-field input { width: 100%; padding: 13px 14px 13px 43px; border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 12px; background: rgba(15, 23, 42, 0.45); color: #e2e8f0; font-size: 14px; font-family: inherit; outline: none; box-sizing: border-box; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }
.eff-login .lg-field input::placeholder { color: #64748b; }
.eff-login .lg-field input:hover { border-color: rgba(148, 163, 184, 0.4); background: rgba(15, 23, 42, 0.62); }
.eff-login .lg-field input:focus { border-color: rgba(96, 165, 250, 0.75); background: rgba(15, 23, 42, 0.7); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25), 0 0 18px rgba(37, 99, 235, 0.18); }
.eff-login .lg-field:focus-within .lg-input-icon { color: #60a5fa; }
.eff-login .login-btn { width: 100%; padding: 14px; border: none; border-radius: 12px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; font-size: 14px; font-weight: 700; letter-spacing: 0.4px; cursor: pointer; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 4px; box-shadow: 0 8px 22px rgba(29, 78, 216, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2); transition: transform 0.18s ease, box-shadow 0.25s ease, filter 0.2s ease; }
.eff-login .login-btn::after { content: ""; position: absolute; top: 0; left: -120%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent); transform: skewX(-20deg); transition: left 0.5s ease; }
.eff-login .login-btn:hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 14px 32px rgba(29, 78, 216, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
.eff-login .login-btn:hover::after { left: 180%; }
.eff-login .login-btn:active { transform: translateY(0) scale(0.985); }
.eff-login .login-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
.eff-login .login-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.28); border-top-color: #ffffff; border-radius: 50%; animation: lgSpin 0.6s linear infinite; }
.eff-login .login-error { padding: 11px 13px; background: rgba(220, 38, 38, 0.14); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35); border-left: 4px solid #ef4444; border-radius: 10px; font-size: 12px; font-weight: 600; animation: lgShake 0.4s ease; }
.eff-login .lg-demo { margin-top: 22px; padding-top: 20px; border-top: 1px solid rgba(148, 163, 184, 0.12); }
.eff-login .lg-demo-title { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #64748b; text-align: center; margin-bottom: 12px; }
.eff-login .login-demo-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 6px; border-radius: 9px; cursor: pointer; background: rgba(15, 23, 42, 0.35); border: 1px solid transparent; transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
.eff-login .login-demo-row:hover { background: rgba(37, 99, 235, 0.12); border-color: rgba(96, 165, 250, 0.25); transform: translateX(3px); }
.eff-login .lg-demo-user { font-size: 12px; font-weight: 700; color: #e2e8f0; min-width: 44px; }
.eff-login .login-demo-row code { background: rgba(30, 41, 59, 0.8); color: #93c5fd; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.eff-login .lg-demo-role { margin-left: auto; font-size: 9px; font-weight: 800; letter-spacing: 0.6px; color: #93c5fd; padding: 3px 6px; border-radius: 5px; background: rgba(37, 99, 235, 0.18); }
.eff-login .lg-particles { position: absolute; inset: 0; }
.eff-login .lg-particle { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(37, 99, 235, 0.9) 0%, rgba(96, 165, 250, 0.4) 60%, transparent 85%); box-shadow: 0 0 6px rgba(37, 99, 235, 0.35); animation: lgParticleFloat linear infinite; will-change: transform, opacity; }

@keyframes lgFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes lgFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lgFadeScale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes lgHeadlineIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
@keyframes lgDividerIn { from { width: 0; } to { width: 40px; } }
@keyframes lgSidePulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes lgAtmosBreathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
@keyframes lgEarthSpin { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes lgCloudSpin { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes lgOrbitTurn { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes lgCardIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(0.98); } }
@keyframes lgRingPulse { 0%, 100% { transform: scale(0.78); opacity: 0.35; } 50% { transform: scale(1.2); opacity: 0.95; } }
@keyframes lgDropBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes lgSpin { to { transform: rotate(360deg); } }
@keyframes lgShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } }
@keyframes lgParticleFloat { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 10% { opacity: 0.75; } 50% { transform: translate3d(20px, -70px, 0); opacity: 0.45; } 85% { opacity: 0.35; } 100% { transform: translate3d(-12px, -150px, 0); opacity: 0; } }

[dir="rtl"] .eff-login .lg-lang select { padding-right: 12px; padding-left: 28px; background-position: left 9px center; }
[dir="rtl"] .eff-login .lg-field select { padding-right: 14px; padding-left: 36px; background-position: left 14px center; }
[dir="rtl"] .eff-login .lg-side-left { left: auto; right: 32px; }
[dir="rtl"] .eff-login .lg-side-right { right: auto; left: 32px; }
[dir="rtl"] .eff-login .lg-field input { padding: 13px 43px 13px 14px; }
[dir="rtl"] .eff-login .lg-input-icon { left: auto; right: 14px; }

@media (max-width: 1200px) { .eff-login .lg-headline { font-size: 110px; } .eff-login .lg-earth-scene { width: 70vw; bottom: -34vh; } }
@media (max-width: 900px) { .eff-login .lg-side { display: none; } .eff-login .lg-headline { font-size: 96px; } }
@media (max-width: 600px) { .eff-login .lg-nav { padding: 10px 18px; row-gap: 8px; column-gap: 10px; } .eff-login .lg-hero { height: calc(100vh - 120px); } .eff-login .lg-lang select { min-height: 44px; } .eff-login .lg-login-btn { min-height: 44px; display: inline-flex; align-items: center; } .eff-login .lg-card-close { width: 44px; height: 44px; top: 8px; right: 8px; } .eff-login .login-demo-row { min-height: 44px; } .eff-login .lg-headline { font-size: 72px; letter-spacing: 4px; } .eff-login .lg-hero { padding: 30px 18px 30vh; } .eff-login .lg-eyebrow { letter-spacing: 3px; } .eff-login .lg-earth-scene { width: 90vw; bottom: -36vh; } .eff-login .lg-card { padding: 30px 22px 24px; } }
@media (max-width: 420px) { .eff-login .lg-headline { font-size: 64px; letter-spacing: 3px; } .eff-login .lg-subtitle { font-size: 13px; } .eff-login .lg-nav-brand span { display: none; } }

@media (prefers-reduced-motion: reduce) {
  .eff-login .lg-cloud-rotor, .eff-login .lg-orbit, .eff-login .lg-atmos-glow, .eff-login .lg-oil-drop, .eff-login .lg-oil-ring, .eff-login .lg-side-dot, .eff-login .lg-satellite, .eff-login .lg-particle { animation: none !important; }
  .eff-login .lg-eyebrow, .eff-login .lg-headline, .eff-login .lg-divider, .eff-login .lg-subtitle, .eff-login .lg-cta, .eff-login .lg-side, .eff-login .lg-nav-left, .eff-login .lg-card { animation: none !important; }
}

@keyframes lgBlueprintDrift { from { transform: translateX(0); } to { transform: translateX(-40px); } }
`;

const LG_BP = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"560\" height=\"360\" viewBox=\"0 0 560 360\"><g fill=\"none\" stroke=\"%232563eb\" stroke-opacity=\"0.5\" stroke-width=\"1.2\"><path d=\"M60 90 a34 28 0 1 0 0.1 0\"/><circle cx=\"80\" cy=\"100\" r=\"30\"/><rect x=\"55\" y=\"62\" width=\"50\" height=\"14\" rx=\"5\"/></g><g fill=\"none\" stroke=\"%230f172a\" stroke-opacity=\"0.4\" stroke-width=\"1.1\"><path d=\"M320 40 L380 60 L340 120 L280 100 Z\"/><path d=\"M330 52 L360 70 L342 102\"/></g><g fill=\"none\" stroke=\"%23ea580c\" stroke-opacity=\"0.35\" stroke-width=\"1\"><path d=\"M470 210 l60 28 -30 50 -60 -28 Z\"/><path d=\"M170 260 a30 24 0 1 0 0.1 0\"/><rect x=\"145\" y=\"234\" width=\"50\" height=\"14\" rx=\"6\"/></g><g fill=\"none\" stroke=\"%231e40af\" stroke-opacity=\"0.28\" stroke-width=\"1.1\"><path d=\"M420 120 C440 100 470 110 480 130 C470 150 440 150 430 135 Z\"/><rect x=\"400\" y=\"90\" width=\"40\" height=\"10\" rx=\"5\"/></g></svg>')";

const LG_BG = "radial-gradient(circle at 50% 108%, rgba(37, 99, 235, 0.28) 0%, rgba(37, 99, 235, 0.12) 34%, transparent 62%), linear-gradient(180deg, #eef2f9 0%, #dde6f4 42%, #c8d8ee 100%)";

export default function Login() {
  const { login } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    let t1, t2;
    t1 = setTimeout(() => setOpen(true), 700);
    const container = document.getElementById('lg-particles');
    if (container) {
      const COUNT = 42;
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < COUNT; i++) {
        const dot = document.createElement('span');
        dot.className = 'lg-particle';
        const size = Math.random() * 3 + 1.5;
        const duration = Math.random() * 12 + 10;
        dot.style.left = Math.random() * 100 + '%';
        dot.style.top = Math.random() * 100 + '%';
        dot.style.width = size.toFixed(1) + 'px';
        dot.style.height = size.toFixed(1) + 'px';
        dot.style.animationDuration = duration.toFixed(1) + 's';
        dot.style.animationDelay = (-(Math.random() * duration)).toFixed(1) + 's';
        fragment.appendChild(dot);
      }
      container.appendChild(fragment);
    }
    return () => { clearTimeout(t1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const ft = setTimeout(() => userRef.current && userRef.current.focus({ preventScroll: true }), 250);
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setError(''); } };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(ft);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => { setOpen(false); setError(''); };

  const flashFill = (el) => {
    if (!el) return;
    el.style.borderColor = '#16a34a';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
  };

  const fillUser = (u, p) => {
    setUsername(u); setPassword(p);
    const ue = document.getElementById('login-username');
    const pe = document.getElementById('login-password');
    flashFill(ue); flashFill(pe);
    if (pe) setTimeout(() => pe.focus(), 50);
  };

  const submit = async (e) => {
    e.preventDefault();
    const u = username.trim();
    const p = password;
    if (!u || !p) return;
    setError(''); setBusy(true);
    try {
      await login(u, p);
    } catch (err) {
      setError(err && err.message === 'unauthorized' ? t('Invalid username or password') : (err.message || 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{LG_CSS}</style>

      <div
        className="eff-login login-overlay"
        style={{ background: LG_BG }}
      >
        <div className="lg-land" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute', inset: -40,
              backgroundImage: LG_BP,
              backgroundRepeat: 'repeat', backgroundSize: '560px 360px', opacity: 0.09,
              animation: 'lgBlueprintDrift 60s ease-in-out infinite alternate',
            }}
          />
          <div className="lg-particles" id="lg-particles" />
        </div>

        <header className="lg-nav">
          <div className="lg-nav-left">
            <div className="lg-nav-logo">
              <svg viewBox="0 0 48 48" width="32" height="32">
                <defs>
                  <linearGradient id="lgNavOil" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="55%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                </defs>
                <path d="M24 2 C24 2 42 22 42 33 C42 42.5 34 47 24 47 C14 47 6 42.5 6 33 C6 22 24 2 24 2 Z" fill="url(#lgNavOil)" />
                <ellipse cx="16.5" cy="25" rx="6.5" ry="3.6" fill="rgba(255,255,255,0.45)" transform="rotate(-25 16.5 25)" />
              </svg>
            </div>
            <div className="lg-nav-brand">
              <strong>OIL SIF-Predict</strong>
              <span>{t('Safety Intelligence')}</span>
            </div>
          </div>

          <div className="lg-nav-right">
            <div className="lg-lang">
              <select
                id="lang-select"
                aria-label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <button type="button" className="lg-login-btn" onClick={() => setOpen(true)}>
              <span>{t('Login')}</span>
            </button>
          </div>
        </header>

        <main className="lg-hero">
          <span className="lg-eyebrow">{t('Safety Intelligence')}</span>
          <h1 className="lg-headline">{t('SAFETY')}</h1>
          <span className="lg-divider" />
          <p className="lg-subtitle">{t('Learn how OIL SIF-Predict turns unstructured safety observations into actionable Serious Injury & Fatality intelligence. Early detection today prevents incidents tomorrow — don’t miss a precursor.')}</p>
          <button type="button" className="lg-cta" onClick={() => setOpen(true)}>
            {t('Get Started')}
          </button>
        </main>

        <div className="lg-side lg-side-left" aria-hidden="true">
          <span className="lg-side-dot lg-dot-red" />
          <span className="lg-side-word">{t('Prevention')}</span>
        </div>
        <div className="lg-side lg-side-right" aria-hidden="true">
          <span className="lg-side-word">{t('Response')}</span>
          <span className="lg-side-dot lg-dot-amber" />
        </div>

        <div className="lg-earth-scene" aria-hidden="true">
          <div className="lg-atmos-glow" />
          <div className="lg-earth">
            <div className="lg-day-rotor">
              <span className="lg-tex-copy lg-earth-day" />
              <span className="lg-tex-copy lg-earth-day" />
            </div>
            <div className="lg-lights-rotor">
              <span className="lg-tex-copy lg-earth-lights" />
              <span className="lg-tex-copy lg-earth-lights" />
            </div>
            <div className="lg-cloud-rotor">
              <span className="lg-tex-copy lg-earth-clouds" />
              <span className="lg-tex-copy lg-earth-clouds" />
            </div>
            <div className="lg-earth-noise" />
          </div>
          <div className="lg-orbit">
            <span className="lg-satellite" />
          </div>
        </div>

        <div className={`lg-card-modal${open ? ' open' : ''}`} id="lg-card-modal">
        <div className="lg-card" id="login-card">
          <button type="button" className="lg-card-close" onClick={close} aria-label={t('Close')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="lg-card-header">
            <div className="lg-logo-3d">
              <div className="lg-oil-ring" />
              <svg className="lg-oil-drop" viewBox="0 0 48 48">
                <defs>
                  <linearGradient id="lgOilGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                </defs>
                <path d="M24 3 C24 3 41 21.5 41 32 C41 41.4 33.4 46 24 46 C14.6 46 7 41.4 7 32 C7 21.5 24 3 24 3 Z" fill="url(#lgOilGrad)" />
                <ellipse cx="17" cy="25" rx="6" ry="3.4" fill="rgba(255,255,255,0.4)" transform="rotate(-25 17 25)" />
              </svg>
            </div>
            <h1>OIL SIF-Predict</h1>
            <p>{t('Serious Injury & Fatality Intelligence Platform')}</p>
          </div>

          <form id="login-form" className="lg-form" onSubmit={submit}>
            <div className="lg-field">
              <label htmlFor="login-role">{t('Sign in as')}</label>
              <select
                id="login-role"
                defaultValue=""
                onChange={(e) => { const d = LG_ROLES.find((r) => r.u === e.target.value); if (d) fillUser(d.u, 'demo123'); }}
              >
                <option value="">{t('Select your role')}</option>
                {LG_ROLES.map((r) => (
                  <option key={r.u} value={r.u}>{t(r.label)}</option>
                ))}
              </select>
            </div>

            <div className="lg-field">
              <label htmlFor="login-username">{t('Username')}</label>
              <div className="lg-input">
                <svg className="lg-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  id="login-username"
                  ref={userRef}
                  autoComplete="username"
                  placeholder={t('Enter username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="lg-field">
              <label htmlFor="login-password">{t('Password')}</label>
              <div className="lg-input">
                <svg className="lg-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type="password"
                  id="login-password"
                  autoComplete="current-password"
                  placeholder={t('Enter password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div id="login-error" className="login-error" style={{ display: error ? 'block' : 'none' }}>
              {error}
            </div>

            <button type="submit" className="login-btn" id="login-submit" disabled={busy}>
              <span className="login-btn-text">{busy ? '\u00A0' : t('Sign In')}</span>
              {busy && (
                <span className="login-btn-loader" style={{ display: 'inline-flex' }}>
                  <span className="login-spinner" />
                </span>
              )}
            </button>

            <div className="lg-demo">
              <span className="lg-demo-title">{t('Demo accounts (click to fill)')}</span>
              {LG_ROLES.map((r) => (
                <div key={r.u} className="login-demo-row" data-user={r.u} data-pass="demo123" onClick={() => fillUser(r.u, 'demo123')}>
                  <span className="lg-demo-user">{t(r.label)}</span>
                  <code>{r.u} / demo123</code>
                  <span className="lg-demo-role">{r.role}</span>
                </div>
              ))}
            </div>
          </form>
        </div>
      </div>
      </div>
    </>
  );
}