// OIL-SIF Intelligence - Seed data generator (MongoDB)
// Builds a rich, realistic demo dataset (Assam / Rajasthan / Odisha operations)
const crypto = require('crypto');
const { run, all, get, dropAll, nowISO } = require('./db');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}

// Seeded RNG for reproducible data
let _seed = 20260913;
function rnd() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
}
function rndInt(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }
function pick(arr) { return arr[rndInt(0, arr.length - 1)]; }
function weighted(items) {
  const total = items.reduce((s, it) => s + (it.w || 1), 0);
  let x = rnd() * total;
  for (const it of items) { x -= (it.w || 1); if (x <= 0) return it; }
  return items[items.length - 1];
}
function dateAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rndInt(6, 20), rndInt(0, 59), rndInt(0, 59), 0);
  return d.toISOString();
}
function reportNo(i) {
  const y = new Date().getFullYear();
  return `OIL-${y}-${String(i).padStart(5, '0')}`;
}

const ALL_COLLECTIONS = ['intervention_measures', 'interventions', 'courses', 'inspections', 'notifications',
  'audit_log', 'ai_feedback', 'model_versions', 'lessons', 'knowledge_docs', 'investigations', 'patterns',
  'alerts', 'actions', 'lsr_predictions', 'reports', 'users', 'assets', 'contractors', 'sites', 'user_modules', 'counters'];

async function clearTables() {
  await dropAll();
}

// ---------------------------------------------------------------------------
// Scenario templates (ground-truth metadata per realistic report)
// ---------------------------------------------------------------------------
// Each has: text (array of phrasings), activity, hazard, barrier, consequence,
// lsr, sif weight, risk base, type weight
const TEMPLATES = [];
function T(texts, meta) {
  if (!Array.isArray(texts)) texts = [texts];
  TEMPLATES.push({ texts, ...meta });
}

// --- Energy Isolation / Maintenance (weighted heavily -> emergent pattern) ---
T(['During maintenance of the compressor, technician started opening the flange before confirming zero pressure.',
   'Maintenance crew began opening the flange on C-17 without verifying zero energy; residual pressure remained.',
   'Fitty opened the flange before isolation verification was completed on the compressor suction line.',
   'Workers began line breaking on the pump discharge without confirming the line was isolated and bled.',
   'During routine maintenance the technician removed the valve before verifying stored pressure was released.',
   'Flange opening on CGT compressor was started though the isolation certificate was not verified.',
   'Technician attempted to open the flange fitting without lockout of the compressor being confirmed.',
   'Zero energy verification was not performed before maintenance crew disassembled the pressure line.'], { activity: 'Maintenance', hazard: 'Stored Pressure', barrier: 'Energy Isolation', consequence: 'Pressure Release', lsr: 'Energy Isolation', sif: 0.93, risk: 'CRITICAL' });

T(['Maintenance crew worked on the compressor without a valid isolation certificate in place.',
   'Isolation was not verified before the maintenance job on the compressor train started.',
   'Permit issued for compressor maintenance, but energy isolation steps were skipped on site.',
   'Deisolation was carried out while the maintenance team was still working on the flange.'], { activity: 'Maintenance', hazard: 'Hazardous Energy', barrier: 'Energy Isolation', consequence: 'Pressure Release', lsr: 'Energy Isolation', sif: 0.9, risk: 'CRITICAL' });

T(['During pump overhaul, isolation was only partially completed and the contractor proceeded.',
   'Pump seal replacement performed without full LOTO - active hydraulic pressure detected.',
   'Maintenance of the crude pump started though the isolation was only a single valve, no blinding.',
   'Worker found a single isolation (no double block & bleed) being relied on during pump maintenance.'], { activity: 'Maintenance', hazard: 'Stored Pressure', barrier: 'Energy Isolation', consequence: 'Pressure Release', lsr: 'Energy Isolation', sif: 0.85, risk: 'HIGH' });

// --- Confined Space ---
T(['Worker entered the tank without gas testing and without verifying isolation of the tank.',
   'Confined space entry was made into the crude tank without atmosphere check or entry permit.',
   'Worker entered the vessel to inspect; no gas test certificate, no standby attendant present.',
   'Entry into the pit was made without gas testing - oxygen level later found deficient.',
   'Tank entry performed by contractor without gas test; rescue plan not available.',
   'Vessel entry started without continuous gas monitoring and without the permit being displayed.'], { activity: 'Confined Space Entry', hazard: 'Confined Atmosphere', barrier: 'Gas Testing', consequence: 'Asphyxiation / Exposure', lsr: 'Confined Space', sif: 0.95, risk: 'CRITICAL' });

