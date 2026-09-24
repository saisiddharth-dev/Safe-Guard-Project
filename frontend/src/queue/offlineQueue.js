// Offline report queue built on IndexedDB with an auto-sync engine.
// Reports are stored locally under a unique clientReportId and pushed to the
// server whenever the browser is online again. A record is deleted from the
// queue ONLY after the server confirms receipt (200) or reports it as an
// already-submitted duplicate, so nothing is ever lost.
import { useState, useEffect } from 'react';
import { api, getToken } from '../api';

export const SYNC_STATUS = {
  PENDING: 'PENDING_SYNC',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  FAILED: 'SYNC_FAILED',
};

const DB_NAME = 'oil_sif_offline';
const DB_VERSION = 1;
const STORE = 'reports';
const RETRY_BASE_MS = 15000;
const RETRY_MAX_MS = 300000;
const INTERVAL_MS = 30000;
const backoff = (n) => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.max(0, n)));

export function genClientReportId() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return 'cri-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb_unsupported')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'clientReportId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexeddb_open_failed'));
  });
  return dbPromise;
}

function allItems() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const q = t.objectStore(STORE).getAll();
    q.onsuccess = () => resolve(q.result || []);
    q.onerror = () => reject(q.error || new Error('read_failed'));
  }));
}

function putItem(item) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const r = t.objectStore(STORE).put(item);
    r.onsuccess = () => resolve(item);
    r.onerror = () => reject(r.error || new Error('write_failed'));
    t.onabort = () => reject(t.error || new Error('write_aborted'));
  }));
}

function patchItem(clientReportId, patch) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    const r = s.get(clientReportId);
    r.onsuccess = () => {
      const cur = r.result;
      if (!cur) { resolve(); return; }
      Object.assign(cur, patch, { updatedAt: new Date().toISOString() });
      s.put(cur).onsuccess = () => resolve();
    };
    r.onerror = () => reject(r.error || new Error('read_failed'));
    t.onabort = () => reject(t.error || new Error('write_aborted'));
  }));
}

function deleteItem(clientReportId) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const r = t.objectStore(STORE).delete(clientReportId);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error || new Error('delete_failed'));
    t.onabort = () => reject(t.error || new Error('delete_aborted'));
  }));
}

// ---- observable queue state ------------------------------------------------

const listeners = new Set();
const state = {
  online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  pending: 0,
  syncing: 0,
  synced: 0,
  failed: 0,
};

function emit() {
  const snap = { ...state };
  for (const fn of listeners) { try { fn(snap); } catch (e) { /* subscriber error */ } }
}

