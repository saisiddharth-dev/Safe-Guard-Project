# 🛡️ OIL SIF-Predict (Safe-Guard) — Safety Intelligence Platform

An enterprise **Serious Injury / Fatality (SIF) early-warning system** for oil & gas operations. Field workers, supervisors and HSE teams file safety reports — a multilingual AI engine classifies **SIF potential**, maps **Life-Saving Rules (LSR)**, extracts hazards/barriers, detects recurring patterns, and suggests corrective actions — all before an incident happens.

> **One-liner:** React single-page app → Bearer-token + RBAC/scope-guarded Express API → (a) MongoDB for data, (b) Cloudinary (with local-disk fallback) for media, (c) a Python FastAPI "AI Brain" for every AI feature — and if the AI Brain goes offline, a built-in Node keyword fallback engine keeps the platform running.

---

## ✨ Key Capabilities (Implemented Ideas)

### 🧠 AI Intelligence (Python FastAPI microservice — "AI Brain")
- **SIF classification** — critical-term scoring (energy isolation, confined space, H2S, line-of-fire, fatal, etc.) → `CRITICAL / HIGH / MEDIUM / LOW` risk + risk score + confidence.
- **Life-Saving Rule multi-label mapping** — 10 rules (Energy Isolation, Confined Space, Working at Height, Hot Work, Line of Fire, etc.) with confidence + built-in controls.
- **Structure extraction** — activity, hazards, barrier failures, potential consequences, root causes, location + **data-quality flags** (very short, missing activity/barrier/location).
- **Multilingual NLU** — detects and translates **हिंदी (Hindi), বাংলা (Bengali), অসমীয়া (Assamese), ଓଡ଼ିଆ (Odia/Oriya)** via dictionary + script-range detection.
- **Auto-review workflow** — `confidence ≥ 0.9 → auto_classified`, `≥ 0.7 → pending_review`, otherwise `mandatory_review`.
- **Similar-reports search** — TF-IDF + cosine similarity (duplicate/pattern detection).
- **Pattern detection** — groups reports by *activity × barrier-failure*, flags **EMERGING / RECURRING / TRACKING** trends and auto-generates alerts.
- **Safety Copilot NLU** — intent-parsing Q&A over live enterprise data (site risk density, activity rankings, contractor benchmarking, CAPA status, regional comparison, interventions, alerts, summaries) with action buttons.
- **Rule-based recommendations** — actionable suggested actions per LSR.
- **Feedback loop** — HSE corrections recorded to `ai_feedback` / `feedback.jsonl` for model evaluation.
- **Resilience** — AI Brain offline → Node-side `fallbackAnalyze()` keyword engine keeps everything working.

### 📝 Reporting & Inputs
- **Voice-to-text reports** via the browser **Web Speech API**.
- **OCR** of hazard photos via **Tesseract.js**, **PDF parsing** with PDF.js, **DOCX → text** with Mammoth.
- **Audio reports** stored & served back (`/api/reports/:id/audio`).
- **Offline-first**: reports are queued in browser **IndexedDB** and auto-synced when back online (idempotent via `client_report_id`, unique+sparse index on the server so duplicates can never occur).
- **Media storage** to Cloudinary with automatic **local-disk fallback** (`data/media`, `data/audio`) and range-supported serving.

### 🔐 Enterprise & Governance
- **Auth** — scrypt password hashing, 24h in-memory session tokens.
- **RBAC (7 roles)** — Administrator, Executive, Corporate HSE, Regional HSE, Site HSE, Supervisor, Worker — with role→module maps **plus per-user module overrides** (Admin toggles) and **site scoping** (Regional HSE → their region, Site HSE → their site).
- **Full audit trail** — every important action logged to `audit_log` (`/api/admin/audit`).
- **Demo data seeder** — ~130 realistic multilingual reports across 8 sites, users, contractors, assets, CAPA, investigations, alerts, knowledge, etc.

### 📊 Operational Modules (16 restricted functional modules)
| Module | Route | Purpose |
|--------|-------|---------|
| Command Center | `/` | KPI cards, SIF trend, barrier density, risk map, top risks |
| Analytics | `/analytics` | Precursors, activities, barriers, LSR, sites, heatmap, trends |
| Safety Reports | `/reports` | Create/view/voice/photo reports + AI classification |
| Notifications | `/alerts` | Active alerts + acknowledge |
| Safety Copilot | `/copilot` | AI chat over safety data |
| AI Intelligence | `/ai` | Analyze playground, model metrics, feedback |
| SIF Precursors | `/precursors` | Precursor patterns by activity/site |
| Life-Saving Rules | `/lsr` | LSR classification & controls |
| Risk Map | `/riskmap` | Geographic precursor density (Leaflet/OSM) |
| Sites & Assets | `/sites` | Site registry + asset inventory |
| Contractors | `/contractors` | Contractor scorecards |
| Investigations | `/investigations` | Incident investigation workflow |
| CAPA | `/capa` | Corrective / preventive action tracking |
| Inspections | `/inspections` | Site inspection checklists |
| Knowledge Base | `/knowledge` | HSE documents, lessons, courses |
| Administration | `/admin` | Users, RBAC module overrides, audit, model versions |

