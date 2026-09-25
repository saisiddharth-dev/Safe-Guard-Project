# 🏗️ Architecture — OIL SIF-Predict (Safe-Guard) Intelligence Platform

Platform ka focused view: **bands ke liye Serious Injury / Fatality (SIF) pata lagane wala early-warning system**.
Yeh document poori architecture ke bare me hai — client, web app, authentication + restricted modules, server, database, Cloudinary image storage, saare 3rd-party services aur saari AI services.

---

## 1) 📐 Flow Chart Symbols (Legend)

Har diagram me ye symbols use honge — ye standard flowchart notation hai:

| Symbol | Meaning |
|--------|---------|
| `[ Box ]` | **Process / Component** (app, service, module) |
| `( Cylinder )` | **Database / Data store** |
| `◇ Decision ◇` | **Decision / Gate** (auth check, role check, permission) |
| `→ arrow` | Data flow / control flow direction |
| `┌─┐ terminal └─┘` | **Start / End** |
| `<--->` | Two-way request/response cycle |

---

## 2) 🧭 High-Level Flow Chart (Mermaid — GitHub/VS Code me render hota hai)

```mermaid
flowchart TB
  subgraph CLIENTS["CLIENT SYSTEM"]
    U1["👷 Field Worker (desktop laptop)"]
    U2["🛢️ Site HSE / Supervisor (tablet)"]
    U3["🏢 Corp / Executive HSE (laptop)"]
    U4["📱 Mobile Browser — PWA ready"]
  end

  subgraph WEB["WEB APPLICATION (React 18 SPA — Vite)"]
    LOGIN["🔐 Login Page"]
    SHELL["Shell / Sidebar Navigation"]
    CC["📊 Command Center"]
    REP["📝 Safety Reports"]
    ALR["🔔 Alerts / Notifications"]
    COP["🤖 Safety Copilot"]
    AII["🧠 AI Intelligence"]
    PRE["🎯 SIF Precursors"]
    LSR["🛡️ Life-Saving Rules"]
    MAP["🗺️ Risk Map (Leaflet)"]
    SIT["🏭 Sites & Assets"]
    CON["🪖 Contractors"]
    INV["🔍 Investigations"]
    CAPA["✅ CAPA"]
    INS["📋 Inspections"]
    KNW["📚 Knowledge Base"]
    ANA["📈 Analytics"]
    ADM["⚙️ Administration"]
  end

  subgraph SEC["AUTHENTICATION & RBAC"]
    GUARD{"◇ Auth Guard ◇\ntoken valid?"}
    ROLE{"◇ Role Check ◇\nmodule allowed?"}
    SITE{"◇ Site Scope ◇\nregion/site?"}
  end

  subgraph API["SERVER (Node.js — Express 5, port 3000)"]
    GW["API Gateway / Routes /api/*"]
    SESS["Session Store (in-memory Map)"]
    AUDIT["Audit Logger"]
    FALLBACK["⚡ Keyword Fallback Engine\n(FB_SIF / FB_LSR — if AI Brain offline)"]
  end

  subgraph DB["DATA PERSISTENCE"]
    MONGO[(💾 MongoDB\noil_sif_intelligence)]
    CLOUD[(🌥️ Cloudinary\nimages / audio / video / docs)]
    DISK[(💿 Local Disk fallback\n/data/media, /data/audio)]
    IDX[(📦 IndexedDB\noffline queue — browser)]
  end

  subgraph AISERV["AI SERVICES (AI BRAIN — Python FastAPI, port 8050)"]
    AN["🧮 /analyze — SIF + LSR + extraction"]
    SM["🔎 /similar — TF-IDF similarity search"]
    PT["📡 /patterns — recurring/emerging patterns"]
    CP["💬 /copilot — Safety Copilot NLU"]
    MT["📊 /metrics & /health"]
  end

  U1 & U2 & U3 & U4 --> LOGIN
  LOGIN --> GUARD
  GUARD -- "token ok" --> SHELL
  GUARD -- "fail" --> LOGIN
  SHELL --> CC & REP & ALR & COP & AII & PRE & LSR & MAP & SIT & CON & INV & CAPA & INS & KNW & ANA & ADM
  SHELL --> ROLE
  ROLE -- denied -->|"Access Restricted (403)"| SHELL
  ROLE -- allowed --> SITE
  REP & ANA & AII & COP --> API
  WEB -- "Bearer <token>" --> GW
  GW --> SESS & AUDIT
  GW --> RBAC
  GW --> MONGO
  GW --> CLOUD
  CLOUD -- "fail ->" --> DISK
  GW -- "/ai/* endpoints" --> AISERV
  AISERV -- "offline ->" --> FALLBACK
  API --> IDX
  IDX --> API
```

