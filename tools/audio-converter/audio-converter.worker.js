/**
 * audio-converter.worker.js — Westcrest Media
 * Dedicated Web Worker that drives the FFmpeg WebAssembly engine
 * (@ffmpeg/ffmpeg 0.12 + @ffmpeg/core 0.12, single-thread build,
 *  no COOP/COEP headers required).
 *
 * The engine is loaded lazily (first conversion) and cached in memory.
 * All heavy lifting — decoding, encoding, muxing — happens here so the
 * UI thread never blocks.
 */

let FFmpeg = null;
let ffmpeg = null;
let currentId = null;

// The FFmpeg library itself, tried across CDN mirrors (the browser picks the
// first one that imports cleanly; import() resolves relative module imports
// against each URL's own host).
const FFM_LIB_URLS = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js',
  'https://fastly.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js',
  'https://gcore.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js',
  'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js',
];

// Core directories, tried in order. The first entry is the local copy hosted on
// this site (fastest, no CDN needed):
//   /assets/ffmpeg/core-0.12.10/ffmpeg-core.js   (~0.1MB ESM loader)
//   /assets/ffmpeg/core-0.12.10/ffmpeg-core.wasm  (~31MB)
// If a file is missing the 404 is fast and we fall straight through to CDNs.
const CORE_DIRS = [
  new URL('/assets/ffmpeg/core-0.12.10', self.location.origin).href,
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://gcore.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
];

async function loadLibrary() {
  if (FFmpeg) return FFmpeg;
  const errors = [];
  for (const url of FFM_LIB_URLS) {
    try {
      const mod = await import(url);
      if (mod && mod.FFmpeg) { FFmpeg = mod.FFmpeg; return FFmpeg; }
    } catch (e) {
      errors.push(url.split('/')[2] + ' (' + String((e && e.message) || e) + ')');
    }
  }
  throw new Error('Could not load the FFmpeg library: ' + errors.join(' | '));
}

function post(type, payload, transfer) {
  const msg = Object.assign({ type }, payload || {});
  if (transfer) self.postMessage(msg, transfer);
  else self.postMessage(msg);
}

/** Downloads a core file from the first mirror that serves it, streaming with
 *  progress callbacks. Returns the Blob. */