T(['Worker entered the confined space alone while the attendant was absent from his post.',
   'Tank entry done without a trained attendant or rescue arrangement in place.',
   'Attendant left the entry point during confined space job - entry continued unsupervised.'], { activity: 'Confined Space Entry', hazard: 'Confined Atmosphere', barrier: 'Supervision', consequence: 'Asphyxiation / Exposure', lsr: 'Confined Space', sif: 0.85, risk: 'HIGH' });

// --- Hot Work ---
T(['Worker was doing grinding near the tank without a hot work permit and no fire watch was present.',
   'Hot work was performed on the pipeline without a valid hot work permit.',
   'Welding carried out near the crude tank; no fire watch assigned and no gas test done.',
   'Grinding sparks were observed falling toward open hydrocarbon drain - no permit, no fire watch.',
   'Hot work started before the hot work permit was approved by the site HSE.',
   'Contractor carried out cutting works adjacent to storage tank without work authorization.'], { activity: 'Hot Work', hazard: 'Fire / Explosion', barrier: 'Permit Verification', consequence: 'Fire / Explosion', lsr: 'Hot Work', sif: 0.9, risk: 'HIGH' });

// --- Lifting / Line of Fire ---
T(['Operators used the crane to lift the skid while a worker stood directly under the suspended load.',
   'Worker remained in line of fire under the suspended load during lifting operations.',
   'Crane lifting was performed with personnel walking under the boom swing path.',
   'Worker positioned himself under the suspended load while sling was being tensioned.',
   'Banksman not present during heavy lift; workers continued in the exclusion zone.'], { activity: 'Lifting', hazard: 'Suspended / Dropped Loads', barrier: 'Barricading', consequence: 'Struck-by Injury', lsr: 'Line of Fire', sif: 0.9, risk: 'CRITICAL' });

T(['Lifting gear used for the compressor spares was found with damaged sling and no inspection tag.',
   'Chain sling with worn links was used for the heavy pump lift - no pre-use inspection.',
   'Failed sling found in use; rigging gear not inspected or color coded for the period.',
   'Contractor used an uncertified shackle for lifting the drill pipe.'], { activity: 'Lifting', hazard: 'Suspended / Dropped Loads', barrier: 'Equipment Condition', consequence: 'Struck-by Injury', lsr: 'Safe Mechanical Lifting', sif: 0.8, risk: 'HIGH' });

// --- Work at Height ---
T(['Worker was working on elevated platform without wearing a fall protection harness.',
   'Person carried out work at height on the tank top with no anchored fall protection.',
   'Workman used a damaged ladder to climb the storage tank; harness not worn.',
   'Unprotected edge work on the roof with no guardrail and no tie-off observed.',
   'Contractor working at height without double lanyard; anchor point not verified.'], { activity: 'Storage / Tank Work', hazard: 'Fall from Height', barrier: 'PPE Compliance', consequence: 'Fall Injury', lsr: 'Working at Height', sif: 0.85, risk: 'HIGH' });

// --- Work Authorisation ---
T(['Hot work being performed without permit near the pipeline right of way.',
   'Unauthorized work found at the tank farm - no permit raised for the job.',
   'Contractor started excavation without any work authorization in place.',
   'Electrical work done on the switch panel without a valid permit to work.',
   'Worker found doing maintenance without the job card or permit being issued.'], { activity: 'General Operation', hazard: 'Hazardous Energy', barrier: 'Permit Verification', consequence: 'Fatal Injury', lsr: 'Work Authorisation', sif: 0.8, risk: 'HIGH' });

// --- Bypassing safety controls ---
T(['A technician bypassed the safety interlock on the compressor to keep it running.',
   'Relief valve isolation valve found closed during compressor operation - safety control defeated.',
   'Interlock on the shutdown system was jumpered out without authorization.',
   'Contractor disabled the gas detection alarm to continue work uninterrupted.',
   'Emergency shutdown push button was bypassed during commissioning activity.'], { activity: 'Maintenance', hazard: 'Fire / Explosion', barrier: 'Permit Verification', consequence: 'Fire / Explosion', lsr: 'Bypassing Safety Controls', sif: 0.93, risk: 'CRITICAL' });

