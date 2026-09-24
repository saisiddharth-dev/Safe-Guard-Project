// OIL-SIF Intelligence - MongoDB data layer
const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'oil_sif_intelligence';

const client = new MongoClient(MONGO_URL);
const mdb = client.db(MONGO_DB);

let connected = false;
async function ensureConnected() {
  if (connected) return;
  await client.connect();
  connected = true;
}

async function nextId(name) {
  await ensureConnected();
  const r = await mdb.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const doc = r && r.value !== undefined ? r.value : r;
  return doc ? doc.seq : 1;
}

async function all(coll, filter = {}, opts = {}) {
  await ensureConnected();
  let cur = mdb.collection(coll).find(filter, opts.projection ? { projection: opts.projection } : {});
  if (opts.sort) cur = cur.sort(opts.sort);
  if (opts.limit) cur = cur.limit(opts.limit);
  return cur.toArray();
}

async function get(coll, filter = {}) {
  await ensureConnected();
  return mdb.collection(coll).findOne(filter);
}

async function run(coll, doc) {
  await ensureConnected();
  if (doc.id === undefined || doc.id === null) doc.id = await nextId(coll);
  const { _id, ...rest } = doc;
  await mdb.collection(coll).insertOne(rest);
  return { lastInsertRowid: doc.id };
}

async function update(coll, filter, set) {
  await ensureConnected();
  const res = await mdb.collection(coll).updateOne(filter, { $set: set });
  return { changes: res.modifiedCount };
}

async function updateMany(coll, filter, set) {
  await ensureConnected();
  const res = await mdb.collection(coll).updateMany(filter, { $set: set });
  return { changes: res.modifiedCount };
}

async function remove(coll, filter) {
  await ensureConnected();
  const res = await mdb.collection(coll).deleteMany(filter);
  return { deletedCount: res.deletedCount };
}

async function count(coll, filter = {}) {
  await ensureConnected();
  return mdb.collection(coll).countDocuments(filter);
}

async function agg(coll, pipeline) {
  await ensureConnected();
  return mdb.collection(coll).aggregate(pipeline).toArray();
}

async function dropAll() {
  await ensureConnected();
  const list = await mdb.listCollections().toArray();
  for (const c of list) await mdb.collection(c.name).drop().catch(() => {});
}

function nowISO() {
  return new Date().toISOString();
}

async function audit(user, action, entity, entity_id, detail = '') {
  try {
    await run('audit_log', {
      user_id: user ? user.id : null,
      user_name: user ? user.full_name || user.username : 'system',
      action,
      entity,
      entity_id: entity_id || null,
      detail,
      created_at: nowISO(),
    });
  } catch (e) { /* audit must never crash the app */ }
}

// Strip Mongo _id so responses stay identical to the old SQL row shape
function clean(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

module.exports = {
  client, mdb, all, get, run, update, updateMany, remove, count, agg, nextId, dropAll, audit, nowISO, clean,
  MONGO_URL, MONGO_DB,
};