async function fetchCoreFile(fileName, expectedSize, onProgress) {
  const errors = [];
  for (const base of CORE_DIRS) {
    try {
      const res = await fetch(base + '/' + fileName);
      if (!res.ok) { errors.push(base.replace(/^https?:\/\//, '') + ' HTTP ' + res.status); continue; }
      // Use Content-Length when present, else fall back to a known size so
      // progress still streams and the UI watchdog stays fed.
      const total = Number(res.headers.get('Content-Length')) || expectedSize || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total && onProgress) onProgress(received / total);
      }
      const buf = new Uint8Array(received);
      let offset = 0;
      for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
      return new Blob([buf]);
    } catch (e) {
      errors.push(base.replace(/^https?:\/\//, '') + ' (' + String((e && e.message) || e) + ')');
    }
  }
  throw new Error('Could not download ' + fileName + ' from any mirror. ' + errors.join(' | '));
}

/** Picks the first core base dir that actually serves ffmpeg-core.js, so we can
 *  hand the library a REAL url (not a blob). This matters: the library derives
 *  wasmURL/workerURL from coreURL via `.replace(/.js$/, ...)` and a blob url
 *  never matches — which makes engine startup hang ("too long to start"). */
async function resolveCoreBase() {
  const errors = [];
  for (const base of CORE_DIRS) {
    try {
      const res = await fetch(base + '/ffmpeg-core.js');
      if (res.ok) {
        if (res.body && res.body.cancel) { try { res.body.cancel(); } catch (e) { /* ignore */ } }
        return base;
      }
      errors.push(base.replace(/^https?:\/\//, '') + ' HTTP ' + res.status);
    } catch (e) {
      errors.push(base.replace(/^https?:\/\//, '') + ' (' + String((e && e.message) || e) + ')');
    }
  }
  throw new Error('No FFmpeg core source available. ' + errors.join(' | '));
}

async function loadEngine() {
  if (ffmpeg) return;
  if (!FFmpeg) await loadLibrary();
  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ type, message }) => {
    post('log', { id: currentId, type, message });
  });

  ffmpeg.on('progress', ({ progress, time }) => {
    if (currentId) post('progress', { id: currentId, progress: progress || 0, time: time || 0 });
  });

  // coreURL MUST be a real URL (/assets/ffmpeg/... or a CDN path), never a blob.
  post('load-progress', { pct: 2, phase: 'core' });
  const coreBase = await resolveCoreBase();
  const coreURL = coreBase + '/ffmpeg-core.js';
  post('load-progress', { pct: 30, phase: 'core' });

  // The wasm we fetch ourselves (streaming progress) and hand over explicitly.
  post('load-progress', { pct: 48, phase: 'wasm' });
  const wasmBlob = await fetchCoreFile('ffmpeg-core.wasm', 32000000, (p) => {
    post('load-progress', { pct: Math.round(48 + p * 44), phase: 'wasm' });
  });
  const wasmURL = URL.createObjectURL(new Blob([wasmBlob], { type: 'application/wasm' }));

  post('load-progress', { pct: 97, phase: 'start' });
  try {
    await ffmpeg.load({ coreURL, wasmURL });
  } catch (err) {
    post('engine-fail', { message: String((err && err.message) || err) });
    throw err;
  }
  post('load-progress', { pct: 100, phase: 'ready' });
}

async function runCapture(args) {
  // Run a command and capture its stdout lines (for capability enumeration).
  const lines = [];
  const onLog = ({ type, message }) => { if (type === 'stdout') lines.push(message); };
  ffmpeg.on('log', onLog);
  try {
    await ffmpeg.exec(args);
  } finally {
    ffmpeg.off('log', onLog);
  }
  return lines.join('\n');
}

function parseEncoders(text) {
  const set = new Set();
  for (const line of text.split('\n')) {
    if (!/^\s*A\s/.test(line)) continue;
    const name = (line.trim().split(/\s+/)[1] || '').trim();
    if (name) set.add(name);
  }
  return set;
}

function parseMuxers(text) {
  const set = new Set();
  for (const line of text.split('\n')) {
    if (!/^\s*E\s/.test(line)) continue;
    const name = (line.trim().split(/\s+/)[1] || '').trim();
    if (name) set.add(name);
  }
  return set;
}

// The FFmpeg instance is a singleton, so all commands must run one at a time.
// Messages are queued and handled strictly sequentially to avoid interleaving
// loads, capability probes and conversions.
let queue = Promise.resolve();

self.onmessage = (event) => {
  const msg = event.data || {};
  queue = queue
    .then(() => dispatch(msg))
    .catch((err) => {
      currentId = null;
      post('error', {
        id: msg.id != null ? msg.id : null,
        type: msg.type,
        message: String((err && err.message) || err),
      });
    });
};

async function dispatch(msg) {
  if (msg.type === 'load') {
    await loadEngine();
    post('ready');
    return;
  }

  if (msg.type === 'capabilities') {
    await loadEngine();
    const encText = await runCapture(['-hide_banner', '-encoders']);
    const fmtText = await runCapture(['-hide_banner', '-formats']);
    post('capabilities', {
      encoders: Array.from(parseEncoders(encText)),
      muxers: Array.from(parseMuxers(fmtText)),
    });
    return;
  }

  if (msg.type === 'convert') {
    if (!ffmpeg) throw new Error('Engine is not loaded yet.');
    currentId = msg.id;
    const inPath = 'in_' + msg.id + '.' + msg.ext;
    const outPath = 'out_' + msg.id + '.' + msg.outExt;

    await ffmpeg.writeFile(inPath, new Uint8Array(msg.data));
    try {
      const ret = await ffmpeg.exec(msg.args);
      if (ret !== 0) {
        throw new Error('FFmpeg exited with code ' + ret + ' - the input may use an unsupported codec.');
      }
      const out = await ffmpeg.readFile(outPath);
      const bytes = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
      post('done', { id: msg.id, data: bytes }, [bytes]);
    } finally {
      try { await ffmpeg.deleteFile(inPath); } catch (e) { /* ignore */ }
      try { await ffmpeg.deleteFile(outPath); } catch (e) { /* ignore */ }
    }
    currentId = null;
    return;
  }

  if (msg.type === 'ping') {
    post('pong');
    return;
  }
}