### 🎛️ Extras
- **What-If Simulator** — model the impact of a safety program on hypothetical incidents (coverage slider → projected risk-score / critical+high reduction).
- **i18n** — full UI in English, हिंदी, অসমীয়া, বাংলা, ଓଡ଼ିଆ.
- **Dark / light / system theming**, PWA-ready, Recharts dashboards, interactive Leaflet maps.

---

## 🏗️ Architecture Overview

```
Browser (React 18 SPA, Vite :5173)
      │  Authorization: Bearer <token>
      ▼
◇ AUTH + RBAC GATE◇   (login → scrypt verify → token → effectiveModules() → scopeSites())
      ▼
┌──────────────────────────────────────────────────────────────┐
│ EXPRESS API GATEWAY  (Node.js, :3000)                        │
│  • /api/* REST routes          • audit logging               │
│  • in-memory sessions (24h)    • AI proxy (/ai/*)            │
│  • static serve of frontend/dist                             │
│  • keyword fallback engine (when AI Brain is offline)        │
└───────┬──────────────────┬──────────────────────┬───────────┘
        ▼                  ▼                      ▼
   (💾 MongoDB)      (🌥️ Cloudinary)        (🧠 AI BRAIN, Python FastAPI :8050)
   oil_sif_intelligence   media CDN           /analyze /similar /patterns
   20+ collections       └→ local disk       /copilot /metrics /health /feedback
                          fallback            (data/media, data/audio)
```

See [`architecture.md`](architecture.md) for the full detailed flowcharts (Mermaid + ASCII).

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, react-router-dom v6, MUI + x-data-grid, Recharts, Leaflet, framer-motion, lucide-react |
| Backend | Node.js, Express 5, MongoDB (official driver), Cloudinary, dotenv |
| AI Engine | Python, FastAPI, Uvicorn (pure-NLP rule/keyword engine — no heavy model weight) |
| Client libs | Web Speech API, Tesseract.js, PDF.js, Mammoth, IndexedDB |
| Databases | MongoDB (`oil_sif_intelligence`), browser IndexedDB (`oil_sif_offline`) |
| Fonts | Google Fonts (Inter, Playfair Display, JetBrains Mono) |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** ≥ 18
- **Python** 3.9+
- **MongoDB** running on `localhost:27017` (or update `.env` for Atlas)

### 2. Install
```bash
# backend + AI engine (root)
npm install
pip install -r requirements.txt

# frontend
cd frontend
npm install
cd ..
```

### 3. Configure environment
```bash
cp .env.example .env
```
Key variables:
```env
PORT=3000
MONGO_URL=mongodb://localhost:27017
MONGO_DB=oil_sif_intelligence
AI_URL=http://127.0.0.1:8050
# Optional: Cloudinary (falls back to local disk if empty/failing)
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

### 4. Seed demo data
```bash
npm run seed
```
> Builds ~130 reports, users, 8 sites, contractors, assets, CAPA, investigations, alerts, knowledge docs, etc.

### 5. Run
```bash
# Terminal 1 — AI Brain (Python, :8050)
cd ai_engine && python -m uvicorn main:app --host 127.0.0.1 --port 8050 --reload
# (or run.bat on Windows)

# Terminal 2 — API Server (Node, :3000)
npm run dev        # or npm start

