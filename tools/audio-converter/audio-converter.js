/**
 * audio-converter.js - Westcrest Media
 * Main logic for the Audio Converter tool.
 *
 * Architecture:
 *   - audio-converter.worker.js runs FFmpeg (WebAssembly) off the UI thread.
 *   - Engine + core (~33MB) load lazily from jsDelivr on first conversion,
 *     are cached in memory, and reused for the whole session.
 *   - Capability registry is enforced twice: a verified static matrix and a
 *     runtime re-check (worker runs 'ffmpeg -encoders' / '-formats'), so the
 *     UI only ever offers formats the engine genuinely supports.
 *
 * Environment: module script loaded on the tool page. Pure static site, no
 * build step - the worker is a sibling file resolved via import.meta.url.
 */

window.AudioConverter = (() => {
  'use strict';

  /* ---------------------------- CONSTANTS ---------------------------- */

  const MAX_FILES = 20;
  const MAX_SIZE_MB = 100;
  const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
  const WORKER_URL = new URL('audio-converter.worker.js', import.meta.url).href;
  const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

  // Verified against @ffmpeg/core@0.12.10 (configure banner + ffmpeg.wasm docs):
  //   --enable-gpl --enable-libmp3lame --enable-libvorbis --enable-libopus
  //   (libwavpack / libfdk_aac are NOT compiled in; excluded deliberately.)
  // Native encoders present: aac, alac, ac3, amr_nb, flac, wmav2, tta, pcm_*.
  const FORMATS = [
    {
      id: 'mp3', label: 'MP3', ext: 'mp3', kind: 'lossy', maxSampleRate: 48000,
      desc: 'MPEG Layer 3 - universal compatibility',
      presets: [
        { id: 'mp3-96',   label: '96 kbps',  hint: 'Compact - podcasts & voice',       codec: ['-c:a', 'libmp3lame', '-b:a', '96k', '-id3v2_version', '3'] },
        { id: 'mp3-128',  label: '128 kbps', hint: 'Standard MP3 quality',             codec: ['-c:a', 'libmp3lame', '-b:a', '128k', '-id3v2_version', '3'] },
        { id: 'mp3-192',  label: '192 kbps', hint: 'Good quality - most listeners',    codec: ['-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3'] },
        { id: 'mp3-256',  label: '256 kbps', hint: 'High quality',                     codec: ['-c:a', 'libmp3lame', '-b:a', '256k', '-id3v2_version', '3'] },
        { id: 'mp3-320',  label: '320 kbps', hint: 'Maximum MP3 quality',              codec: ['-c:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '3'] },
        { id: 'mp3-v0',   label: 'VBR V0',   hint: 'VBR ~245kbps - best MP3 quality',  codec: ['-c:a', 'libmp3lame', '-q:a', '0', '-id3v2_version', '3'] },
        { id: 'mp3-v2',   label: 'VBR V2',   hint: 'VBR ~190kbps - excellent',         codec: ['-c:a', 'libmp3lame', '-q:a', '2', '-id3v2_version', '3'] },
        { id: 'mp3-v4',   label: 'VBR V4',   hint: 'VBR ~165kbps - great size',        codec: ['-c:a', 'libmp3lame', '-q:a', '4', '-id3v2_version', '3'] },
      ],
    },
    {
      id: 'aac', label: 'AAC', ext: 'aac', kind: 'lossy', maxSampleRate: 96000,
      desc: 'AAC in ADTS container (.aac)',
      presets: [
        { id: 'aac-96',  label: '96 kbps',  hint: 'Compact',         codec: ['-c:a', 'aac', '-b:a', '96k'] },
        { id: 'aac-128', label: '128 kbps', hint: 'Standard',        codec: ['-c:a', 'aac', '-b:a', '128k'] },
        { id: 'aac-192', label: '192 kbps', hint: 'Good quality',    codec: ['-c:a', 'aac', '-b:a', '192k'] },
        { id: 'aac-256', label: '256 kbps', hint: 'High quality',    codec: ['-c:a', 'aac', '-b:a', '256k'] },
        { id: 'aac-320', label: '320 kbps', hint: 'Maximum quality', codec: ['-c:a', 'aac', '-b:a', '320k'] },
      ],
    },
    {
      id: 'm4a', label: 'M4A', ext: 'm4a', kind: 'lossy', maxSampleRate: 96000,
      desc: 'AAC in MP4 (.m4a) - iTunes / Apple friendly',
      presets: [
        { id: 'm4a-128', label: '128 kbps', hint: 'Standard',        codec: ['-c:a', 'aac', '-b:a', '128k'] },
        { id: 'm4a-192', label: '192 kbps', hint: 'Good quality',    codec: ['-c:a', 'aac', '-b:a', '192k'] },
        { id: 'm4a-256', label: '256 kbps', hint: 'High quality',    codec: ['-c:a', 'aac', '-b:a', '256k'] },
        { id: 'm4a-320', label: '320 kbps', hint: 'Maximum quality', codec: ['-c:a', 'aac', '-b:a', '320k'] },
      ],
    },
    {
      id: 'alac', label: 'ALAC', ext: 'm4a', kind: 'lossless', maxSampleRate: 192000,
      desc: 'Apple Lossless in .m4a - lossless',
      presets: [
        { id: 'alac-0', label: 'Lossless', hint: 'Perfect quality - larger files', codec: ['-c:a', 'alac'] },
      ],
    },
    {
      id: 'opus', label: 'Opus', ext: 'opus', kind: 'lossy', maxSampleRate: 48000,
      desc: 'Opus - best modern compression',
      presets: [
        { id: 'opus-64',  label: '64 kbps',  hint: 'Very compact', codec: ['-c:a', 'libopus', '-b:a', '64k'] },
        { id: 'opus-96',  label: '96 kbps',  hint: 'Good',         codec: ['-c:a', 'libopus', '-b:a', '96k'] },
        { id: 'opus-128', label: '128 kbps', hint: 'High quality', codec: ['-c:a', 'libopus', '-b:a', '128k'] },
        { id: 'opus-160', label: '160 kbps', hint: 'Very high',    codec: ['-c:a', 'libopus', '-b:a', '160k'] },
        { id: 'opus-192', label: '192 kbps', hint: 'Maximum',      codec: ['-c:a', 'libopus', '-b:a', '192k'] },
      ],
    },
    {
      id: 'ogg', label: 'OGG', ext: 'ogg', kind: 'lossy', maxSampleRate: 48000,
      desc: 'Vorbis in OGG - open & widely supported',
      presets: [
        { id: 'ogg-q3', label: 'Q3', hint: 'Compact - ~112kbps avg', codec: ['-c:a', 'libvorbis', '-q:a', '3'] },
        { id: 'ogg-q5', label: 'Q5', hint: 'Standard - ~160kbps avg', codec: ['-c:a', 'libvorbis', '-q:a', '5'] },
        { id: 'ogg-q7', label: 'Q7', hint: 'High - ~192kbps avg',     codec: ['-c:a', 'libvorbis', '-q:a', '7'] },
        { id: 'ogg-q9', label: 'Q9', hint: 'Maximum - ~224kbps avg',  codec: ['-c:a', 'libvorbis', '-q:a', '9'] },
      ],
    },
    {
      id: 'flac', label: 'FLAC', ext: 'flac', kind: 'lossless', maxSampleRate: 192000,
      desc: 'Free Lossless Audio Codec',
      presets: [
        { id: 'flac-0', label: 'Fast',     hint: 'Compression 0 - fastest', codec: ['-c:a', 'flac', '-compression_level', '0'] },
        { id: 'flac-5', label: 'Standard', hint: 'Compression 5 - balanced', codec: ['-c:a', 'flac', '-compression_level', '5'] },
        { id: 'flac-8', label: 'Max',      hint: 'Compression 8 - smallest', codec: ['-c:a', 'flac', '-compression_level', '8'] },
      ],
    },
    {
      id: 'wav', label: 'WAV', ext: 'wav', kind: 'lossless', maxSampleRate: 192000,
      desc: 'PCM in WAV - studio / edit friendly',
      presets: [
        { id: 'wav-16',  label: '16-bit',     hint: 'CD quality PCM',         codec: ['-c:a', 'pcm_s16le'] },
        { id: 'wav-24',  label: '24-bit',     hint: 'Studio quality PCM',     codec: ['-c:a', 'pcm_s24le'] },
        { id: 'wav-32f', label: '32-bit float', hint: 'Best editing headroom', codec: ['-c:a', 'pcm_f32le'] },
      ],
    },
    {
      id: 'aiff', label: 'AIFF', ext: 'aiff', kind: 'lossless', maxSampleRate: 192000,
      desc: 'PCM in AIFF - Apple / classical producers',
      presets: [
        { id: 'aiff-16', label: '16-bit', hint: 'CD quality PCM',     codec: ['-c:a', 'pcm_s16be'] },
        { id: 'aiff-24', label: '24-bit', hint: 'Studio quality PCM', codec: ['-c:a', 'pcm_s24be'] },
      ],
    },
    {
      id: 'mka', label: 'MKA', ext: 'mka', kind: 'lossless', maxSampleRate: 192000,
      desc: 'Matroska audio container - keep any codec, fast',
      presets: [
        { id: 'mka-flac', label: 'FLAC in MKA', hint: 'Lossless re-encode - universal', codec: ['-c:a', 'flac'] },
        { id: 'mka-copy', label: 'Stream copy', hint: 'No re-encode - instant',         codec: ['-c:a', 'copy'], streamCopy: true },
      ],
    },
    {
      id: 'wma', label: 'WMA', ext: 'wma', kind: 'lossy', maxSampleRate: 48000,
      desc: 'Windows Media Audio 2 (.asf)',
      presets: [
        { id: 'wma-96',  label: '96 kbps',  hint: 'Compact',      codec: ['-c:a', 'wmav2', '-b:a', '96k'] },
        { id: 'wma-128', label: '128 kbps', hint: 'Standard',     codec: ['-c:a', 'wmav2', '-b:a', '128k'] },
        { id: 'wma-192', label: '192 kbps', hint: 'Good quality', codec: ['-c:a', 'wmav2', '-b:a', '192k'] },
        { id: 'wma-256', label: '256 kbps', hint: 'High quality', codec: ['-c:a', 'wmav2', '-b:a', '256k'] },
      ],
    },
    {
      id: 'ac3', label: 'AC3', ext: 'ac3', kind: 'lossy', maxSampleRate: 48000,
      desc: 'Dolby Digital - home theatre / discs',
      presets: [
        { id: 'ac3-192', label: '192 kbps', hint: 'Compact',      codec: ['-c:a', 'ac3', '-b:a', '192k'] },
        { id: 'ac3-384', label: '384 kbps', hint: 'Standard',     codec: ['-c:a', 'ac3', '-b:a', '384k'] },
        { id: 'ac3-448', label: '448 kbps', hint: 'High quality', codec: ['-c:a', 'ac3', '-b:a', '448k'] },
        { id: 'ac3-640', label: '640 kbps', hint: 'Maximum',      codec: ['-c:a', 'ac3', '-b:a', '640k'] },
      ],
    },
    {
      id: 'amr', label: 'AMR', ext: 'amr', kind: 'lossy', maxSampleRate: 8000,
      desc: 'AMR-NB - 8kHz mono, legacy & embedded',
      forceProps: { sampleRate: 8000, channels: 1 },
      presets: [
        { id: 'amr-122', label: '12.2 kbps', hint: 'Maximum AMR-NB rate', codec: ['-c:a', 'amr_nb', '-b:a', '12.2k', '-ar', '8000', '-ac', '1'] },
      ],
    },
    {
      id: 'tta', label: 'TTA', ext: 'tta', kind: 'lossless', maxSampleRate: 96000,
      desc: 'True Audio - lossless, open source',
      presets: [
        { id: 'tta-0', label: 'Lossless', hint: 'Stay true (pun intended)', codec: ['-c:a', 'tta'] },
      ],
    },
  ];

  // Input extensions the engine's demuxers/decoders cover (broad set).
  const INPUT_EXTS = new Set([
    'mp3', 'mp2', 'mp1', 'wav', 'flac', 'aac', 'm4a', 'm4b', 'm4r', 'alac',
    'ogg', 'oga', 'opus', 'wma', 'wv', 'ape', 'ac3', 'eac3', 'dts', 'amr',
    'aiff', 'aif', 'aifc', 'caf', 'mka', 'gsm', 'webm', '3gp', '3g2', 'ra',
    'rm', 'tak', 'tta', 'shn', 'w64', 'voc', 'spx', 'au', 'mpc',
  ]);

  const STATUS = { QUEUED: 'queued', CONVERTING: 'converting', DONE: 'done', ERROR: 'error' };

  /* ------------------------------ STATE ------------------------------ */

  const state = {
    files: [],               // { id, file, name, base, ext, size, status, progress, outputName, blob, error, outExt }
    formatId: 'mp3',
    presetId: 'mp3-192',
    engineReady: false,
    engineLoading: false,
    capabilities: null,      // { encoders: [], muxers: [] } after worker enumeration
    worker: null,
    workerError: '',         // non-empty when the last worker attempt failed
    enginePhase: '',         // 'core' | 'wasm' | 'start' | 'ready' while loading
    engineFailMsg: '',       // concrete engine startup error (if any)
    busy: false,             // a conversion job is in flight
    zipName: 'audio-converted.zip',
  };

  let dom = {};

  function byId(id) { return document.getElementById(id); }

  /* ------------------------------ HELPERS ------------------------------ */

  function getFormat(id) { return FORMATS.find((f) => f.id === id) || FORMATS[0]; }
  function getPreset(fmt, pid) { return (fmt.presets.find((p) => p.id === pid)) || fmt.presets[0]; }

  function formatBytes(n) {
    if (n == null || isNaN(n)) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return v.toFixed(v >= 10 || i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function sanitizeBase(name) {
    const base = String(name || '').replace(/\.[^.]+$/, '');
    const clean = base.replace(/[\\/:*?"<>|]/g, '_').trim();
    return clean || 'audio';
  }

  function extOf(name) {
    const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function isConvertible(name) {
    return INPUT_EXTS.has(extOf(name));
  }

/* --------------------------- WORKER / ENGINE --------------------------- */

  let engineWaiters = [];

  function ensureWorker() {
    // A worker that hit an unrecoverable error is dead — always rebuild it
    // so the next attempt starts fresh instead of hanging forever.
    if (state.worker && !state.workerError) return state.worker;
    state.worker = null;
    let w;
    try {
      w = new Worker(WORKER_URL, { type: 'module' });
    } catch (err) {
      state.workerError = String((err && err.message) || err);
      workerError(state.workerError);
      throw err;
    }
    state.worker = w;
    state.workerError = '';
    w.addEventListener('message', onWorkerMessage);
    w.addEventListener('error', (e) => {
      const why = (e && e.message) || 'Worker load failed.';
      const where = (e && e.filename) ? ' [' + e.filename + ']' : '';
      workerError(why + where);
    });
    w.addEventListener('messageerror', () => {
      workerError('The conversion engine returned an unparseable message.');
    });
    return w;
  }

  // Fail all pending engine waits with a concrete reason so the user sees the
  // actual error instead of waiting for a blind 120s timeout.
  function workerError(message) {
    state.workerError = message;
    hideEngineOverlay();
    if (loadWatchdog) { clearTimeout(loadWatchdog); loadWatchdog = 0; }
    if (state.engineLoading) {
      state.engineLoading = false;
      const ws = engineWaiters;
      engineWaiters = [];
      ws.forEach((w) => w.reject(new Error(message)));
    }
    setStatusHint(message);
  }

  function onWorkerMessage(e) {
    const msg = e.data || {};
    switch (msg.type) {
      case 'load-progress':
        setEngineLoadProgress(msg.pct);
        if (msg.phase) {
          state.enginePhase = msg.phase;
          updateEngineSub(msg.phase);
        }
        armLoadWatchdog();
        break;
      case 'ready':
        state.engineReady = true;
        state.engineLoading = false;
        if (loadWatchdog) { clearTimeout(loadWatchdog); loadWatchdog = 0; }
        hideEngineOverlay();
        resolveEngineWaiters();
        break;
      case 'capabilities':
        state.capabilities = msg;
        applyCapabilities();
        break;
      case 'log':
        // Useful for debugging; not surfaced to users.
        break;
      case 'progress': {
        const f = findFile(msg.id);
        if (f && f.status === STATUS.CONVERTING) {
          const pct = Math.max(0, Math.min(0.98, Number(msg.progress) || 0));
          f.progress = pct;
          renderFileItem(f);
        }
        break;
      }
      case 'done': {
        const f = findFile(msg.id);
        if (!f) return;
        f.status = STATUS.DONE;
        f.progress = 1;
        f.blob = new Blob([msg.data], { type: 'audio/' + (f.outExt || getFormat(state.formatId).ext) });
        f.outputName = f.base + '.' + (f.outExt || getFormat(state.formatId).ext);
        renderFileItem(f);
        state.busy = false;
        updateActionBar();
        processQueue();
        break;
      }
      case 'engine-fail':
        state.engineFailMsg = msg.message || 'Engine failed to start.';
        failEngineLoad(state.engineFailMsg);
        break;
      case 'error': {
        if (msg.id != null) {
          const f = findFile(msg.id);
          if (f) {
            f.status = STATUS.ERROR;
            f.progress = 0;
            f.error = msg.message || 'Conversion failed';
            renderFileItem(f);
          }
          state.busy = false;
          updateActionBar();
        } else {
          hideEngineOverlay();
          if (state.engineLoading) {
            state.engineLoading = false;
            const ws = engineWaiters;
            engineWaiters = [];
            ws.forEach((w) => w.reject(new Error(msg.message || 'Engine load failed')));
          }
          setStatusHint(state.engineFailMsg || 'Could not load the conversion engine. Check your connection and try again.');
          state.engineFailMsg = '';
        }
        processQueue();
        break;
      }
      case 'pong':
        break;
    }
  }

  function findFile(id) { return state.files.find((f) => f.id === id); }

  function ensureEngineReady() {
    return new Promise((resolve, reject) => {
      if (state.engineReady) { resolve(); return; }
      if (state.engineLoading) { engineWaiters.push({ resolve, reject }); return; }
      state.engineLoading = true;
      engineWaiters.push({ resolve, reject });
      state.enginePhase = 'core';
      state.engineFailMsg = '';
      showEngineOverlay();
      const w = ensureWorker();
      w.postMessage({ type: 'load' });
      // Activity watchdog: as long as load-progress messages keep arriving the
      // timer keeps resetting, so a slow (but progressing) download never trips
      // it. Only a genuine stall or a very slow engine start fails it.
      armLoadWatchdog();
    });
  }

  let loadWatchdog = 0;
  const WATCHDOG_MS = 90000;

  function armLoadWatchdog() {
    if (loadWatchdog) clearTimeout(loadWatchdog);
    loadWatchdog = setTimeout(() => {
      loadWatchdog = 0;
      if (state.engineReady || !state.engineLoading) return;
      const why = state.workerError
        ? 'Engine error: ' + state.workerError
        : state.enginePhase === 'start'
          ? 'The engine took too long to start on this device. Refresh and try again.'
          : 'The engine download stalled while fetching part ' +
            (state.enginePhase === 'wasm' ? '2/2' : '1/2') +
            '. The next attempt tries a different server automatically.';
      failEngineLoad(why);
    }, WATCHDOG_MS);
  }

  function failEngineLoad(message) {
    hideEngineOverlay();
    if (!state.engineLoading) return;
    state.engineLoading = false;
    if (loadWatchdog) { clearTimeout(loadWatchdog); loadWatchdog = 0; }
    const ws = engineWaiters;
    engineWaiters = [];
    ws.forEach((w) => w.reject(new Error(message)));
    setStatusHint(message);
  }

  function resolveEngineWaiters() {
    const ws = engineWaiters;
    engineWaiters = [];
    ws.forEach((w) => w.resolve());
  }

  function requestCapabilities() {
    if (state.worker && !state.capabilities) {
      state.worker.postMessage({ type: 'capabilities' });
    }
  }

  /* -------------------------- CAPABILITY GATING -------------------------- */

  // The container ffmpeg writes for each output extension (muxer names).
  const MUXER_BY_EXT = {
    mp3: 'mp3', aac: 'adts', m4a: 'ipod', opus: 'opus', ogg: 'ogg',
    flac: 'flac', wav: 'wav', aiff: 'aiff', mka: 'matroska',
    wma: 'asf', ac3: 'ac3', amr: 'amr', tta: 'tta',
  };

  function applyCapabilities() {
    if (!state.capabilities) return;
    const encoders = new Set(state.capabilities.encoders || []);
    const muxers = new Set(state.capabilities.muxers || []);
    let any = false;
    FORMATS.forEach((fmt) => {
      const muxOk = muxers.has(MUXER_BY_EXT[fmt.ext] || fmt.ext);
      const encOk = fmt.presets.every((p) => {
        if (!p.codec) return false;
        const i = p.codec.indexOf('-c:a');
        const enc = i >= 0 ? p.codec[i + 1] : null;
        return enc == null || enc === 'copy' || encoders.has(enc);
      });
      fmt._supported = encOk && muxOk;
      any = any || fmt._supported;
    });
    if (!any) {
      // Extremely unlikely with this build; degrade gracefully.
      FORMATS.forEach((f) => { f._supported = true; });
    }
    renderFormatGrid();
    renderQualityPresets();
  }

  function fmtSupported(fmt) { return fmt._supported !== false; }

/* ------------------------------ UI RENDER ------------------------------ */

  function renderFormatGrid() {
    if (!dom.formatGrid) return;
    dom.formatGrid.innerHTML = '';
    FORMATS.forEach((fmt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'format-chip' + (fmt.id === state.formatId ? ' is-active' : '');
      b.dataset.format = fmt.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', fmt.id === state.formatId ? 'true' : 'false');
      b.textContent = fmt.label;
      if (!fmtSupported(fmt)) b.disabled = true;
      dom.formatGrid.appendChild(b);
    });
    const active = getFormat(state.formatId);
    dom.formatCapability.textContent = active.desc + (active.kind === 'lossless' ? ' - lossless' : ' - lossy');
  }

  function renderQualityPresets() {
    if (!dom.qualityPresets) return;
    const fmt = getFormat(state.formatId);
    if (!fmt.presets.some((p) => p.id === state.presetId)) {
      state.presetId = fmt.presets[0].id;
    }
    dom.qualityPresets.innerHTML = '';
    fmt.presets.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quality-preset' + (p.id === state.presetId ? ' is-active' : '');
      b.dataset.preset = p.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', p.id === state.presetId ? 'true' : 'false');
      b.textContent = p.label;
      dom.qualityPresets.appendChild(b);
    });
    const active = getPreset(fmt, state.presetId);
    dom.qualityHint.textContent = active.hint || '';
  }

  function fileItemInnerHTML(f) {
    const sizeStr = formatBytes(f.size);
    const outStr = f.blob ? formatBytes(f.blob.size) : '-';
    const badge = {
      [STATUS.QUEUED]: '<span class="file-status status-pending">Queued</span>',
      [STATUS.CONVERTING]: '<span class="file-status status-converting"><span class="spinner"></span>Converting</span>',
      [STATUS.DONE]: '<span class="file-status status-done">Done</span>',
      [STATUS.ERROR]: '<span class="file-status status-error">Failed</span>',
    }[f.status];

    const progress = f.status === STATUS.CONVERTING || f.status === STATUS.DONE
      ? Math.round((f.progress || 0) * 100) + '%'
      : '';

    const actions = f.status === STATUS.DONE
      ? '<button type="button" class="dl-btn" data-act="dl" data-id="' + f.id + '">Download</button>'
      : '';

    const err = f.status === STATUS.ERROR
      ? '<div class="file-item__errmsg" data-act="err">' + escapeHtml(f.error || 'Unknown error') + '</div>'
      : '';

    return '' +
      '<div class="file-thumb" aria-hidden="true">🎵</div>' +
      '<div class="file-info">' +
        '<div class="file-name">' + escapeHtml(f.name) + '</div>' +
        '<div class="file-meta">' +
          '<span>' + sizeStr + '</span>' +
          '<span>to ' + (f.status === STATUS.DONE ? escapeHtml(f.outputName) : (f.outLabel || getFormat(state.formatId).label)) + '</span>' +
          (f.status === STATUS.DONE ? '<span>' + outStr + '</span>' : '') +
          (progress ? '<span>' + progress + '</span>' : '') +
        '</div>' +
        err +
      '</div>' +
      actions +
      '<button type="button" class="remove-btn" data-act="rm" data-id="' + f.id + '" aria-label="Remove file">✕</button>' +
      '<div class="file-item__progress" style="width:' + (f.status === STATUS.CONVERTING || f.status === STATUS.DONE ? Math.round((f.progress || 0) * 100) : 0) + '%"></div>';
  }

  function renderFileItem(f) {
    if (!dom.fileList) return;
    const el = document.querySelector('#file-list [data-file-id="' + f.id + '"]');
    if (!el) return;
    el.className = 'file-item' + (f.status === STATUS.DONE ? ' is-done' : '') + (f.status === STATUS.ERROR ? ' is-error' : '');
    el.innerHTML = fileItemInnerHTML(f);
  }

  function renderFileList() {
    if (!dom.fileList) return;
    dom.fileList.innerHTML = '';
    const has = state.files.length > 0;
    dom.fileList.hidden = !has;
    if (dom.emptyState) dom.emptyState.style.display = has ? 'none' : '';
    state.files.forEach((f) => {
      const el = document.createElement('div');
      el.className = 'file-item' + (f.status === STATUS.DONE ? ' is-done' : '') + (f.status === STATUS.ERROR ? ' is-error' : '');
      el.dataset.fileId = f.id;
      el.innerHTML = fileItemInnerHTML(f);
      dom.fileList.appendChild(el);
    });
    updateActionBar();
  }

  function updateActionBar() {
    if (!dom.convertAll) return;
    const pending = state.files.filter((f) => f.status !== STATUS.DONE && f.status !== STATUS.CONVERTING);
    const anyDone = state.files.some((f) => f.status === STATUS.DONE);
    dom.convertAll.disabled = pending.length === 0 || state.busy;
    dom.convertAll.textContent = state.busy ? 'Converting...' : pending.length ? 'Convert (' + pending.length + ')' : 'Convert All';
    dom.downloadAll.disabled = !anyDone;
    dom.clearAll.disabled = state.busy;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ------------------------------ ENGINE OVERLAY ------------------------------ */

  function showEngineOverlay() {
    if (dom.overlay) {
      dom.overlay.hidden = false;
      dom.overlayPct.textContent = '0%';
      dom.overlayBar.style.width = '0%';
    }
  }

  function hideEngineOverlay() {
    if (dom.overlay) dom.overlay.hidden = true;
  }

  function setEngineLoadProgress(pct) {
    if (!dom.overlay) return;
    const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    dom.overlayPct.textContent = p + '%';
    dom.overlayBar.style.width = p + '%';
  }

  function updateEngineSub(phase) {
    if (!dom.overlaySub) return;
    const labels = {
      core: 'Loading the FFmpeg engine — part 1/2 (JS)...',
      wasm: 'Loading the FFmpeg engine — part 2/2 (~31MB WASM, first time only)...',
      start: 'Engine downloaded. Starting it up...',
      ready: 'Engine ready.',
    };
    if (labels[phase]) dom.overlaySub.textContent = labels[phase];
  }

/* ------------------------------ FILE HANDLING ------------------------------ */

  let idCounter = 0;
  function nextId() { return 'f' + (++idCounter) + '_' + Date.now().toString(36); }

  function addFiles(fileList) {
    const items = Array.from(fileList || []).filter((f) => f && f.name);
    const accepted = [];
    const rejected = [];
    items.forEach((f) => {
      if (!isConvertible(f.name)) { rejected.push({ name: f.name, reason: 'Unsupported file type' }); return; }
      if (f.size > MAX_BYTES) { rejected.push({ name: f.name, reason: 'Bigger than 100MB' }); return; }
      accepted.push(f);
    });
    const room = MAX_FILES - state.files.length;
    if (room <= 0) {
      setStatusHint('You can add up to ' + MAX_FILES + ' files at once. Remove some to continue.');
      return;
    }
    accepted.slice(0, room).forEach((f) => {
      state.files.push({
        id: nextId(),
        file: f,
        name: f.name,
        base: sanitizeBase(f.name),
        ext: extOf(f.name),
        size: f.size,
        status: STATUS.QUEUED,
        progress: 0,
        blob: null,
        outputName: '',
        error: '',
      });
    });
    if (accepted.length > room) {
      rejected.push({ name: '...and ' + (accepted.length - room) + ' more', reason: 'Max ' + MAX_FILES + ' files' });
    }
    renderFileList();
    if (rejected.length) {
      setStatusHint((rejected[0].name || 'Some files') + ' skipped - ' + rejected[0].reason + (rejected.length > 1 ? ' (+' + (rejected.length - 1) + ' more).' : '.'));
    } else {
      setStatusHint('');
    }
  }

  function removeFile(id) {
    const f = findFile(id);
    if (!f) return;
    if (f.status === STATUS.CONVERTING) return;
    state.files = state.files.filter((x) => x.id !== id);
    renderFileList();
  }

  function clearAll() {
    if (state.busy) return;
    state.files = [];
    renderFileList();
  }

  /* ------------------------------ CONVERSION ------------------------------ */

  function buildArgs(f, fmt, preset) {
    const args = ['-i', 'in_' + f.id + '.' + f.ext];
    if (dom.keepMetadata.checked) args.push('-map_metadata', '0');
    let sr = Number(dom.sampleRate.value) || 0;
    let ch = Number(dom.channels.value) || 0;
    if (fmt.forceProps) {
      sr = fmt.forceProps.sampleRate || sr;
      ch = fmt.forceProps.channels || ch;
    }
    if (fmt.maxSampleRate && sr > fmt.maxSampleRate) sr = fmt.maxSampleRate;
    if (sr > 0) args.push('-ar', String(sr));
    if (ch > 0) args.push('-ac', String(ch));
    args.push('-map', '0:a', '-vn');
    if (dom.normalizeVolume.checked && !preset.streamCopy) {
      args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
    }
    args.push.apply(args, preset.codec);
    args.push('-y', 'out_' + f.id + '.' + fmt.ext);
    return args;
  }

  function convertOne(f, fmt, preset) {
    f.status = STATUS.CONVERTING;
    f.progress = 0;
    f.error = '';
    f.outExt = fmt.ext;
    f.outLabel = fmt.label;
    renderFileItem(f);
    state.busy = true;
    updateActionBar();
    ensureEngineReady()
      .then(async () => {
        requestCapabilities();
        const data = await f.file.arrayBuffer();
        ensureWorker().postMessage({
          type: 'convert',
          id: f.id,
          ext: f.ext,
          outExt: fmt.ext,
          data,
          args: buildArgs(f, fmt, preset),
        }, [data]);
      })
      .catch((err) => {
        f.status = STATUS.ERROR;
        f.progress = 0;
        f.error = String((err && err.message) || err);
        renderFileItem(f);
        state.busy = false;
        updateActionBar();
        processQueue();
      });
  }

  function processQueue() {
    if (state.busy) return;
    const fmt = getFormat(state.formatId);
    if (!fmtSupported(fmt)) {
      setStatusHint('The selected output format is not available. Pick another and try again.');
      return;
    }
    const preset = getPreset(fmt, state.presetId);
    const next = state.files.find((f) => f.status === STATUS.QUEUED);
    if (!next) {
      state.busy = false;
      updateActionBar();
      return;
    }
    convertOne(next, fmt, preset);
  }

  function convertAll() {
    if (state.busy) return;
    const fmt = getFormat(state.formatId);
    if (!fmtSupported(fmt)) {
      setStatusHint('The selected output format is not available on this device yet. Choose another.');
      return;
    }
    const pending = state.files.filter((f) => f.status === STATUS.QUEUED || f.status === STATUS.ERROR);
    if (!pending.length) return;
    pending.forEach((f) => {
      if (f.status === STATUS.ERROR) { f.status = STATUS.QUEUED; f.progress = 0; f.error = ''; renderFileItem(f); }
    });
    processQueue();
  }

/* ------------------------------ DOWNLOADS ------------------------------ */

  function downloadFile(id) {
    const f = findFile(id);
    if (!f || !f.blob) return;
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.outputName || (f.base + '.' + getFormat(state.formatId).ext);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function loadJSZip() {
    return new Promise((resolve, reject) => {
      if (window.JSZip) { resolve(window.JSZip); return; }
      const s = document.createElement('script');
      s.src = JSZIP_URL;
      s.async = true;
      s.onload = () => (window.JSZip ? resolve(window.JSZip) : reject(new Error('JSZip failed to load.')));
      s.onerror = () => reject(new Error('JSZip failed to load (network).'));
      document.head.appendChild(s);
    });
  }

  async function downloadAllZip() {
    const done = state.files.filter((f) => f.status === STATUS.DONE && f.blob);
    if (!done.length) return;
    setStatusHint('Zipping your files...');
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const used = new Set();
      done.forEach((f) => {
        let name = f.outputName || (f.base + '.' + getFormat(state.formatId).ext);
        let k = name;
        let i = 2;
        while (used.has(k)) { k = name.replace(/\.[^.]+$/, '') + ' (' + i + ').' + extOf(name); i++; }
        used.add(k);
        zip.file(k, f.blob);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setStatusHint('');
    } catch (err) {
      setStatusHint('Could not create the ZIP archive. Download files individually instead.');
    }
  }

/* ------------------------------ STATUS HINT ------------------------------ */

  function setStatusHint(msg) {
    if (dom.statusHint) dom.statusHint.textContent = msg || '';
  }

  /* ------------------------- SETTINGS CHANGE HANDLING ------------------------- */

  // After output settings change, previously finished results are stale.
  function resetDoneForChanges() {
    let changed = false;
    state.files.forEach((f) => {
      if (f.status === STATUS.DONE) {
        f.status = STATUS.QUEUED;
        f.progress = 0;
        f.blob = null;
        f.error = '';
        changed = true;
      }
    });
    if (changed) renderFileList();
  }

  /* ------------------------------ EVENTS / INIT ------------------------------ */

  function bindDropZone() {
    const zone = dom.dropZone;
    const input = dom.fileInput;
    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      input.click();
    });

    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    ['dragenter', 'dragover'].forEach((type) => {
      zone.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((type) => {
      zone.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
      });
    });

    zone.addEventListener('drop', (e) => {
      const files = e.dataTransfer ? e.dataTransfer.files : [];
      if (files && files.length) addFiles(files);
    });

    zone.addEventListener('paste', (e) => {
      const files = e.clipboardData ? e.clipboardData.files : [];
      if (files && files.length) addFiles(files);
    });
  }

  function bindControls() {
    if (dom.fileInput) {
      dom.fileInput.addEventListener('change', () => {
        if (dom.fileInput.files && dom.fileInput.files.length) {
          addFiles(dom.fileInput.files);
        }
        dom.fileInput.value = '';
      });
    }

    if (dom.formatGrid) {
      dom.formatGrid.addEventListener('click', (e) => {
        const b = e.target.closest('.format-chip');
        if (!b || b.disabled) return;
        state.formatId = b.dataset.format;
        renderFormatGrid();
        renderQualityPresets();
        resetDoneForChanges();
      });
    }

    if (dom.qualityPresets) {
      dom.qualityPresets.addEventListener('click', (e) => {
        const b = e.target.closest('.quality-preset');
        if (!b) return;
        state.presetId = b.dataset.preset;
        renderQualityPresets();
        resetDoneForChanges();
      });
    }

    ['sampleRate', 'channels', 'keepMetadata', 'normalizeVolume'].forEach((key) => {
      const el = dom[key];
      if (el) el.addEventListener('change', resetDoneForChanges);
    });
  }

  function bindFileList() {
    if (!dom.fileList) return;
    dom.fileList.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act || !act.dataset.id) return;
      if (act.dataset.act === 'rm') removeFile(act.dataset.id);
      if (act.dataset.act === 'dl') downloadFile(act.dataset.id);
    });
  }

  function bindActions() {
    if (dom.convertAll) dom.convertAll.addEventListener('click', convertAll);
    if (dom.downloadAll) dom.downloadAll.addEventListener('click', downloadAllZip);
    if (dom.clearAll) dom.clearAll.addEventListener('click', clearAll);
  }

  function init() {
    dom = {
      dropZone: byId('drop-zone'),
      fileInput: byId('file-input'),
      formatGrid: byId('format-grid'),
      formatCapability: byId('format-capability'),
      qualityPresets: byId('quality-presets'),
      qualityHint: byId('quality-hint'),
      sampleRate: byId('sample-rate'),
      channels: byId('channels'),
      keepMetadata: byId('keep-metadata'),
      normalizeVolume: byId('normalize-volume'),
      fileList: byId('file-list'),
      emptyState: byId('empty-state'),
      convertAll: byId('convert-all'),
      downloadAll: byId('download-all'),
      clearAll: byId('clear-all'),
      statusHint: byId('status-hint'),
      overlay: byId('engine-overlay'),
      overlayPct: byId('engine-overlay__pct'),
      overlayBar: byId('engine-overlay__bar-inner'),
      overlaySub: byId('engine-overlay__sub'),
    };

    if (!dom.formatGrid) return;

    renderFormatGrid();
    renderQualityPresets();
    bindDropZone();
    bindControls();
    bindFileList();
    bindActions();

    // Warm up: spawn the worker thread early so the first conversion starts fast.
    // (The ~33MB engine itself still loads lazily on first convert.)
    setTimeout(() => {
      if (state.worker) return;
      try { ensureWorker(); } catch (e) { /* worker unavailable */ }
    }, 1200);
  }

  window.toggleFaq = (item) => {
    if (!item) return;
    const section = item.closest('.faq-section');
    const wasOpen = item.classList.contains('is-open');
    if (section) {
      section.querySelectorAll('.faq-item.is-open').forEach((el) => el.classList.remove('is-open'));
    }
    if (!wasOpen) item.classList.add('is-open');
  };

  let initialized = false;
  function start() {
    if (initialized) return;
    initialized = true;
    init();
  }

  // The module runs at the end of <body>, so the DOM is ready here. Auto-start,
  // and keep the onReady hook in __WM_TOOL__ working as a safety net (guarded).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  return { init: start };
})();