---

## 3) 🧾 ASCII Flow Chart (terminal / code editor me bhi padhne layak)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLIENT SYSTEM  (Browser / PWA)                          │
│                                                                             │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐   │
│   │ 👷 Worker   │  │ 🛢️ Site HSE  │  │ 🏢 Corporate   │  │ 📱 Mobile    │   │
│   └──────┬──────┘  └──────┬───────┘  │ HSE / Exec    │  │ PWA          │   │
│          │                 │          └──────┬────────┘  └──────┬───────┘   │
│          └─────────────────┴──────────────────┴───────────────┴─────────  │
│                                   │                                        │
│                    ┌──────────────▼──────────────────────────┐            │
│                    │  REACT 18 SPA (Vite :5173)              │            │
│                    │  • 19 functional modules / pages        │            │
│                    │  • i18n (EN/HI/AS/BN/OR)                │            │
│                    │  • Offline queue → IndexedDB            │            │
│                    │  • Voice input (Web Speech API)         │            │
│                    │  • OCR / PDF / DOCX parsing             │            │
│                    └──────────────┬──────────────────────────┘            │
└───────────────────────────────────┼────────────────────────────────────────┘
                                    │  Authorization: Bearer <token>
                                    ▼
   ◇────────────────────────────────┴─────────────────────────────────◇
   │   AUTHENTICATION & RBAC GATE                                     │
   │   • /api/login → scrypt password verify → token (24h)            │
   │   • Role → module map (ROLE_MODULES) + per-user override         │
   │   • Site scoping (Regional → region, Site → own site)            │
   ◇───────────────────────────────────────────────────────────────────◇
                                    │
                                    ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  SERVER — Express 5 API Gateway  (port 3000)                     │
   │  • REST routes: /api/*      • JWT-ish in-memory sessions          │
   │  • Audit logging            • Static serve frontend/dist          │
   │  • Keyword fallback engine (AI Brain offline hone par)            │
   └──────┬────────────────────────┬──────────────────┬───────────────┘
          │                        │                  │
          ▼                        ▼                  ▼
  (💾 MongoDB)              (🌥️ Cloudinary)     (🧠 AI Brain :8050)
  oil_sif_intelligence     images/audio/video    /analyze /similar
  20+ collections          docs → CDN            /patterns /copilot
          │                        │                  │
          │                  (💿 local disk          ▼
          │                   fallback)      node keyword fallback
          ▼                        │
  Reports / LSR / CAPA         (🗄️ media refs
  stored & queried              re-enter Mongo)
```

---

## 4) 💻 Client System

| Layer | Technology | Role |
|-------|-----------|------|
| **Runtime** | Browser (Chrome/Edge/Firefox) + Mobile Web (PWA-ready) | Runs the SPA |
| **Build tool** | Vite 5 (dev :5173) — hot reload, build → `dist/` | Bundling React app |
| **SPA Framework** | React 18 + react-dom | UI rendering |
| **Styling** | Tailwind CSS 3 + custom CSS | Theming (dark/light/system, `sg-theme` in localStorage) |
| **Routing** | react-router-dom v6 | Module/page navigation + Guards |
| **HTTP client** | Native `fetch` wrapper (`api.js`) with `Bearer` token | Talks to Express API |
| **Charts** | Recharts 2 | Command center graphs, analytics |
| **Maps** | Leaflet + react-leaflet | Risk Map page (OpenStreetMap tiles) |
| **UI kit** | MUI (@mui/material, x-data-grid) + lucide-react icons | Tables, grid, icons |
| **Animations** | framer-motion | Micro-interactions |
| **Offline** | IndexedDB (`oil_sif_offline`) + sync engine | Report bina network ke bhrta hai, online hote hi auto-sync |
| **i18n** | Custom `i18n.jsx` (react hook) | UI + AI output localization — English, हिंदी, অসমীয়া, বাংলা, ଓଡ଼ିଆ |

**Client-side invisible/integrations:** Web Speech API (voice-to-text), Tesseract.js (photo→text OCR), PDF.js (PDF parse), Mammoth (DOCX parse).

---

## 5) 🌐 Web Application — 19 Restricted Functional Modules

Saare modules route + `Guard` se protected hain; backend par `requireModule` / `requireRole` bhi laga hai (defense-in-depth).

| # | Module | Route | Purpose |
|---|--------|-------|---------|
| 1 | Command Center | `/` | KPI cards, SIF trend, density, risk map, top risks |
| 2 | Analytics | `/analytics` | Precursors, activities, barriers, LSR, sites, heatmap, trends |
| 3 | Safety Reports | `/reports` | Create/view reports, voice/photo input, AI classification |
| 4 | Notifications | `/alerts` | Active alerts + acknowledge |
| 5 | Safety Copilot | `/copilot` | AI chat over enterprise safety data |
| 6 | AI Intelligence | `/ai` | Analyze playground, model metrics |
| 7 | SIF Precursors | `/precursors` | Precursor patterns by activity/site |
| 8 | Life-Saving Rules | `/lsr` | LSR classification & controls |
| 9 | Risk Map | `/riskmap` | Geographic precursor density |
| 10 | Sites & Assets | `/sites` | Site registry + asset list |
| 11 | Contractors | `/contractors` | Contractor scorecards |
| 12 | Investigations | `/investigations` | Incident investigation workflow |
| 13 | CAPA | `/capa` | Corrective/Preventive actions tracking |
| 14 | Inspections | `/inspections` | Site inspection checklists |
| 15 | Knowledge Base | `/knowledge` | HSE documents |
| 16 | Administration | `/admin` | Users, RBAC modules, audit, models |

*(Command Center, Reports, CAPA — ye wahi graphs/SIF features hain jo user ko dikhte hain.)*

---

## 6) 🔐 Authentication & Restricted Functional Modules (RBAC)

```
┌─────────────────────────── LOGIN FLOW ───────────────────────────┐
│  POST /api/login  {username, password}                          │
│       │                                                          │
│       ▼                                                          │
│  ◇ User exists? ──no──▶ 401 invalid_credentials                 │
│       │yes                                                       │
│       ▼                                                          │
│  scrypt(password, salt) == password_hash ?                       │
│       │yes                                                       │
│       ▼                                                          │
│  generate 32-byte random token ──▶ sessions Map (24h expiry)     │
│       │                                                          │
│       ▼                                                          │
│  compute effectiveModules(user_id, role) ──▶ return token+user   │
└──────────────────────────────────────────────────────────────────┘
```

**Roles (7):**

| Role | Access scope |
|------|-------------|
| `Administrator` | All modules except Knowledge; full admin |
| `Executive` | Dashboard-only: commandcenter, reports, alerts, copilot, ai, precursors, lsr, riskmap, analytics |
| `Corporate HSE` | Sab kuch except `admin`; all sites |
| `Regional HSE` | Sab kuch except `admin`; apne **region** ke sites |
| `Site HSE` | Operations + enterprise; apne **site** par |
| `Supervisor` | commandcenter, reports, alerts, copilot, lsr, capa |
| `Worker` | commandcenter, reports, alerts, copilot, lsr |

**RBAC layering (2 layers):**
1. **Role default** → `ROLE_MODULES` map (`server.js`)
2. **Per-user override** → `user_modules` collection (Admin toggle grant/deny per user per module)

**Site scoping:** `scopeSites()` → Regional HSE ko region ke saare sites, Site HSE/Supervisor/Worker ko sirf apna site; reports/actions/investigations sab is scope se filter hote hain.

---

## 7) 🖥️ Server (Backend API)

| Property | Value |
|----------|-------|
| **Runtime** | Node.js + Express 5 |
| **Port** | `3000` (default) |
| **Run** | `npm start`, `npm run dev` (watch mode) |
| **CORS** | Allow-all (dev), serves `frontend/dist` statically for prod |
| **Sessions** | In-memory `Map` token → `{user, expires}` (24h) |
| **Rate options** | `express.json({ limit: '25mb' })` for media uploads |
| **Fallback AI** | `fallbackAnalyze()` — keyword-based (FB_SIF / FB_LSR) jab AI Brain offline ho |
| **Audit** | Har important action `audit_log` me; `/api/admin/audit` |
| **Media proxy** | `/api/media/:key/file` — Cloudinary redirect ya local serve (range support) |

**Key API surface (samajhne ke liye):**
`/api/login` `/api/me` `/api/health` `/api/dashboard` `/api/reports` (+ `/audio`, `/similar`, `/media`) `/api/ai/analyze` `/api/ai/similar` `/api/ai/metrics` `/api/ai/feedback` `/api/patterns` `/api/copilot` `/api/alerts` `/api/actions` `/api/contractors` `/api/investigations` `/api/interventions` `/api/inspections` `/api/knowledge` `/api/lessons` `/api/courses` `/api/sites` `/api/assets` `/api/notifications` `/api/analytics/*` `/api/admin/*` `/api/data-quality`.

---

## 8) (💾) Database Storage — MongoDB

**URI:** `mongodb://localhost:27017` — **DB:** `oil_sif_intelligence` (`.env` se override — `MONGO_URL` / `MONGO_DB`)

**Collections (data model):**

| Collection | Kya store karta hai |
|-----------|---------------------|
| `users` | Login, scrypt hash+salt, role, site, email |
| `user_modules` | Per-user RBAC overrides (grant/deny) |
| `sites` / `assets` | Location registry + asset inventory (lat/lng) |
| `contractors` | Contractor master + scores |
| `reports` | Safety reports + AI classification (SIF, LSR, risk, hazards…) |
| `lsr_predictions` | Life-Saving Rule predictions per report |
| `actions` | CAPA actions (status, due date, assignment) |
| `alerts` | Active/acknowledged alerts |
| `patterns` | Recurring precursor patterns (open/closed) |
| `interventions` / `intervention_measures` | Intervention effectiveness (before/after density) |
| `investigations` / `inspections` | Investigation & inspection workflows |
| `knowledge_docs` / `lessons` / `courses` | HSE content |
| `notifications` | Push in-app notifications |
| `audit_log` | Full audit trail |
| `ai_feedback` | Human corrections fed back to AI |
| `model_versions` | Deployed AI model metadata |
| `media` | Media metadata (provider, cloudinary urls/public_ids) |
| `counters` | Auto-increment numeric `id` per collection |

**Key design:** `client_report_id` par **unique + sparse index** → offline queue se duplicate report kabhi nahi banti (idempotency at storage layer).

---

## 9) 🌥️ Image & Media Storage — Cloudinary (+ Local Fallback)

```
  Report me photo/audio/video/docs
            │
            ▼
  ┌──────────────────────────┐
  │ POST /api/media  OR      │   storeMedia() in media.js
  │ embedded in /api/reports │
  └────────────┬─────────────┘
               ▼
     ◇ Cloudinary configured? ──yes──▶ 🌥️ Cloudinary upload (folder: safe-guard/media)
     │  (CLOUDINARY_URL / cloud_name                                    
     │   / api_key / api_secret in .env)                               
     │no / fail                                                          
     ▼                                                                   
  ┌──────────────────────────┐                                          
  │ 💿 Local disk fallback   │  /data/media/<key>.<ext>                 
  │ served via               │  /api/media/<key>/file (Range support)  
  └──────────────────────────┘                                          
     │                                                                  
     ▼                                                                  
  (🗄️ media collection in MongoDB  →  attaches to report)              
```

- **Supported types:** image (jpg/png/webp/gif/svg/heic), video (mp4/webm/mov/mkv…), audio (mp3/wav/ogg/m4a/webm), docs (pdf/doc/docx/xls/xlsx/pptx/txt/csv/md/json/log).
- **Audio (voice reports)** ko Alag se `/data/audio/` me bhi save karke `/api/reports/:id/audio` se serve kiya jata hai.
- **Read path:** `sanitizeMedia()` streams only `key/url/kind/mime/name/size/provider/public_id` — full Cloudinary URL client ko nai leak hota.

---

## 10) 🧩 3rd-Party Sites & Applications (Icons ke saath)

| Icon | Service | Kaha use hota hai | Purpose |
|------|---------|-------------------|---------|
| 🌥️ | **Cloudinary** | Backend `media.js` | Image/audio/video/doc upload + CDN storage (primary) |
| 🗺️ | **OpenStreetMap** (tile server) | `RiskMap` / `SitesMap.jsx` | Free map tiles for geographic risk map |
| 🎙️ | **Web Speech API** (SpeechRecognition) | `Reports.jsx` | Browser-native voice → text report input |
| 🤖 | **Tesseract.js** | `Reports.jsx` | Photo me se text OCR (hazard photo → text) |
| 📑 | **PDF.js (pdfjs-dist)** | `Reports.jsx` | PDF attach parse karke text nikale |
| 📄 | **Mammoth.js** | `Reports.jsx` | `.docx` → plain text conversion |
| 🧩 | **MUI (Material-UI)** | Tables / grid | @mui/material, icons, x-data-grid components |
| 📊 | **Recharts** | Command Center / Analytics | Line/Area/Bar/Pie/Composed charts |
| 🍃 | **Leaflet + react-leaflet** | Risk Map | Interactive map (markers, circles) |
| ✨ | **lucide-react** | Saare pages | SVG icon set (sidebar, buttons) |
| 🎞️ | **framer-motion** | Animations | Page/card transitions |
| 🔤 | **Google Fonts** | `index.html` | Inter, Playfair Display, JetBrains Mono |
| 🌐 | **Google Fonts = external CDN** | fonts.googleapis.com | Typography |

**Infrastructure dependencies (self-hosted / local):**
- Node.js (Express API :3000)
- Python (FastAPI AI service :8050)
- MongoDB community server (:27017, local yaa Atlas)

---

## 11) 🧠 AI Services — jo kuch support karta hai

**AI Brain = Python FastAPI microservice** (`ai_engine/`), default `http://127.0.0.1:8050`. Node backend isse proxy karta hai.

| Endpoint | Feature | Output |
|----------|---------|--------|
| `/analyze` | **SIF classification + LSR mapping + extraction** | sif {prediction, confidence, risk_level, risk_score}, LSR rules (primary/confidence), activity, hazards, barrier failures, consequences, root cause, location, quality flags, explanation, reason codes, recommended actions |
| `/similar` | **Similar-reports search** (TF-IDF + cosine) | Top-N similar past reports with score |
| `/patterns` | **Pattern detection** | Recurring / emerging patterns → auto alerts (critical/warning) |
| `/copilot` | **Safety Copilot NLU** | Natural-language questions par answers + action buttons (site risk, trends, contractors, CAPA, interventions, region compare…) |
| `/metrics` | **Model metrics** | SIF-v2.4: precision 0.91, recall 0.88, LSR accuracy 0.94, F1 0.89, AUC 0.87, trained on 12 400 samples |
| `/health` | Health probe | Platform health check (`/api/health` par reflected) |
| `/feedback` | **Human feedback collection** | AI+human correction `feedback.jsonl` me jata hai |

**AI capabilities (end-to-end):**
1. **Multilingual NLU** — English + हिंदी + অসমীয়া + বাংলা + ଓଡ଼ିଆ (dictionary-based translation + normalization; script detection).
2. **SIF early-warning** — critical term scoring (energy isolation, confined space, H2S, line-of-fire, fatality etc.) → risk level (CRITICAL/HIGH/MEDIUM/LOW).
3. **Life-Saving Rules** — 10 rules multi-label classification with confidence.
4. **Auto review workflow** — confidence ≥0.9 → `auto_classified`, ≥0.7 → `pending_review`, otherwise `mandatory_review`.
5. **Similar reports** — duplicate / pattern detection.
6. **Recommendations** — rule-based recommended actions per LSR.
7. **Copilot** — intent-parsing QA over live enterprise data.
8. **Feedback loop** — HSE corrections `ai_feedback` me ja kar model evaluation me use hoti hain.
9. **Resilience** — AI Brain offline hone par Node-side keyword fallback engine automatically chalta hai (kabhi app fail nahi hota).
10. **Voice input** — Speech-to-text (browser) se siff report create; **OCR** se photo se text.

---

## 12) 🔄 End-to-End Request Flow (Example: Report Banana)

```
[Worker] → Reports Page → voice/type/photo
        → offline queue me save (IndexedDB) + /api/reports POST
        → Express auth middleware (Bearer token) ✓
        → scopeSites() check ✓
        → Poster /analyze (AI Brain) [agar offline → fallbackAnalyze()]
        → MongoDB: reports insert + lsr_predictions + media (Cloudinary/local)
        → audit_log: REPORT_CREATED + AI_CLASSIFIED
        → response → UI par SIF badge + risk level + explanation
```

---

## 13) ⚙️ Ports & Environment

| Service | Tech | Port | Env vars |
|---------|------|------|----------|
| Web App (dev) | Vite | `5173` | — |
| API Server | Node/Express | `3000` | `PORT`, `AI_URL`, `MONGO_URL`, `MONGO_DB`, `CLOUDINARY_URL`/`CLOUDINARY_CLOUD_NAME|API_KEY|API_SECRET` |
| AI Brain | Python/FastAPI | `8050` | `AI_URL` (server se) |
| Database | MongoDB | `27017` | `MONGO_URL`, `MONGO_DB` |
| Media CDN | Cloudinary | external | Cloudinary creds |
| Map tiles | OpenStreetMap | external | — |

---

## 14) 📁 Directory Map

```
Safe-Guard-Project/
├── backend/
│   ├── server.js      → Express API + RBAC + AI proxy + static serve
│   ├── db.js          → MongoDB data layer (all/get/run/agg/…)
│   ├── media.js       → Cloudinary ∩ local-disk media storage
│   ├── seed.js        → Demo data generator
├── ai_engine/
│   ├── main.py        → FastAPI "AI Brain" (port 8050)
│   ├── engine.py      → NLP core (SIF, LSR, extraction, patterns, copilot)
│   ├── lexicon.py     → Multilingual dictionaries + rule keywords
│   └── test_brain.py  → Smoke test
├── frontend/
│   ├── index.html, vite.config.js, tailwind.config.js
│   └── src/
│       ├── App.jsx, main.jsx, api.js, AuthContext.jsx, ThemeContext.jsx,
│       │   i18n.jsx
│       ├── pages/     → 17+ module pages (CommandCenter, Reports, CAPA…)
│       ├── components/→ UI kit, charts, SafetyReportsTable, maps, WhatIfSimulator
│       └── queue/     → IndexedDB offline sync engine
├── data/              → local media/audio fallback storage (runtime)
├── requirements.txt   → Python deps (fastapi, uvicorn)
└── package.json       → Node deps (express, mongodb, cloudinary, dotenv)
```

---

> 💡 **Ek-line summary:** Browser ka React SPA → Bearer-token + RBAC/scope guards → Express API → (a) MongoDB me data, (b) Cloudinary me media [local fallback], (c) Python AI Brain me saare AI features (analyze/similar/patterns/copilot/metrics), aur AI offline ho to Node ka keyword fallback — poora system layered, audited aur offline-capable hai.