// --- Driving/Transportation ---
T(['Seat belts not worn by drivers during the night transportation journey; speed exceeded limit.',
   'Driver was found speeding on the cross-country road with crew in the vehicle.',
   'Fatigue observed - driver completed journey without rest as per journey management plan.',
   'Vehicle overloading - crew and equipment loaded beyond capacity on project pickup.',
   'Reversing of tanker was conducted without a banksman, near the workshop area.'], { activity: 'Transportation', hazard: 'Vehicle / Mobile Equipment', barrier: 'PPE Compliance', consequence: 'Vehicle Collision', lsr: 'Driving', sif: 0.5, risk: 'MEDIUM' });

// --- Not-SIF / general observations (to balance the dataset) ---
T(['Housekeeping issue: oil spill left in the workshop area could cause slips.',
   'Debris and loose material observed on walkway near the compressor station.',
   'Oil spill on the floor of the pump house not cleaned immediately.',
   'Material stacking blocking the emergency exit in the warehouse.'], { activity: 'General Operation', hazard: 'Slip / Trip / Fall', barrier: 'Housekeeping', consequence: 'Fall Injury', lsr: 'General / Housekeeping', sif: 0.2, risk: 'LOW' });
T(['Fire extinguisher found with expired inspection tag in the control room.',
   'Portable fire extinguisher block by boxes in the storage area.',
   'Expired extinguisher observed at the welding bay.'], { activity: 'General Operation', hazard: 'Fire / Explosion', barrier: 'Equipment Condition', consequence: 'Fire / Explosion', lsr: 'General / Housekeeping', sif: 0.3, risk: 'LOW' });
T(['PPE not worn - worker without safety helmet at the construction site.',
   'Worker observed without safety goggles during grinding operation.',
   'Staff walking in process area without required PPE and without reflective vest.',
   'Worker without ear protection near the running compressor.'], { activity: 'Construction', hazard: 'Slip / Trip / Fall', barrier: 'PPE Compliance', consequence: 'Fatal Injury', lsr: 'General / Housekeeping', sif: 0.4, risk: 'MEDIUM' });

// --- Another near miss with Hindi capture ---
T(['कामगार बिना परमिट के हॉट वर्क कर रहा था टैंक के पास।', // worker was doing hot work without permit near the tank
   'कामगार ने बिना गैस टेस्ट के टंकी के अंदर प्रवेश किया।', // entered tank without gas test
   'ऊंचाई पर काम करते समय बिना हार्नेस के सीढ़ी का उपयोग किया।'], { activity: 'Hot Work', hazard: 'Fire / Explosion', barrier: 'Permit Verification', consequence: 'Fire / Explosion', lsr: 'Hot Work', sif: 0.8, risk: 'HIGH', lang: 'hindi' });

// ---------------------------------------------------------------------------
// Sites, contractors, assets, users
// ---------------------------------------------------------------------------
const SITES = [
  { 
    name: 'Duliajan', 
    region: 'Assam', state: 'Assam', field: 'Bholaguri', lat: 27.36, lng: 95.31 },
  { name: 'Nazira', region: 'Assam', state: 'Assam', field: 'Dikom', lat: 26.91, lng: 94.74 },
  { name: 'Sivasagar', region: 'Assam', state: 'Assam', field: 'Lakwa', lat: 26.98, lng: 94.63 },
  { name: 'Jorhat', region: 'Assam', state: 'Assam', field: 'Moran', lat: 26.75, lng: 94.21 },
  { name: 'Cachar', region: 'Assam', state: 'Assam', field: 'Baragolai', lat: 24.80, lng: 92.79 },
  { name: 'Barmer', region: 'Rajasthan', state: 'Rajasthan', field: 'Mangala', lat: 25.75, lng: 71.40 },
  { name: 'Jaisalmer', region: 'Rajasthan', state: 'Rajasthan', field: 'Rageshwari', lat: 26.91, lng: 70.92 },
  { name: 'Paradeep', region: 'Odisha', state: 'Odisha', field: 'Coastal', lat: 20.28, lng: 86.61 },
];

const CONTRACTORS = [
  { name: 'Supreme Engineering Works', specialty: 'Mechanical Maintenance' },
  { name: 'Krishna Infra Services', specialty: 'Construction & Civil' },
  { name: 'RSB Drilling Operators', specialty: 'Drilling & Well Servicing' },
  { name: 'Eastern Petro Services', specialty: 'Pipelines & Storage' },
  { name: 'NExtractor Well Services', specialty: 'Well Interventions' },
  { name: 'Bajaj Lifting & Rigging', specialty: 'Lifting & Rigging' },
];

