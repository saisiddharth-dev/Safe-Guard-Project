// Universal media storage: Cloudinary primary, local-disk fallback.
// Works even if `cloudinary` is not installed or creds are missing -> falls back to disk.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEDIA_DIR = path.join(__dirname, '..', 'data', 'media');

let cloudinary = null;
try { cloudinary = require('cloudinary').v2; } catch (e) { cloudinary = null; }

const CLOUD_URL = process.env.CLOUDINARY_URL || '';
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

if (cloudinary && CLOUD_URL) {
  cloudinary.config({ url: CLOUD_URL });
} else if (cloudinary && CLOUD_NAME && API_KEY && API_SECRET) {
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET });
} else {
  cloudinary = null; // no creds -> local fallback
}

function cloudReady() { return !!cloudinary; }

const IMAGE_EXT = { jpeg: '.jpg', jpg: '.jpg', png: '.png', webp: '.webp', gif: '.gif', bmp: '.bmp', svg: '.svg', heic: '.heic' };
const VIDEO_EXT = { mp4: '.mp4', webm: '.webm', quicktime: '.mov', x_m4v: '.m4v', avi: '.avi', x_matroska: '.mkv' };
const AUDIO_EXT = { 'x-m4a': '.m4a', mpeg: '.mp3', mp3: '.mp3', wav: '.wav', ogg: '.ogg', webm: '.webm', mp4: '.mp4', 'x-wav': '.wav' };
const DOC_EXT = {
  pdf: '.pdf', 'msword': '.doc',
  'vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'vnd.ms-excel': '.xls', 'vnd.ms-powerpoint': '.pptx',
  plain: '.txt', csv: '.csv', markdown: '.md', 'application/json': '.json', 'x-log': '.log',
};

function cleanB64(base64) {
  return String(base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
}

function extFor(mime, name) {
  if (name && path.extname(name)) return path.extname(name).toLowerCase();
  const m = String(mime || '').toLowerCase().replace(/^application\//, '');
  if (IMAGE_EXT[m]) return IMAGE_EXT[m];
  if (VIDEO_EXT[m]) return VIDEO_EXT[m];
  if (AUDIO_EXT[m]) return AUDIO_EXT[m];
  if (DOC_EXT[m]) return DOC_EXT[m];
  if (DOC_EXT[String(mime || '').toLowerCase()]) return DOC_EXT[String(mime || '').toLowerCase()];
  return '.bin';
}

function kindOf(mime, name) {
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg|heic)$/.test(n)) return 'image';
  if (m.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/.test(n)) return 'audio';
  if (m === 'application/pdf' || /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|log|json)$/.test(n)) return 'doc';
  return 'doc';
}

function uploadToCloudinary(cleaned, kind) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'safe-guard/media', resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(Buffer.from(cleaned, 'base64'));
  });
}

// Try Cloudinary first; on ANY failure store on local disk and report provider.
async function storeMedia({ base64, mime, name, created_by = null }) {
  const cleaned = cleanB64(base64);
  if (!cleaned) throw new Error('empty_file');
  const size = Math.floor((cleaned.length * 3) / 4);
  const kind = kindOf(mime, name);
  const ext = extFor(mime, name);
  const key = 'm' + crypto.randomBytes(9).toString('hex');

  if (cloudinary) {
    try {
      const r = await uploadToCloudinary(cleaned, kind);
      return {
        key, provider: 'cloudinary', url: r.secure_url, public_id: r.public_id,
        kind, mime: mime || '', name: name || 'file' + ext, size, created_by, created_at: new Date().toISOString(),
      };
    } catch (e) {
      console.warn('[media] cloudinary failed, falling back to local disk:', e.message);
    }
  }

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const fname = key + ext;
  fs.writeFileSync(path.join(MEDIA_DIR, fname), Buffer.from(cleaned, 'base64'));
  return {
    key, provider: 'local', url: `/api/media/${key}/file`, public_id: null, file: fname,
    kind, mime: mime || '', name: name || 'file' + ext, size, created_by, created_at: new Date().toISOString(),
  };
}

// Serve a local media file with HTTP Range support (needed for <video>/<audio> seeking).
function serveLocal(record, req, res) {
  const fname = path.basename(record.file || '');
  const fp = path.join(MEDIA_DIR, fname);
  if (!fname || !fs.existsSync(fp)) { res.status(404).json({ error: 'no_file' }); return; }
  const stat = fs.statSync(fp);
  const mime = record.mime || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Content-Disposition', `${record.kind === 'image' || record.kind === 'video' || record.kind === 'audio' ? 'inline' : 'attachment'}; filename="${encodeURIComponent(record.name || fname)}"`);

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (start >= stat.size) { res.status(416).setHeader('Content-Range', `bytes */${stat.size}`); res.end(); return; }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(fp, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(fp).pipe(res);
  }
}

module.exports = { storeMedia, serveLocal, cloudReady, MEDIA_DIR, kindOf };