# Terminal 3 — Frontend (Vite, :5173)
cd frontend && npm run dev
```
Open **http://localhost:5173** and log in.

### Production build
```bash
cd frontend && npm run build   # → frontend/dist, served by Express at :3000
```

---

## 🔑 Demo Users (all password: `demo123`)

| Username | Role | Scope |
|----------|------|-------|
| `admin` | Administrator | Everything (except Knowledge Base) |
| `executive` | Executive | Dashboards & analytics only |
| `corp_hse` | Corporate HSE | Everything except Admin; all sites |
| `reg_hse_a` | Regional HSE | Everything except Admin; **Assam** sites |
| `reg_hse_r` | Regional HSE | Everything except Admin; **Rajasthan** sites |
| `site_hse_a` | Site HSE | Own site (Duliajan) |
| `site_hse_r` | Site HSE | Own site (Barmer) |
| `site_hse_o` | Site HSE | Own site (Paradeep, Odisha) |
| `supervisor` | Supervisor | Core ops modules (own site) |
| `worker` | Worker | Report-focused (own site) |

Sites in seed data: Duliajan, Nazira, Sivasagar, Jorhat, Cachar (Assam) · Barmer, Jaisalmer (Rajasthan) · Paradeep (Odisha).

---

## 📡 API Surface (key endpoints)

```
POST   /api/login                GET   /api/me                 GET  /api/health
GET    /api/dashboard            GET   /api/reports           POST  /api/reports
GET    /api/reports/:id          GET   /api/reports/:id/audio  GET  /api/reports/:id/similar
POST   /api/media                GET   /api/media/:key/file
POST   /api/ai/analyze           POST  /api/ai/similar        POST  /api/ai/feedback
GET    /api/ai/metrics           POST  /api/patterns          POST  /api/copilot
GET    /api/alerts               POST  /api/alerts/:id/ack
GET    /api/actions              POST  /api/actions           PATCH /api/actions/:id
GET    /api/analytics/{precursors,activities,barriers,lsr,sites,heatmap,trends}
GET/PO /api/contractors          GET   /api/investigations    POST  /api/investigations
GET    /api/interventions        GET   /api/inspections       GET   /api/courses
GET    /api/knowledge            GET   /api/lessons
GET    /api/sites                GET   /api/assets            GET   /api/notifications
GET    /api/admin/audit          GET/P /api/admin/users       POST  /api/admin/users/:id/modules
GET    /api/data-quality
```

---

## 🗄️ Data Model (MongoDB collections)

`users`, `user_modules`, `sites`, `assets`, `contractors`, `reports`, `lsr_predictions`, `actions`, `alerts`, `patterns`, `interventions`, `intervention_measures`, `investigations`, `inspections`, `knowledge_docs`, `lessons`, `courses`, `notifications`, `audit_log`, `ai_feedback`, `model_versions`, `media`, `counters`.

**Idempotency design:** unique + sparse index on `reports.client_report_id` — offline-queue re-syncs can never create duplicate reports.

---

## 📁 Directory Map

```
Safe-Guard-Project/
├── backend/
│   ├── server.js      → Express API + auth/RBAC + AI proxy + fallback engine + static serve
│   ├── db.js          → MongoDB data layer (all/get/run/update/agg/audit/…)
│   ├── media.js       → Cloudinary ∩ local-disk media storage
│   └── seed.js        → Demo data generator
├── ai_engine/
│   ├── main.py        → FastAPI "AI Brain" (port 8050)
│   ├── engine.py      → NLP core (SIF, LSR, extraction, patterns, copilot, similarity)
│   ├── lexicon.py     → Multilingual dicts + rule/hazard/activity keywords
│   └── test_brain.py  → Smoke test for the engine
├── frontend/
│   ├── index.html · vite.config.js · tailwind.config.js
│   └── src/
│       ├── App.jsx · main.jsx · api.js · AuthContext.jsx · ThemeContext.jsx · i18n.jsx
│       ├── pages/       → 16 module pages (CommandCenter, Reports, CAPA, …)
│       ├── components/  → UI kit, charts, SafetyReportsTable, WhatIfSimulator, maps
│       └── queue/       → IndexedDB offline sync engine
├── data/              → local media/audio fallback storage (runtime)
├── earth/             → decorative Earth imagery (login screen)
├── architecture.md    → Deep-dive architecture & flowcharts
└── package.json · requirements.txt
```

---

## 🧪 Testing / Verification
- **AI engine smoke test:**
  ```bash
  cd ai_engine && python test_brain.py
  ```
- **Health checks:**
  - Node API: `GET http://localhost:3000/api/health`
  - AI Brain: `GET http://localhost:8050/health`

---

## ⚙️ Ports & Configured Defaults

| Service | Tech | Port | Config |
|---------|------|------|--------|
| Web App (dev) | Vite | 5173 | proxy `/api` → `:3000` |
| API Server | Node/Express | 3000 | `PORT`, `AI_URL`, `MONGO_URL`, `MONGO_DB`, Cloudinary vars |
| AI Brain | Python/FastAPI | 8050 | `AI_URL` on backend |
| Database | MongoDB | 27017 | `MONGO_URL` / `MONGO_DB` |
| Media CDN | Cloudinary | external | optional; falls back to `data/media` |
| Map tiles | OpenStreetMap | external | — |

---

## 🔮 Ideas Worth Noting (already in the codebase)
- **Duplicate detection** on report submission (compares identical text → flagged `duplicate`).
- **AI feedback loop** from HSE reviewers.
- **Model version tracking** (`model_versions`, current `SIF-v2.4`).
- **Intervention effectiveness** (pre/post precursor-density measurement).
- **Data-quality scoring** flags for report text quality.

---

## 📄 License
Not specified — internal / educational project. See repo history for contributor info.

---

*Built for proactive, data-driven oil & gas safety — predict the injury before it happens.*