const ASSET_TYPES = ['Compressor', 'Pump', 'Tank', 'Pipeline', 'Well', 'Valve Station', 'Separator', 'Vehicle'];
const ASSET_NAMES = ['C-17', 'C-22', 'P-04', 'P-09', 'TK-101', 'TK-205', 'GL-104', 'GL-112', '9"/36" trunkline', 'V-05', 'V-12', 'SW-06', 'CT-08', 'Platform RP-3', 'Pickup MP-12', 'Tanker TT-07'];

async function seedUsers(siteIds) {
  hashPassword('demo123');
  const mk = async (u, role, site, name) => {
    const { salt, hash } = hashPassword('demo123');
    return (await run('users', {
      username: u, password_hash: hash, salt, full_name: name, role, site_id: site, email: `${u}@oil-india.in`,
    })).lastInsertRowid;
  };
  const ids = {};
  ids.admin = await mk('admin', 'Administrator', null, 'System Administrator');
  ids.executive = await mk('executive', 'Executive', null, 'Board CXO');
  ids.corp = await mk('corp_hse', 'Corporate HSE', null, 'Corporate HSE Manager');
  ids.regassam = await mk('reg_hse_a', 'Regional HSE', siteIds[0], 'Regional HSE Assam');
  ids.regraj = await mk('reg_hse_r', 'Regional HSE', siteIds[5], 'Regional HSE Rajasthan');
  ids.site_hse_a = await mk('site_hse_a', 'Site HSE', siteIds[0], 'Site HSE Duliajan');
  ids.site_hse_r = await mk('site_hse_r', 'Site HSE', siteIds[5], 'Site HSE Barmer');
  ids.superv = await mk('supervisor', 'Supervisor', siteIds[0], 'Field Supervisor');
  ids.worker = await mk('worker', 'Worker', siteIds[0], 'Field Worker');
  ids.siter = await mk('site_hse_o', 'Site HSE', siteIds[7], 'Site HSE Paradeep');
  return ids;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------
const SHIFTS = ['Day', 'Day', 'Day', 'Night', 'Night'];
const TYPES = ['Near Miss', 'Near Miss', 'Observation', 'Observation', 'Observation', 'Hazard Report', 'Incident'];
const REVIEWS = ['auto_classified', 'auto_classified', 'auto_classified', 'auto_classified', 'pending_review', 'reviewed'];
const SPECIALTIES = ['Mechanical Maintenance', 'Construction & Civil', 'Drilling & Well Servicing', 'Pipelines & Storage'];

function generateReports(siteIds, assetIds, contractorIds, userIds, N = 130) {
  const reports = [];
  const today = new Date();
  for (let i = 1; i <= N; i++) {
    const tmpl = weighted(TEMPLATES.map((t, idx) => ({ t, idx, w: idx < 16 ? (idx < 8 ? 3.2 : 2.2) : (idx < 20 ? 1.6 : 1) })));
    const t = tmpl.t;
    const text = pick(t.texts);
    const lang = t.lang || 'english';
    const siteId = pick(siteIds);
    const site = SITES.find(s => s.id === siteId);
    const assetId = rnd() < 0.6 ? pick(assetIds) : null;
    const contractorId = rnd() < 0.45 ? pick(contractorIds) : null;
    const daysBack = Math.floor(Math.pow(rnd(), 2.2) * (3 * 365)); // 3-year span, skewed recent
    const created = dateAgo(daysBack);
    const type = pick(TYPES);
    const shift = pick(SHIFTS);
    const reviewStatus = pick(REVIEWS);
    const duplicates = rnd() < 0.03;
    const sif = rnd() < t.sif ? 1 : 0;
    const conf = t.sif > 0.5 ? (0.78 + rnd() * 0.2) : (0.4 + rnd() * 0.35);
    const risk = sif ? (rnd() < (t.risk === 'CRITICAL' ? 0.6 : 0.35) ? 'CRITICAL' : 'HIGH') : pick(['LOW', 'LOW', 'MEDIUM']);
    const riskScore = risk === 'CRITICAL' ? rndInt(80, 96) : risk === 'HIGH' ? rndInt(62, 79) : rndInt(12, 40);
    const quality = [];
    if (rnd() < 0.04) quality.push('missing_location');
    if (rnd() < 0.06) quality.push('very_short');

    reports.push({
      no: reportNo(i),
      type, text, lang, siteId, siteName: site.name, region: site.region, state: site.state,
      assetId, contractorId, activity: t.activity, hazard: t.hazard, barrier: t.barrier,
      consequence: t.consequence, lsr: t.lsr, sif, conf: Math.round(conf * 100) / 100,
      risk, riskScore, shift, reviewStatus, created, duplicate: duplicates,
      quality, model: 'SIF-v2.4',
      submitterId: pick(userIds),
    });
  }
  // sort by created desc for insertion consistency of latest trends
  reports.sort((a, b) => new Date(a.created) - new Date(b.created));
  return reports;
}

async function seed() {
  await clearTables();
  const t0 = nowISO();

  // Sites
  const siteIds = [];
  for (const s of SITES) {
    const id = (await run('sites', {
      name: s.name, region: s.region, state: s.state, field: s.field, lat: s.lat, lng: s.lng, created_at: t0,
    })).lastInsertRowid;
    s.id = id;
    siteIds.push(id);
  }

  // Contractors
  const contractorIds = [];
  for (const c of CONTRACTORS) {
    const score = pick([91, 84, 78, 71, 62, 54]);
    const id = (await run('contractors', { name: c.name, specialty: c.specialty, score, active: 1, created_at: t0 })).lastInsertRowid;
    c.id = id;
    contractorIds.push(id);
  }

  // Assets
  const assetIds = [];
  for (let k = 0; k < 26; k++) {
    const st = pick(siteIds);
    const a = (await run('assets', {
      site_id: st, name: pick(ASSET_NAMES), type: pick(ASSET_TYPES), code: `AST-${100 + k}`,
    })).lastInsertRowid;
    assetIds.push(a);
  }

  // Users
  const userIds = await seedUsers(siteIds);

  // Reports
  const reports = generateReports(siteIds, assetIds, contractorIds, [userIds.worker, userIds.superv, userIds.worker, userIds.superv], 138);
  for (const r of reports) {
    const rid = (await run('reports', {
      report_no: r.no, type: r.type, text_original: r.text, lang: r.lang, text_translated: r.text,
      text_normalized: r.text.toLowerCase(), submitter_id: r.submitterId, site_id: r.siteId, asset_id: r.assetId,
      contractor_id: r.contractorId, activity: r.activity, location_text: r.siteName, hazard: r.hazard,
      barrier_failure: r.barrier, potential_consequence: r.consequence, root_cause: 'Procedure',
      sif_potential: r.sif, sif_confidence: r.conf, risk_level: r.risk, risk_score: r.riskScore,
      primary_lsr: r.lsr, shift: r.shift, status: 'NEW', review_status: r.reviewStatus, source: 'form',
      quality_flags: JSON.stringify(r.quality), evidence_json: JSON.stringify([r.hazard]),
      reason_codes: JSON.stringify([]), explanation_json: JSON.stringify([]),
      recommended_actions: JSON.stringify([]), lsr_json: JSON.stringify([{ rule: r.lsr, confidence: r.conf, primary: 1 }]),
      model: r.model, is_duplicate: r.duplicate ? 1 : 0, created_at: r.created,
    })).lastInsertRowid;

    // LSR predictions table
    let secI = 0;
    const secondaries = {
      'Energy Isolation': ['Work Authorisation'], 'Confined Space': ['Energy Isolation', 'Work Authorisation'],
      'Hot Work': ['Work Authorisation'], 'Line of Fire': ['Safe Mechanical Lifting'],
      'Working at Height': ['Work Authorisation'], 'Safe Mechanical Lifting': ['Line of Fire'],
      'Work Authorisation': ['Hot Work'], 'Driving': [], 'Bypassing Safety Controls': ['Work Authorisation'],
      'General / Housekeeping': [],
    }[r.lsr] || [];
    await run('lsr_predictions', { report_id: rid, rule: r.lsr, confidence: r.conf, is_primary: 1 });
    for (const s of secondaries.slice(0, 2)) {
      await run('lsr_predictions', { report_id: rid, rule: s, confidence: Math.round((0.3 + rnd() * 0.2) * 100) / 100, is_primary: 0 });
    }
  }

  // ===== Analytics-side data =====
  // CAPA actions
  const reportIds = (await all('reports', {}, { sort: { id: 1 }, projection: { id: 1, risk_level: 1 } })).map(cleanId);
  const actionTitles = [
    'Verify isolation procedure for compressor maintenance',
    'Review hot-work authorization workflow',
    'Enforce gas testing prior to confined-space entry',
    'Conduct targeted toolbox talk on zero-energy verification',
    'Refresh work-at-height training for field crew',
    'Audit lifting gear inspection and certification',
    'Reinforce exclusive-zone discipline during lifts',
    'Investigate bypass of safety interlock',
    'Reinforce no-bypass safety policy',
    'Improve permit verification at contractor worksites',
    'Conduct housekeeping campaign at pump house',
    'Verify fire extinguisher inspection status',
  ];
  for (let i = 0; i < 64; i++) {
    const rep = pick(reportIds);
    const priority = rep.risk_level === 'CRITICAL' ? pick(['HIGH', 'HIGH', 'URGENT']) : pick(['MEDIUM', 'MEDIUM', 'HIGH']);
    const st = weighted([
      { v: 'Open', w: 2 }, { v: 'Assigned', w: 2 }, { v: 'In Progress', w: 2 },
      { v: 'Pending Verification', w: 1.5 }, { v: 'Closed', w: 3 }, { v: 'Reopened', w: 0.5 },
    ]).v;
    const due = dateAgo(-rndInt(0, 45));
    const closed = st === 'Closed' ? dateAgo(-rndInt(5, 60)) : null;
    await run('actions', {
      report_id: rep.id, title: pick(actionTitles), description: 'Corrective and preventive action raised from safety report.',
      priority, status: st,
      assignee_id: pick([userIds.site_hse_a, userIds.site_hse_r, userIds.siter, userIds.superv, userIds.regassam]),
      due_date: due,
      evidence: st === 'Pending Verification' ? 'Evidence photo uploaded' : null,
      verification_note: st === 'Closed' ? 'Verified in field by site HSE' : null,
      created_by: userIds.site_hse_a, created_at: due, closed_at: closed,
    });
  }

  // Emerging patterns (energy isolation in maintenance - the headline story)
  const patternRows = [
    ['Energy Isolation failures during compressor maintenance', 'energy_isolation',
     'Maintenance activities involving compressors show repeated isolation-verification failures across 4 locations.',
     34, 4, 'Duliajan, Nazira, Barmer, Paradeep', 'EMERGING'],
    ['Hot work permit compliance gaps', 'hot_work',
     'Grinding/welding observations without valid permits associated with contractor crews.',
     16, 3, 'Duliajan, Sivasagar, Jaisalmer', 'RECURRING'],
    ['Confined-space gas-testing violations', 'confined_space',
     'Repeated tank/vessel entries without gas testing or attendant in Assam fields.',
     11, 2, 'Duliajan, Cachar', 'RECURRING'],
    ['Line-of-fire exposure during lifting', 'line_of_fire',
     'Workers standing under suspended loads; exclusion zones not enforced at lifting sites.',
     13, 3, 'Barmer, Jorhat, Paradeep', 'EMERGING'],
    ['Fall-protection gaps at tank tops', 'working_height',
     'Work at height without harness / damaged ladders at storage tanks.',
     9, 2, 'Nazira, Barmer', 'TRACKING'],
  ];
  for (const [title, cat, desc, cnt, sCnt, sites, trend] of patternRows) {
    await run('patterns', {
      title, category: cat, description: desc, report_count: cnt, site_count: sCnt, sites,
      trend, status: 'open', created_at: dateAgo(rndInt(1, 10)),
    });
  }

  // Alerts
  const alertRows = [
    ['5 similar energy-isolation failures detected within 7 days', 'pattern', 'critical',
     'Maintenance at Duliajan / Nazira with missing zero-energy verification. Immediate HSE review recommended.', 'Duliajan', 'Maintenance'],
    ['Hot-work observations increased 32% in the last 30 days', 'trend', 'warning',
     'Grinding/welding observations without permit rising in Rajasthan fields.', 'Barmer', 'Hot Work'],
    ['3 confined-space entries recorded without gas testing this week', 'pattern', 'critical',
     'Tank entries in Assam without gas test certificate or attendant.', 'Cachar', 'Confined Space Entry'],
    ['Contractor NExtractor Well Services scored 54/100 in Q3 safety review', 'contractor', 'warning',
     'Lowest contractor safety score - repeated permit violations.', 'All', 'Drilling'],
  ];
  for (const [title, type, sev, msg, loc, act] of alertRows) {
    await run('alerts', {
      title, type, severity: sev, message: msg, location: loc, activity: act, status: 'active', created_at: dateAgo(rndInt(0, 5)),
    });
  }

  // Knowledge base
  const kb = [
    ['Energy Isolation Procedure', 'SOP', 'Identify all energy sources. Isolate, lock and tag each source. Verify zero energy and confirm residual energy is released before work begins. Record verification on the isolation certificate.', 'energy isolation, loto, permit', t0],
    ['Confined Space Entry Standard', 'IOGP Rule', 'Test atmosphere before entry, maintain continuous monitoring, post an attendant, confirm rescue plan and breathing apparatus, and enter only with authorization.', 'confined space, gas test, attendant', t0],
    ['Hot Work Control Procedure', 'SOP', 'Hot work requires a validated permit, gas testing before and during work, fire watch, removal of combustible material, and continuous monitoring.', 'hot work, permit, fire watch', t0],
    ['IOGP Life-Saving Rules', 'IOGP Rule', 'Nine rules covering Energy Isolation, Line of Fire, Confined Space, Hot Work, Working at Height, Mechanical Lifting, Work Authorization, Driving and Bypassing Safety Controls.', 'iogp, lsr', t0],
    ['Permit to Work Guidelines', 'OIL SOP', 'Every job requires a valid work authorization. The permit defines scope, isolation, gas testing, PPE and supervision requirements for the activity.', 'permit, ptw, authorization', t0],
    ['Lifting & Rigging Standard', 'OIL SOP', 'Use a lift plan when required. Verify lifting gear certification and color code before use. Maintain exclusion zones and a certified banksman during lifts.', 'lifting, rigging, crane', t0],
  ];
  for (const [title, cat, content, tags, ct] of kb) {
    await run('knowledge_docs', { title, category: cat, content, tags: JSON.stringify(tags.split(', ')), created_at: ct });
  }

  // Lessons learned
  const lessons = [
    ['Flange opening without zero-energy verification', 'A fatality occurred when a flange was opened with residual pressure. Isolation and zero-energy verification is mandatory before any line breaking.', 'Stored pressure / isolation failure', ['Verify zero energy before opening any flange', 'Add isolation verification to pre-job briefing'], 'Duliajan, Barmer', t0],
    ['Confined space entry without gas test', 'Oxygen deficient atmosphere caused a near fatality. Gas testing and continuous monitoring are non-negotiable for confined spaces.', 'Inadequate gas testing', ['Enforce gas test before entry', 'Station rescue equipped attendant'], 'Cachar, Paradeep', t0],
  ];
  for (const [title, content, rc, actions, sites, ct] of lessons) {
    await run('lessons', { title, content, root_cause: rc, actions: JSON.stringify(actions), sites_affected: JSON.stringify(sites.split(', ')), created_at: ct });
  }

  // Model versions
  await run('model_versions', {
    name: 'SIF-v2.4 (current)', version: '2.4',
    metrics: JSON.stringify({ sif_precision: 0.91, sif_recall: 0.88, lsr_accuracy: 0.94, f1: 0.89, auc: 0.87 }),
    active: 1, created_at: t0,
  });

  // Interventions + effectiveness
  const invId = (await run('interventions', {
    title: 'Energy Isolation Verification Campaign', site: 'Duliajan',
    description: 'Field training + supervisor verification walks for zero-energy checks during compressor maintenance.',
    start_date: dateAgo(-60), end_date: dateAgo(-10), created_at: dateAgo(120),
  })).lastInsertRowid;
  await run('intervention_measures', { intervention_id: invId, label: 'SIF precursor density', before_value: 0.82, after_value: 0.51, unit: 'index' });
  await run('intervention_measures', { intervention_id: invId, label: 'Isolation verification compliance', before_value: 62, after_value: 88, unit: '%' });
  const invId2 = (await run('interventions', {
    title: 'Hot Work Permit Refresher Training', site: 'Barmer',
    description: 'Permit refresher for all contractor crews plus strengthened field verification.',
    start_date: dateAgo(-75), end_date: dateAgo(-30), created_at: dateAgo(120),
  })).lastInsertRowid;
  await run('intervention_measures', { intervention_id: invId2, label: 'SIF precursor density', before_value: 0.74, after_value: 0.58, unit: 'index' });

  // Investigations
  const highRisks = (await all('reports', { risk_level: 'CRITICAL' }, { limit: 6, projection: { id: 1, text_original: 1, primary_lsr: 1, created_at: 1 } })).map(cleanId);
  for (const r of highRisks) {
    await run('investigations', {
      report_id: r.id, title: 'Investigation: ' + r.primary_lsr,
      status: pick(['open', 'open', 'in_progress', 'closed']),
      immediate_cause: 'Isolation verification not performed',
      contributing: JSON.stringify(['Incomplete permit verification', 'Stored pressure', 'Inadequate pre-job briefing']),
      root_cause: 'Weak isolation verification process',
      timeline: JSON.stringify(['08:10 Permit issued', '08:30 Equipment isolated', '09:12 Isolation verification missing', '09:20 Near-miss reported']),
      evidence: JSON.stringify(['Permit copy', 'JSA']),
      ai_json: JSON.stringify({ ai_note: 'AI-assisted analysis - HSE investigator validation required.' }),
      investigator_id: pick([userIds.site_hse_a, userIds.site_hse_r, userIds.siter, userIds.regassam, userIds.regraj]),
      summary: r.text_original.slice(0, 60), created_at: r.created_at,
    });
  }

  // Inspections
  for (const s of siteIds) {
    await run('inspections', {
      site_id: s, title: 'Weekly HSE Inspection',
      checklist: JSON.stringify(['Permit compliance', 'Isolation/LOTO', 'Gas testing', 'Housekeeping', 'PPE compliance', 'Lifting gear']),
      findings: JSON.stringify([pick(['No major findings', '2 permit findings', 'Isolation gap on compressor line', 'Housekeeping improvement needed'])]),
      status: pick(['open', 'open', 'completed']), date: dateAgo(rndInt(1, 14)), created_at: t0,
    });
  }

  // Courses (learning mgmt)
  const courseData = [
    ['IOGP Life-Saving Rules Awareness', 'mandatory', 'Field Crew Assam', 'assigned', 12],
    ['Permit to Work Refresher', 'mandatory', 'Contractor: Krishna Infra', 'in_progress', 8],
    ['Confined Space Entry & Gas Testing', 'mandatory', 'Field Crew Cachar', 'assigned', 5],
    ['Zero Energy Verification (Energy Isolation)', 'targeted', 'All Duliajan crews', 'assigned', 3],
    ['Defensive Driving Refresher', 'mandatory', 'Transportation crew', 'completed', 40],
  ];
  const cstatus = { assigned: 'assigned', in_progress: 'in_progress', completed: 'completed' };
  for (const [title, type, who, st, dd] of courseData) {
    await run('courses', {
      title, type, status: cstatus[st] || 'assigned', assignee_name: who,
      due_date: dateAgo(-dd), completed_at: st === 'completed' ? dateAgo(-80) : null, created_at: dateAgo(-60),
    });
  }

  // Notifications for users
  const notifDefs = [
    [userIds.site_hse_a, 'Energy Isolation pattern detected', '5 similar isolation-verification failures in 7 days at Duliajan.', 'alert'],
    [userIds.regassam, 'Emerging precursor: Energy Isolation', 'Repeated compressor-maintenance isolation gaps across Assam fields.', 'pattern'],
    [userIds.corp, 'Board summary ready', 'Monthly HSE summary now available in Command Center.', 'report'],
    [userIds.site_hse_r, 'Hot work trend rising', 'Hot-work observations increased 32% in 30 days at Barmer.', 'trend'],
    [userIds.superv, 'Action overdue', 'CAPA action #23 is overdue by 3 days.', 'capa'],
  ];
  for (const [uid, title, body, type] of notifDefs) {
    await run('notifications', { user_id: uid, title, body, type, read: 0, created_at: dateAgo(rndInt(0, 4)) });
  }

  // Audit trail samples
  const audActions = [
    ['REPORT_CREATED', 'report'], ['AI_CLASSIFIED', 'report'], ['HSE_REVIEWED', 'report'],
    ['ACTION_CREATED', 'action'], ['OWNER_ASSIGNED', 'action'], ['VERIFIED', 'action'], ['CLOSED', 'action'],
  ];
  for (let i = 0; i < 40; i++) {
    const [act, ent] = pick(audActions);
    await run('audit_log', {
      user_id: pick(Object.values(userIds)), user_name: 'seeded_user', action: act, entity: ent,
      entity_id: null, detail: `${act.toLowerCase()} by seeded process`, created_at: dateAgo(rndInt(0, 60)),
    });
  }

  // Contractor trend measures (per site x contractor density for heatmap enrichment)
  return {
    sites: SITES.length, contractors: CONTRACTORS.length, users: 10, assets: assetIds.length,
    reports: reports.length, actions: 64, patterns: 5, alerts: 4, investigations: highRisks.length,
  };
}

function cleanId(doc) {
  return { id: doc.id, ...doc };
}

if (require.main === module) {
  seed().then((r) => {
    console.log('Seed complete:', JSON.stringify(r));
    process.exit(0);
  }).catch((e) => {
    console.error('SEED FAILED:', e);
    process.exit(1);
  });
}

module.exports = { seed };