export function subscribeQueue(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function getQueueState() {
  return { ...state };
}

export function useQueueState() {
  const [s, setS] = useState(() => ({ ...state }));
  useEffect(() => subscribeQueue(setS), []);
  return s;
}

async function refreshCounts() {
  try {
    const items = await allItems();
    state.pending = items.filter((i) => i.status === SYNC_STATUS.PENDING).length;
    state.syncing = items.filter((i) => i.status === SYNC_STATUS.SYNCING).length;
    state.failed = items.filter((i) => i.status === SYNC_STATUS.FAILED).length;
  } catch (e) { /* keep last known counts */ }
  emit();
}

// ---- queue operations ------------------------------------------------------

export async function enqueue(draft) {
  const now = new Date().toISOString();
  const item = {
    clientReportId: draft.clientReportId || genClientReportId(),
    status: SYNC_STATUS.PENDING,
    attempt: 0,
    retryCount: 0,
    retryable: true,
    lastSyncAttempt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    payload: {
      text: draft.text || '',
      type: draft.type || 'Observation',
      lang: draft.lang || 'english',
      site_id: draft.site_id || '',
      contractor_id: draft.contractor_id || '',
      shift: draft.shift || 'Day',
      audio: draft.audio || null,
      attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
    },
  };
  await putItem(item);
  await refreshCounts();
  scheduleSync(0);
  return item;
}

export function getQueueItems() {
  return allItems().then((items) => items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
}

export async function removeQueuedItem(clientReportId) {
  await deleteItem(clientReportId);
  await refreshCounts();
  return { ...state };
}

export async function retryQueued() {
  const items = await allItems();
  let changed = false;
  for (const i of items) {
    if (i.status === SYNC_STATUS.FAILED) {
      await patchItem(i.clientReportId, { status: SYNC_STATUS.PENDING, attempt: 0 });
      changed = true;
    }
  }
  if (changed) await refreshCounts();
  const r = await syncNow();
  return r;
}

// ---- sync engine -----------------------------------------------------------

let engineStarted = false;
let syncingNow = false;

function isDue(item) {
  if (item.status === SYNC_STATUS.PENDING) return true;
  if (item.status === SYNC_STATUS.FAILED && item.retryable !== false) {
    const last = item.lastSyncAttempt ? new Date(item.lastSyncAttempt).getTime() : 0;
    return Date.now() - last >= backoff(item.attempt || 0);
  }
  return false;
}

function buildRequestBody(item) {
  const p = item.payload || {};
  const body = {
    clientReportId: item.clientReportId,
    text: p.text || '',
    type: p.type || 'Observation',
    lang: p.lang || 'english',
    shift: p.shift || 'Day',
  };
  if (p.site_id) body.site_id = p.site_id;
  if (p.contractor_id) body.contractor_id = p.contractor_id;
  if (p.audio && p.audio.base64) {
    body.audio_base64 = p.audio.base64;
    body.audio_mime = p.audio.mime || 'audio/webm';
    body.audio_duration = p.audio.duration || 0;
  }
  if (Array.isArray(p.attachments) && p.attachments.length) {
    body.attachments = p.attachments.map((a) => ({ base64: a.base64, mime: a.mime, name: a.name }));
  }
  return body;
}

async function syncOne(item) {
  const attempt = (item.attempt || 0) + 1;
  await patchItem(item.clientReportId, { status: SYNC_STATUS.SYNCING });
  try {
    const r = await api.post('/reports', buildRequestBody(item));
    // 2xx — server confirmed the report (or returned the existing duplicate:
    // r.duplicate === true). Safe to remove from the queue now.
    state.synced += 1;
    await deleteItem(item.clientReportId);
    return 'ok';
  } catch (e) {
    if (e.status) {
      // Server answered with an HTTP error. Keep it for backoff retry.
      await patchItem(item.clientReportId, {
        status: SYNC_STATUS.FAILED, attempt, retryCount: (item.retryCount || 0) + 1,
        lastSyncAttempt: new Date().toISOString(), lastError: String(e.message || 'server_error'),
      });
      return e.status === 401 ? 'auth' : 'failed';
    }
    // No HTTP status = network/offline. Return to pending; retried when online.
    await patchItem(item.clientReportId, {
      status: SYNC_STATUS.PENDING, attempt, lastSyncAttempt: new Date().toISOString(), lastError: 'offline',
    });
    return 'offline';
  }
}

export async function syncNow() {
  if (!getToken()) return { skipped: true };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { offline: true };
  if (syncingNow) return { busy: true };
  syncingNow = true;
  let synced = 0, failed = 0;
  try {
    let items = [];
    try { items = await allItems(); } catch (e) { return { error: 'queue_unavailable' }; }
    for (const item of items) {
      if (item.status !== SYNC_STATUS.PENDING && !isDue(item)) continue;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
      const res = await syncOne(item);
      if (res === 'ok') synced += 1;
      else if (res === 'failed') failed += 1;
      else break; // offline or auth issue — stop the batch
    }
  } finally {
    syncingNow = false;
    state.synced = 0;
    await refreshCounts();
  }
  return { synced, failed, pending: state.pending };
}

let timer = null;
function scheduleSync(ms) {
  setTimeout(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) syncNow();
  }, ms);
}

export function startSyncEngine() {
  if (typeof window === 'undefined') return;
  if (engineStarted) return;
  engineStarted = true;
  window.addEventListener('online', () => {
    state.online = true;
    emit();
    if (getToken()) syncNow();
  });
  window.addEventListener('offline', () => {
    state.online = false;
    emit();
  });
  timer = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && getToken()) syncNow();
  }, INTERVAL_MS);
  if (typeof navigator !== 'undefined' && navigator.onLine && getToken()) syncNow();
}