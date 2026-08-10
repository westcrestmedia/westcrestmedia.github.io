/**
 * audio-converter.worker.js — Westcrest Media
 * Dedicated Web Worker that drives the FFmpeg WebAssembly engine
 * (@ffmpeg/core 0.12, single-thread build, no COOP/COEP headers required).
 *
 * IMPORTANT: this drives createFFmpegCore DIRECTLY instead of using the
 * @ffmpeg/ffmpeg wrapper. The wrapper spawns its own internal Worker from a
 * cross-origin URL (cdn.jsdelivr.net/.../worker.js) which browsers hard-block
 * with: "Failed to construct 'Worker': ... cannot be accessed from origin".
 * Module imports (import()) ARE allowed cross-origin with CORS, so we import
 * the core ourselves and call its FS/exec API directly — no internal worker.
 */

/* Human-readable phase used by the UI overlay. */

/* Core base directories, tried in order. The first entry is the local copy:
 *   /assets/ffmpeg/core-0.12.10/ffmpeg-core.js   (~0.1MB ESM loader)
 *   /assets/ffmpeg/core-0.12.10/ffmpeg-core.wasm  (~31MB)
 * A fast 404 on the local path falls straight through to the CDN mirrors. */
const CORE_DIRS = [
  new URL('/assets/ffmpeg/core-0.12.10', self.location.origin).href,
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://gcore.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
];

let core = null;     // the createFFmpegCore instance
let currentId = null;
let queue = Promise.resolve();

function post(type, payload, transfer) {
  const msg = Object.assign({ type }, payload || {});
  if (transfer) self.postMessage(msg, transfer);
  else self.postMessage(msg);
}

/** Picks the first core base dir that serves ffmpeg-core.js. */
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

/** Downloads a core file from the first mirror that serves it, streaming with
 *  progress callbacks. Returns the Blob. */
async function fetchCoreFile(fileName, expectedSize, onProgress) {
  const errors = [];
  for (const base of CORE_DIRS) {
    try {
      const res = await fetch(base + '/' + fileName);
      if (!res.ok) { errors.push(base.replace(/^https?:\/\//, '') + ' HTTP ' + res.status); continue; }
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

async function loadEngine() {
  if (core) return;

  post('load-progress', { pct: 2, phase: 'core' });
  const coreBase = await resolveCoreBase();
  const coreURL = coreBase + '/ffmpeg-core.js';
  post('load-progress', { pct: 20, phase: 'core' });

  post('load-progress', { pct: 40, phase: 'wasm' });
  const wasmBlob = await fetchCoreFile('ffmpeg-core.wasm', 32000000, (p) => {
    post('load-progress', { pct: Math.round(40 + p * 52), phase: 'wasm' });
  });
  const wasmURL = URL.createObjectURL(new Blob([wasmBlob], { type: 'application/wasm' }));

  post('load-progress', { pct: 97, phase: 'start' });
  try {
    const mod = await import(/* @vite-ignore */ coreURL);
    const createFFmpegCore = mod && (mod.default || mod.createFFmpegCore);
    if (typeof createFFmpegCore !== 'function') {
      throw new Error('Core module did not expose createFFmpegCore.');
    }
    // Same boot technique @ffmpeg/ffmpeg uses: encode the wasm location
    // (blob) into the script URL hash so the core can find it.
    core = await createFFmpegCore({
      mainScriptUrlOrBlob: coreURL + '#' + btoa(JSON.stringify({ wasmURL })),
    });
    core.setProgress(({ progress, time }) => {
      if (currentId) post('progress', { id: currentId, progress: progress || 0, time: time || 0 });
    });
    core.setLogger(({ type, message }) => {
      post('log', { id: currentId, type, message });
    });
  } catch (err) {
    post('engine-fail', { message: String((err && err.message) || err) });
    throw err;
  }
  post('load-progress', { pct: 100, phase: 'ready' });
}

/** Runs a synchronous FFmpeg command bus against the loaded core and returns
 *  the process exit code. Timeouts are kept at -1 (infinite). */
function runCommand(args) {
  if (!core) throw new Error('Engine is not loaded yet.');
  if (typeof core.setTimeout === 'function') core.setTimeout(-1);
  core.exec.apply(core, args);
  const ret = core.ret;
  core.reset();
  return ret;
}

async function runCapture(args) {
  let stdout = [];
  const onLog = ({ type, message }) => {
    if (type === 'stdout') stdout.push(message);
  };
  core.setLogger(onLog);
  try {
    runCommand(args);
  } finally {
    core.setLogger(({ type, message }) => {
      post('log', { id: currentId, type, message });
    });
  }
  return stdout.join('\n');
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
    if (!core) throw new Error('Engine is not loaded yet.');
    currentId = msg.id;
    const inPath = 'in_' + msg.id + '.' + msg.ext;
    const outPath = 'out_' + msg.id + '.' + msg.outExt;
    try {
      core.FS.writeFile(inPath, new Uint8Array(msg.data));
      const ret = runCommand(msg.args);
      if (ret !== 0) {
        throw new Error('FFmpeg exited with code ' + ret + ' - the input may use an unsupported codec.');
      }
      const out = core.FS.readFile(outPath, { encoding: 'binary' });
      const bytes = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
      post('done', { id: msg.id, data: bytes }, [bytes]);
    } finally {
      try { core.FS.deleteFile(inPath); } catch (e) { /* ignore */ }
      try { core.FS.deleteFile(outPath); } catch (e) { /* ignore */ }
    }
    currentId = null;
    return;
  }

  if (msg.type === 'ping') {
    post('pong');
    return;
  }
}

// The core is a singleton, so commands must run one at a time.
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