/**
 * background-remover.js — Tool logic for AI Background Remover Pro
 * External deps: @imgly/background-removal (dynamic CDN import), JSZip (loaded via CDN <script> in HTML)
 * Shared compositing/effects/photo-search/export logic lives in /assets/js/wm-studio.js (single source of truth)
 */

import {
  loadImg,
  applyFeatherToCanvas,
  drawOutline,
  drawCompositeScene,
  buildExportCanvas,
  runPhotoSearch,
  applyPhotoBgGeneric,
  enhanceSliders,
} from '/assets/js/wm-studio.js';

/* ── AI MODEL LOADER ── */
const LIB_VERSION = '1.5.5';
let removeBackground = null;
async function loadLib() {
  if (removeBackground) return removeBackground;
  const mod = await import(`https://cdn.jsdelivr.net/npm/@imgly/background-removal@${LIB_VERSION}/+esm`);
  removeBackground = mod.removeBackground || mod.default || Object.values(mod).find(v=>typeof v==='function');
  if (!removeBackground) throw new Error('removeBackground not found');
  return removeBackground;
}

/* ── BATCH STATE ── */
const MAX_BATCH = 20;
let items = []; // { id, file, origBlob, resultCanvas, status, name, bgSnapshot }
let activeId = null;
let editorOpened = false; // once editor opens, never auto-open again
let batchLoopRunning = false; // hard lock — prevents two addFiles() calls from both starting a processing loop

/* ── EDITOR STATE ── */
let wCanvas = null, wCtx = null, origData = null;
let brushMode = null, isPainting = false;
window.brushSize = 20;
window.smartEdge = false;       // desktop smart-edge toggle
window.smartEdgeTol = 30;       // colour tolerance 0-100
const MAX_UNDO = 30;
let undoStack = [], redoStack = [];
let zoom = 1, panX = 0, panY = 0, isPanning = false, panStart = {x:0,y:0}, spaceDown = false;
let beforeAfterMode = false; // true = showing original "before" image
window._baMode = false;
let baseW = 0, baseH = 0;
let currentBgColor = 'transparent';
let currentPhotoBg = null; // { url, img }
let eventsReady = false;

// Shadow / blur state
let shadowEnabled = false;
let shadowColor = '#000000', shadowOpacity = 60, shadowBlur = 20, shadowDistance = 10, shadowAngle = 135;
let bgBlur = 0;

// Outline state
let outlineEnabled = false;
let outlineColor = '#ffffff', outlineWidth = 4;

// Glow state
let glowEnabled = false;
let glowColor = '#c8a96e', glowStrength = 60, glowBlur = 20;

// Feather state
let featherRadius = 0;

// Subject transform (independent of canvas zoom/pan)
let subjectScale = 1, subjectX = 0, subjectY = 0, subjectRotation = 0;
let flipX = false, flipY = false;
let isDraggingSubject = false, subjectDragStart = {x:0,y:0};

// Background photo transform
let bgScale = 1, bgOffsetX = 0, bgOffsetY = 0;

const viewport  = document.getElementById('canvas-viewport');
const dc        = document.getElementById('display-canvas');
const dctx      = dc.getContext('2d', { willReadFrequently:true });
const cc        = document.getElementById('cursor-canvas');
const cctx      = cc.getContext('2d');

/* ── FILE INPUT ── */
const fileIn   = document.getElementById('file-in');
const dropZone = document.getElementById('drop-zone');

fileIn.addEventListener('change', e => { if (e.target.files.length) addFiles(Array.from(e.target.files)); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/'));
  if (files.length) addFiles(files);
});
dropZone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileIn.click(); });

// ── Cross-tool connector adapter: loads an incoming file from another tool
// exactly like a normal upload — used by tool-connect.js for the
// "restore previous work" / "continue from another tool" banners.
window.WM_loadIncomingFile = async function(file) {
  await addFiles([file]);
};

/* ── ADD FILES ── */
function showUploadOverlay(title, sub) {
  document.getElementById('upload-overlay-title').textContent = title;
  document.getElementById('upload-overlay-sub').textContent = sub;
  document.getElementById('upload-overlay').classList.add('active');
}
function hideUploadOverlay() {
  document.getElementById('upload-overlay').classList.remove('active');
}

async function addFiles(files) {
  files = files.slice(0, MAX_BATCH - items.length);
  if (!files.length) return;

  const isSingle = files.length === 1;

  // Show upload reading animation
  showUploadOverlay(
    isSingle ? 'Loading Image…' : `Loading ${files.length} Images…`,
    isSingle ? 'Getting ready to process' : 'Queuing all images for processing'
  );

  // Brief delay so user sees the upload state
  await new Promise(r => setTimeout(r, 600));

  files.forEach(f => {
    items.push({ id: Date.now()+Math.random(), file:f, resultCanvas:null, status:'queued', name:f.name });
  });
  dropZone.classList.add('hidden');
  renderBatchGrid();
  updateBatchHeader();

  hideUploadOverlay();

  // Auto-process: single → direct, multi → sequential
  // Hard lock: if another addFiles() call is already running the processing loop,
  // just leave these items queued — that running loop will pick them up itself.
  if (batchLoopRunning) {
    renderBatchGrid();
    updateBatchHeader();
    return;
  }
  batchLoopRunning = true;

  try {
    if (isSingle) {
      // Single photo: go straight to processing
      const _bpa1 = document.getElementById('btn-process-all'); if (_bpa1) _bpa1.disabled = true;
      const item = items[items.length - 1];
      await processItem(item);
      const _bpa2 = document.getElementById('btn-process-all'); if (_bpa2) _bpa2.disabled = false;
      updateBatchHeader();
      if (item.status === 'done' && !editorOpened && !activeId) { editorOpened = true; await openEditor(item.id); }
      // Pick up any items that were queued by an overlapping addFiles() call while we were busy
      let extra;
      while ((extra = items.find(i => i.status === 'queued'))) {
        await processItem(extra);
        if (extra.status === 'done' && !editorOpened) { editorOpened = true; await openEditor(extra.id); }
      }
    } else {
      // Multiple photos: process sequentially, pick queued items dynamically so add-more items are included
      const _bpa1 = document.getElementById('btn-process-all'); if (_bpa1) _bpa1.disabled = true;
      let next;
      while ((next = items.find(i => i.status === 'queued'))) {
        await processItem(next);
        if (next.status === 'done' && !editorOpened) {
          editorOpened = true;
          await openEditor(next.id);
        }
      }
      const _bpa2 = document.getElementById('btn-process-all'); if (_bpa2) _bpa2.disabled = false;
      updateBatchHeader();
    }
  } finally {
    batchLoopRunning = false;
  }
}

function renderBatchGrid() {
  const grid = document.getElementById('batch-grid');
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'batch-card' + (item.id===activeId?' active-edit':'');
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="batch-thumb-wrap" id="thumb-${item.id}">
        <img class="batch-thumb" src="${item.resultCanvas ? '' : URL.createObjectURL(item.file)}" style="${item.resultCanvas?'display:none':''}">
        ${item.resultCanvas ? `<canvas width="${item.resultCanvas.width}" height="${item.resultCanvas.height}" style="max-width:100%;max-height:100%;"></canvas>` : ''}
        <span class="batch-status ${item.status}">${item.status==='queued'?'Queued':item.status==='processing'?'Processing…':item.status==='done'?'Done':'Error'}</span>
        <button class="batch-remove-btn" title="Remove image" onclick="removeItem('${item.id}');event.stopPropagation();" ${item.status==='processing'?'disabled':''}>✕</button>
        <div class="batch-progress-bar"><div class="batch-progress-fill" id="prog-${item.id}"></div></div>
        <div class="card-proc-overlay${item.status==='processing'?' active':''}">
          <div class="card-spinner"></div>
          <div class="card-proc-label">AI Processing</div>
        </div>
      </div>
      <div class="batch-card-footer">
        <span class="batch-name" title="${item.name}">${item.name}</span>
        <button class="batch-dl-btn" title="Download" ${item.status!=='done'?'disabled':''} onclick="downloadItem('${item.id}');event.stopPropagation();">⬇</button>
      </div>`;
    // Copy resultCanvas to card canvas
    if (item.resultCanvas) {
      const cvs = card.querySelector('canvas');
      if (cvs) cvs.getContext('2d').drawImage(item.resultCanvas, 0, 0);
    }
    card.addEventListener('click', () => { if (item.status==='done') openEditor(item.id, true); });
    grid.appendChild(card);
  });
  // Add more button — only show after at least 1 image has been added
  if (items.length > 0 && items.length < MAX_BATCH) {
    const addMore = document.createElement('div');
    addMore.className = 'batch-add-more';
    addMore.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add More</span><span class="batch-add-more-drag-text" style="font-size:10px;opacity:0.6;">or drag &amp; drop images here</span>`;
    addMore.addEventListener('click', () => fileIn.click());
    addMore.addEventListener('dragover', e => { e.preventDefault(); addMore.classList.add('drag-over'); });
    addMore.addEventListener('dragleave', () => addMore.classList.remove('drag-over'));
    addMore.addEventListener('drop', e => {
      e.preventDefault(); addMore.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) addFiles(files);
    });
    grid.appendChild(addMore);
  }
}

function updateBatchHeader() {
  const hdr = document.getElementById('batch-header');
  hdr.classList.toggle('active', items.length > 0);
  document.getElementById('batch-title-text').textContent = `${items.length} image${items.length!==1?'s':''}`;
  // btn-dl-all was part of the top toolbar that's no longer in the DOM; guard in case it's reintroduced
  const dlAllBtn = document.getElementById('btn-dl-all');
  if (dlAllBtn) {
    const allDone = items.length > 0 && items.every(i=>i.status==='done');
    dlAllBtn.style.display = allDone ? '' : 'none';
  }
}

/* ── REMOVE SINGLE ITEM ── */
window.removeItem = function(id) {
  const idx = items.findIndex(i => i.id == id);
  if (idx === -1) return;
  items.splice(idx, 1);
  // If removed item was active, close editor or open next done
  if (activeId == id) {
    activeId = null;
    wCanvas = null; wCtx = null; origData = null;
    document.getElementById('editor-wrap').classList.remove('active');
    document.getElementById('proc-overlay').classList.remove('active');
    const nextDone = items.find(i => i.status === 'done');
    if (nextDone) openEditor(nextDone.id, true);
  }
  if (!items.length) {
    dropZone.classList.remove('hidden');
    document.getElementById('batch-header').classList.remove('active');
  }
  renderBatchGrid();
  updateBatchHeader();
};

/* ── PROCESS ALL ── */
window.processAll = async function() {
  const toProcess = items.filter(i=>i.status==='queued'||i.status==='error');
  if (!toProcess.length) return;
  if (batchLoopRunning) return; // another loop (addFiles) is already draining the queue
  batchLoopRunning = true;
  try {
    const _bpa1 = document.getElementById('btn-process-all'); if (_bpa1) _bpa1.disabled = true;
    for (const item of toProcess) {
      await processItem(item);
      if (item.status === 'done' && !editorOpened) {
        editorOpened = true;
        await openEditor(item.id);
      }
    }
    const _bpa2 = document.getElementById('btn-process-all'); if (_bpa2) _bpa2.disabled = false;
    updateBatchHeader();
  } finally {
    batchLoopRunning = false;
  }
};

async function processItem(item) {
  item.status = 'processing';
  renderBatchGrid();

  const procOverlay = document.getElementById('proc-overlay');
  const procTitle   = document.getElementById('proc-title');
  const procSub     = document.getElementById('proc-sub');
  const procPct     = document.getElementById('proc-pct');

  const showOnCanvas = !activeId;

  // Detect if model is cached (rough check via performance / localStorage flag)
  const modelCached = localStorage.getItem('wc_model_cached') === '1';

  // Helper to activate a stage in the overlay
  function setStage(n) {
    for (let i=1;i<=4;i++) {
      const el = document.getElementById('proc-stage-'+i);
      if (el) el.classList.toggle('active', i===n);
    }
  }

  if (showOnCanvas) {
    // Make sure the editor/canvas area is visible so the processing overlay can be seen
    document.getElementById('editor-wrap').classList.add('active');
    document.getElementById('editor-filename').textContent = item.name;
    if (!activeId) document.getElementById('editor-wrap').classList.add('active');

    setStage(1);
    procTitle.textContent = 'Preparing AI Engine…';
    procSub.textContent   = modelCached
      ? 'Loading AI from cache — almost ready'
      : 'Starting up AI engine for the first time';
    procPct.textContent   = 'AI';
    // Show/hide hint based on cache
    const hintEl = document.getElementById('proc-hint');
    if (hintEl) hintEl.style.display = modelCached ? 'none' : '';
    procOverlay.classList.add('active');
  }

  try {
    // Stage 1: Load the library
    const rbFn = await loadLib();

    if (showOnCanvas) {
      setStage(modelCached ? 3 : 2);
      procTitle.textContent = modelCached ? 'Optimising Image…' : 'Downloading AI Model…';
      procSub.textContent   = modelCached
        ? 'Preparing image for background removal'
        : `Downloading ~170 MB model (once only — cached forever after)`;
      procPct.textContent   = '0%';
    }

    let lastStage = '';
    const blob = await rbFn(item.file, {
      publicPath: `https://staticimgly.com/@imgly/background-removal-data/${LIB_VERSION}/dist/`,
      progress: (key, cur, tot) => {
        const p   = tot > 0 ? Math.round(cur / tot * 100) : 0;
        const bar = document.getElementById(`prog-${item.id}`);
        if (bar) bar.style.width = p + '%';

        if (!showOnCanvas) return;

        if (key && key.includes('fetch')) {
          // Model download stage
          if (lastStage !== 'fetch') {
            lastStage = 'fetch';
            setStage(2);
            procTitle.textContent = 'Downloading AI Model…';
            procSub.textContent   = modelCached
              ? 'Loading model from browser cache…'
              : `⏳ First-time download (~170 MB). Next time it's instant!`;
          }
          if (p > 0) procPct.textContent = p + '%';
        } else if (key && key.includes('execute')) {
          // Model execution stage
          if (lastStage !== 'execute') {
            lastStage = 'execute';
            setStage(3);
            procTitle.textContent = 'Optimising Image…';
            procSub.textContent   = 'Analysing image with neural network';
            localStorage.setItem('wc_model_cached', '1'); // mark model as cached
          }
          if (p > 0) procPct.textContent = p + '%';
        } else if (key && (key.includes('inference') || key.includes('segment') || key.includes('process') || key.includes('output'))) {
          // Inference / removing background stage
          if (lastStage !== 'remove') {
            lastStage = 'remove';
            setStage(4);
            procTitle.textContent = 'Removing Background…';
            procSub.textContent   = 'AI is precisely cutting out your subject';
            localStorage.setItem('wc_model_cached', '1');
          }
          if (p > 0) procPct.textContent = p + '%';
        } else if (p > 0) {
          // Fallback: if we haven't advanced to stage 4 yet, do it now
          if (lastStage !== 'remove') {
            lastStage = 'remove';
            setStage(4);
            procTitle.textContent = 'Removing Background…';
            procSub.textContent   = 'AI is precisely cutting out your subject';
            localStorage.setItem('wc_model_cached', '1');
          }
          procPct.textContent = p + '%';
        }
      },
      model: 'large',
      output: { format: 'image/png', quality: 1 },
    });

    // Done — store result
    const img = await loadImg(URL.createObjectURL(blob));
    const cvs = document.createElement('canvas');
    cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
    cvs.getContext('2d').drawImage(img, 0, 0);
    item.resultCanvas = cvs;
    item.status = 'done';

    if (showOnCanvas) {
      setStage(4);
      procPct.textContent   = '✓';
      procTitle.textContent = 'Background Removed!';
      procSub.textContent   = 'Your image is ready to edit & download';
      await new Promise(r => setTimeout(r, 500));
    }

    // Do NOT auto-open editor here — callers (addFiles/processAll) decide when to open
  } catch (err) {
    item.status = 'error';
    console.error(err);
    if (showOnCanvas) {
      procPct.textContent   = '!';
      procTitle.textContent = 'Something went wrong';
      procSub.textContent   = 'Please try again — may be a network issue';
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (showOnCanvas) procOverlay.classList.remove('active');
  if (showOnCanvas && item.status==='error' && !wCanvas) {
    document.getElementById('editor-wrap').classList.remove('active');
  }
  renderBatchGrid();
}

/* ── OPEN EDITOR ── */
async function openEditor(id, noScroll) {
  const item = items.find(i=>i.id==id);
  if (!item || !item.resultCanvas) return;
  activeId = id;

  document.getElementById('editor-wrap').classList.add('active');
  document.getElementById('editor-filename').textContent = item.name;

  // Reset editor state
  brushMode = null; isPainting = false; isPanning = false;
  zoom = 1; panX = 0; panY = 0; baseW = 0; baseH = 0;
  undoStack = []; redoStack = []; updateUndoUI();
  isDraggingSubject = false;
  bgScale = 1; bgOffsetX = 0; bgOffsetY = 0;

  // Restore saved state from bgSnapshot, or defaults if first time
  const snap = item.bgSnapshot || {};
  currentBgColor  = snap.bgColor    || 'transparent';
  currentPhotoBg  = snap.photoBg    || null;
  subjectScale    = snap.subjectScale != null ? snap.subjectScale : 1;
  subjectX        = snap.subjectX    || 0;
  subjectY        = snap.subjectY    || 0;
  subjectRotation = snap.subjectRotation || 0;
  flipX           = snap.flipX || false;
  flipY           = snap.flipY || false;
  shadowEnabled   = snap.shadowEnabled || false;
  shadowColor     = snap.shadowColor   || '#000000';
  shadowOpacity   = snap.shadowOpacity != null ? snap.shadowOpacity : 60;
  shadowBlur      = snap.shadowBlur    != null ? snap.shadowBlur    : 20;
  shadowDistance  = snap.shadowDistance!= null ? snap.shadowDistance: 10;
  shadowAngle     = snap.shadowAngle   != null ? snap.shadowAngle   : 135;
  bgBlur          = snap.bgBlur        != null ? snap.bgBlur        : 0;
  bgScale         = snap.bgScale       != null ? snap.bgScale       : 1;
  bgOffsetX       = snap.bgOffsetX     != null ? snap.bgOffsetX     : 0;
  bgOffsetY       = snap.bgOffsetY     != null ? snap.bgOffsetY     : 0;
  outlineEnabled  = snap.outlineEnabled || false;
  outlineColor    = snap.outlineColor   || '#ffffff';
  outlineWidth    = snap.outlineWidth   != null ? snap.outlineWidth  : 4;
  glowEnabled     = snap.glowEnabled    || false;
  glowColor       = snap.glowColor      || '#c8a96e';
  glowStrength    = snap.glowStrength   != null ? snap.glowStrength  : 60;
  glowBlur        = snap.glowBlur       != null ? snap.glowBlur      : 20;
  featherRadius   = snap.featherRadius  != null ? snap.featherRadius : 0;

  // Sync all UI controls to restored state
  // Subject sliders
  const ssEl = document.getElementById('subject-scale');
  if (ssEl) { ssEl.value = Math.round(subjectScale*100); document.getElementById('subject-scale-val').textContent = Math.round(subjectScale*100)+'%'; }
  const sxEl = document.getElementById('subject-x');
  if (sxEl) { sxEl.value = subjectX; document.getElementById('subject-x-val').textContent = subjectX; }
  const syEl = document.getElementById('subject-y');
  if (syEl) { syEl.value = subjectY; document.getElementById('subject-y-val').textContent = subjectY; }
  const srEl = document.getElementById('subject-rotate');
  if (srEl) { srEl.value = subjectRotation; document.getElementById('subject-rotate-val').textContent = subjectRotation+'°'; }
  // Shadow
  document.getElementById('shadow-enable').checked = shadowEnabled;
  document.getElementById('shadow-controls').style.display = shadowEnabled ? 'flex' : 'none';
  document.getElementById('shadow-color').value   = shadowColor;
  document.getElementById('shadow-opacity').value = shadowOpacity; document.getElementById('shadow-opacity-val').textContent = shadowOpacity+'%';
  document.getElementById('shadow-blur').value    = shadowBlur;    document.getElementById('shadow-blur-val').textContent    = shadowBlur+'px';
  document.getElementById('shadow-distance').value= shadowDistance; document.getElementById('shadow-distance-val').textContent= shadowDistance+'px';
  document.getElementById('shadow-angle').value   = shadowAngle;   document.getElementById('shadow-angle-val').textContent   = shadowAngle+'°';
  // BG blur
  document.getElementById('bg-blur').value = bgBlur; document.getElementById('bg-blur-val').textContent = bgBlur+'px';
  // Outline
  document.getElementById('outline-enable').checked = outlineEnabled;
  document.getElementById('outline-controls').style.display = outlineEnabled ? 'flex' : 'none';
  document.getElementById('outline-color').value = outlineColor;
  document.getElementById('outline-width').value = outlineWidth; document.getElementById('outline-width-val').textContent = outlineWidth+'px';
  // Glow
  document.getElementById('glow-enable').checked = glowEnabled;
  document.getElementById('glow-controls').style.display = glowEnabled ? 'flex' : 'none';
  document.getElementById('glow-color').value = glowColor;
  document.getElementById('glow-strength').value = glowStrength; document.getElementById('glow-strength-val').textContent = glowStrength+'%';
  document.getElementById('glow-blur').value = glowBlur; document.getElementById('glow-blur-val').textContent = glowBlur+'px';
  // Feather UI sync
  const featherEl = document.getElementById('feather-radius'); if(featherEl){ featherEl.value=featherRadius; document.getElementById('feather-radius-val').textContent=featherRadius+'px'; }
  // BG color swatches
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('active'));
  if (currentPhotoBg) {
    // Photo bg was active — highlight matching thumb if visible
    document.querySelectorAll('.photo-thumb').forEach(t => { if (t.src === currentPhotoBg.url || t._fullUrl === currentPhotoBg.url) t.classList.add('active'); });
    viewport.classList.remove('checker-bg-vp');
  } else if (currentBgColor === 'transparent') {
    const ts = document.querySelector('.swatch[data-bg="transparent"]'); if(ts) ts.classList.add('active');
    viewport.classList.add('checker-bg-vp');
  } else {
    const match = document.querySelector(`.swatch[data-bg="${currentBgColor}"]`);
    if (match) match.classList.add('active');
    viewport.classList.remove('checker-bg-vp');
  }

  // Set up wCanvas from item's resultCanvas
  wCanvas = document.createElement('canvas');
  wCanvas.width = item.resultCanvas.width;
  wCanvas.height = item.resultCanvas.height;
  wCtx = wCanvas.getContext('2d', { willReadFrequently:true });
  wCtx.drawImage(item.resultCanvas, 0, 0);

  // origData from original file
  const origImg = await loadImg(URL.createObjectURL(item.file));
  const origCanvas = document.createElement('canvas');
  origCanvas.width = wCanvas.width; origCanvas.height = wCanvas.height;
  const origCtx = origCanvas.getContext('2d', { willReadFrequently:true });
  origCtx.drawImage(origImg, 0, 0, wCanvas.width, wCanvas.height);
  origData = origCtx.getImageData(0, 0, wCanvas.width, wCanvas.height);

  // Reset before/after mode on new image
  beforeAfterMode = false; window._baMode = false;
  const baBtn = document.getElementById('btn-before-after');
  if (baBtn) {
    baBtn.style.display = '';
    baBtn.style.borderColor = 'var(--faint)';
    baBtn.style.color = 'var(--text-muted)';
    baBtn.textContent = '⇔ Before/After';
  }

  attachEvents();
  requestAnimationFrame(() => {
    computeBaseSize();
    updateBgTransformVisibility();
    updateFlipButtons();
    renderAll();
  });

  // Update grid highlight
  renderBatchGrid();
}

/* ── LAYOUT ── */
function computeBaseSize() {
  const vp = viewport.parentElement;
  const maxW = vp.clientWidth || 600;
  const isPortrait = wCanvas.height > wCanvas.width;

  const availH = window.innerHeight;
  const maxHFactor = 0.72;
  const maxH = Math.min(availH * maxHFactor, isPortrait ? 1100 : 650);
  const ratio = Math.min(maxW / wCanvas.width, maxH / wCanvas.height, 1);
  baseW = Math.round(wCanvas.width * ratio);
  baseH = Math.round(wCanvas.height * ratio);
  viewport.style.height = baseH + 'px';
  viewport.style.minHeight = '';
  viewport.style.maxHeight = '';
}

function renderAll() {
  if (!wCanvas) return;
  const dw = Math.round(baseW * zoom);
  const dh = Math.round(baseH * zoom);
  const vpW = viewport.clientWidth, vpH = viewport.clientHeight;
  panX = Math.min(0, Math.max(vpW-dw, panX));
  panY = Math.min(0, Math.max(vpH-dh, panY));
  if (dw <= vpW) panX = Math.round((vpW-dw)/2);
  if (dh <= vpH) panY = Math.round((vpH-dh)/2);
  dc.width = dw; dc.height = dh;
  dc.style.width = dw+'px'; dc.style.height = dh+'px';
  dc.style.transform = `translate(${panX}px,${panY}px)`;
  cc.width = dw; cc.height = dh;
  cc.style.width = dw+'px'; cc.style.height = dh+'px';
  cc.style.transform = `translate(${panX}px,${panY}px)`;
  document.getElementById('zoom-level').textContent = Math.round(zoom*100)+'%';
  const resetBtn = document.getElementById('btn-zoom-reset');
  if (resetBtn) resetBtn.style.opacity = zoom === 1 && panX === 0 && panY === 0 ? '0.35' : '1';
  if (beforeAfterMode) {
    // Re-draw original image at new canvas size
    const dw2 = dc.width, dh2 = dc.height;
    dctx.clearRect(0, 0, dw2, dh2);
    const tmpC2 = document.createElement('canvas');
    tmpC2.width = origData.width; tmpC2.height = origData.height;
    tmpC2.getContext('2d').putImageData(origData, 0, 0);
    dctx.drawImage(tmpC2, 0, 0, dw2, dh2);
    return;
  }
  drawComposite();
}

function drawComposite() {
  if (!wCanvas) return;
  // In before/after mode: skip redraw (original is already shown), but silently update snapshot
  if (beforeAfterMode) {
    // Still update bgSnapshot so state is saved, then return
    const activeItem = items.find(i=>i.id==activeId);
    if (activeItem) {
      activeItem.bgSnapshot = { photoBg:currentPhotoBg, bgColor:currentBgColor, bgBlur, bgScale, bgOffsetX, bgOffsetY, shadowEnabled, shadowColor, shadowOpacity, shadowBlur, shadowDistance, shadowAngle, outlineEnabled, outlineColor, outlineWidth, glowEnabled, glowColor, glowStrength, glowBlur, featherRadius, subjectScale, subjectX, subjectY, subjectRotation, flipX, flipY, dcWidth:dc.width, dcHeight:dc.height };
    }
    return;
  }
  const dw = dc.width, dh = dc.height;

  drawCompositeScene(dctx, wCanvas, {
    photoBg: currentPhotoBg,
    bgColor: currentBgColor,
    bgBlur,
    bgScale,
    bgOffsetX,
    bgOffsetY,
    shadowEnabled,
    shadowColor,
    shadowOpacity,
    shadowBlur,
    shadowDistance,
    shadowAngle,
    outlineEnabled,
    outlineColor,
    outlineWidth,
    glowEnabled,
    glowColor,
    glowStrength,
    glowBlur,
    featherRadius,
    subjectScale,
    subjectX,
    subjectY,
    subjectRotation,
    flipX,
    flipY,
  }, dw, dh);

  // Save bg+subject state into active item for export
  const activeItem = items.find(i=>i.id==activeId);
  if (activeItem) {
    activeItem.bgSnapshot = {
      photoBg: currentPhotoBg,
      bgColor: currentBgColor,
      bgBlur,
      bgScale,
      bgOffsetX,
      bgOffsetY,
      shadowEnabled,
      shadowColor,
      shadowOpacity,
      shadowBlur,
      shadowDistance,
      shadowAngle,
      outlineEnabled,
      outlineColor,
      outlineWidth,
      glowEnabled,
      glowColor,
      glowStrength,
      glowBlur,
      featherRadius,
      subjectScale,
      subjectX,
      subjectY,
      subjectRotation,
      flipX,
      flipY,
      dcWidth: dc.width,
      dcHeight: dc.height
    };
  }
}

/* ── ZOOM ── */
window.adjustZoom = function(delta) {
  const nz = Math.min(8, Math.max(0.25, zoom+delta));
  const cx = viewport.clientWidth/2, cy = viewport.clientHeight/2;
  panX = cx - (cx-panX)*(nz/zoom);
  panY = cy - (cy-panY)*(nz/zoom);
  zoom = nz; renderAll();
};
window.toggleFlip = function(axis) {
  if (axis === 'x') flipX = !flipX;
  else flipY = !flipY;
  updateFlipButtons();
  drawComposite();
};

function updateFlipButtons() {
  const baseStyle = 'flex:1;padding:5px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);cursor:pointer;transition:all .2s;border-width:1.5px;border-style:solid;';
  const activeStyle   = baseStyle + 'background:var(--gold-dim);border-color:var(--gold-border);color:var(--gold);';
  const inactiveStyle = baseStyle + 'background:var(--dark4);border-color:var(--faint);color:var(--muted);';
  ['btn-flip-x'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.cssText = flipX ? activeStyle : inactiveStyle;
  });
  ['btn-flip-y'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.cssText = flipY ? activeStyle : inactiveStyle;
  });
}

window.resetZoom = function() { zoom=1;panX=0;panY=0;renderAll(); };

/* ── EVENTS ── */
function attachEvents() {
  if (eventsReady) return;
  eventsReady = true;
  window.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
    if (e.code==='Space' && !isTyping) { spaceDown=true; viewport.style.cursor='grab'; e.preventDefault(); }
    if ((e.ctrlKey||e.metaKey) && e.code==='KeyZ' && !e.shiftKey) { e.preventDefault(); undoStroke(); }
    if ((e.ctrlKey||e.metaKey) && (e.code==='KeyY'||(e.code==='KeyZ'&&e.shiftKey))) { e.preventDefault(); redoStroke(); }
  });
  window.addEventListener('keyup', e => { if (e.code==='Space') { spaceDown=false; viewport.style.cursor=''; updateViewportCursor(); }});
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX-rect.left-panX, my = e.clientY-rect.top-panY;
    const delta = e.deltaY<0?0.15:-0.15;
    const nz = Math.min(8, Math.max(0.25, zoom+delta));
    panX -= mx*(nz/zoom-1); panY -= my*(nz/zoom-1); zoom=nz; renderAll();
  }, { passive:false });
  viewport.addEventListener('mousedown', e => {
    if (e.button===1||spaceDown) {
      isPanning=true; panStart={x:e.clientX-panX,y:e.clientY-panY}; viewport.style.cursor='grabbing'; e.preventDefault(); return;
    }
    if (!brushMode) {
      // Check if clicking on subject area for drag
      const pos = canvasPos(e);
      if (pos) {
        isDraggingSubject = true;
        subjectDragStart = { x: e.clientX - subjectX, y: e.clientY - subjectY };
        viewport.style.cursor = 'move';
        e.preventDefault();
      } else {
        isPanning=true; panStart={x:e.clientX-panX,y:e.clientY-panY}; viewport.style.cursor='grabbing'; e.preventDefault();
      }
      return;
    }
    const pos=canvasPos(e); if (!pos) return;
    isPainting=true; saveSnapshot(); applyBrush(pos.x,pos.y);
  });
  viewport.addEventListener('mousemove', e => {
    if (isPanning) { panX=e.clientX-panStart.x; panY=e.clientY-panStart.y; renderAll(); clearCursor(); return; }
    if (isDraggingSubject) {
      subjectX = e.clientX - subjectDragStart.x;
      subjectY = e.clientY - subjectDragStart.y;
      // Sync sliders
      const sxEl = document.getElementById('subject-x');
      const syEl = document.getElementById('subject-y');
      if (sxEl) { sxEl.value = Math.max(-500, Math.min(500, Math.round(subjectX))); document.getElementById('subject-x-val').textContent = Math.round(subjectX); }
      if (syEl) { syEl.value = Math.max(-500, Math.min(500, Math.round(subjectY))); document.getElementById('subject-y-val').textContent = Math.round(subjectY); }
      drawComposite(); return;
    }
    const pos=canvasPos(e);
    if (pos) { drawCursorRing(pos.x,pos.y); if (isPainting&&brushMode) applyBrush(pos.x,pos.y); }
    else clearCursor();
  });
  viewport.addEventListener('mouseup', e => {
    if (isPanning) { isPanning=false; viewport.style.cursor=''; updateViewportCursor(); return; }
    if (isDraggingSubject) { isDraggingSubject=false; viewport.style.cursor=''; updateViewportCursor(); return; }
    if (isPainting) { isPainting=false; bakeToItem(); }
  });
  viewport.addEventListener('mouseleave', () => { if (isPanning)isPanning=false; if (isDraggingSubject)isDraggingSubject=false; if (isPainting){isPainting=false;bakeToItem();} clearCursor(); });
  let lastTouches=null;
  viewport.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length===2){lastTouches=e.touches;isPainting=false;return;}
    if (!brushMode){isPanning=true;panStart={x:e.touches[0].clientX-panX,y:e.touches[0].clientY-panY};return;}
    const t = e.touches[0];
    const rawPos = touchPos(t);
    if (!rawPos) return;
    const brushPos = rawPos;
    _brushScreenX = t.clientX; _brushScreenY = t.clientY;
    // Show cursor ring immediately on touch (not just on move)
    drawCursorRing(brushPos.x, brushPos.y, t.clientX, t.clientY);
    isPainting=true; saveSnapshot(); applyBrush(brushPos.x, brushPos.y, rawPos, t);
  },{passive:false});
  viewport.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length===2&&lastTouches){
      const d0=Math.hypot(lastTouches[0].clientX-lastTouches[1].clientX,lastTouches[0].clientY-lastTouches[1].clientY);
      const d1=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      const r=d1/d0;const cx=(e.touches[0].clientX+e.touches[1].clientX)/2-viewport.getBoundingClientRect().left;
      const cy=(e.touches[0].clientY+e.touches[1].clientY)/2-viewport.getBoundingClientRect().top;
      const nz=Math.min(8,Math.max(0.25,zoom*r)); panX-=(cx-panX)*(nz/zoom-1); panY-=(cy-panY)*(nz/zoom-1); zoom=nz; lastTouches=e.touches; renderAll(); return;
    }
    if (isPanning){panX=e.touches[0].clientX-panStart.x;panY=e.touches[0].clientY-panStart.y;renderAll();return;}
    if (!brushMode) { clearCursor(); return; }
    const t = e.touches[0];
    const rawPos = touchPos(t);
    if (!rawPos) { clearCursor(); return; }
    const brushPos = rawPos;
    drawCursorRing(brushPos.x, brushPos.y, t.clientX, t.clientY);
    if (isPainting) { _brushScreenX = t.clientX; _brushScreenY = t.clientY; applyBrush(brushPos.x, brushPos.y, rawPos, t); }
  },{passive:false});
  viewport.addEventListener('touchend', e=>{lastTouches=null;isPanning=false;if(isPainting){isPainting=false;bakeToItem();}clearCursor();});
}

function updateViewportCursor(){viewport.style.cursor=brushMode?'none':'move';}
function canvasPos(e){
  const dr=dc.getBoundingClientRect();
  const scaleX=dc.width/dr.width,scaleY=dc.height/dr.height;
  const cx=(e.clientX-dr.left)*scaleX,cy=(e.clientY-dr.top)*scaleY;
  if(cx<0||cy<0||cx>dc.width||cy>dc.height)return null;
  return{x:cx,y:cy};
}
function touchPos(t){
  const dr=dc.getBoundingClientRect();
  const scaleX=dc.width/dr.width,scaleY=dc.height/dr.height;
  const cx=(t.clientX-dr.left)*scaleX,cy=(t.clientY-dr.top)*scaleY;
  if(cx<0||cy<0||cx>dc.width)return null;
  if(cy > dc.height) return null;
  return{x:cx, y:Math.min(cy, dc.height)};
}

/* ── CURSOR ── */
function clearCursor(){
  cctx.clearRect(0,0,cc.width,cc.height);
}

function drawCursorRing(x, y, touchScreenX, touchScreenY) {
  cctx.clearRect(0, 0, cc.width, cc.height);
  if (!brushMode) return;

  const dr = dc.getBoundingClientRect();
  const scaleX = dc.width / dr.width;

  const rx = x, ry = y;

  const ringR = (window.brushSize / 2) * scaleX;
  const col = window.smartEdge
    ? 'rgba(201,168,76,.95)'                            // gold = smart-edge mode
    : brushMode === 'erase' ? 'rgba(255,80,80,.9)' : 'rgba(80,220,80,.9)';

  cctx.save();
  // Outer ring
  cctx.beginPath(); cctx.arc(rx, ry, ringR, 0, Math.PI * 2);
  cctx.strokeStyle = col; cctx.lineWidth = 1.5 * scaleX; cctx.stroke();
  // Centre dot
  cctx.beginPath(); cctx.arc(rx, ry, 1.5 * scaleX, 0, Math.PI * 2);
  cctx.fillStyle = col; cctx.fill();
  cctx.restore();
}

/* ── BRUSH ── */
function applyBrush(dispX,dispY){
  // dc coords → wCanvas coords, accounting for subjectScale+offset
  const dw=dc.width, dh=dc.height;
  const drawnW = dw * subjectScale;
  const drawnH = dh * subjectScale;
  const originX = (dw - drawnW) / 2 + subjectX;
  const originY = (dh - drawnH) / 2 + subjectY;
  const fx = ((dispX - originX) / drawnW) * wCanvas.width;
  const fy = ((dispY - originY) / drawnH) * wCanvas.height;
  const sx = wCanvas.width / drawnW;
  const fr = (window.brushSize / 2) * sx;

  // ── Smart Edge Mode ──────────────────────────────────────────────
  if (window.smartEdge) {
    applySmartEdgeBrush(fx, fy, fr);
    drawComposite(); drawCursorRing(dispX, dispY, _brushScreenX, _brushScreenY);
    return;
  }
  // ── Normal brush ─────────────────────────────────────────────────
  if (brushMode==='erase'){
    wCtx.save(); wCtx.globalCompositeOperation='destination-out';
    wCtx.beginPath(); wCtx.arc(fx,fy,fr,0,Math.PI*2); wCtx.fillStyle='rgba(0,0,0,1)'; wCtx.fill(); wCtx.restore();
  } else {
    const x0=Math.max(0,Math.floor(fx-fr)),y0=Math.max(0,Math.floor(fy-fr));
    const x1=Math.min(wCanvas.width,Math.ceil(fx+fr)),y1=Math.min(wCanvas.height,Math.ceil(fy+fr));
    const pw=x1-x0,ph=y1-y0; if(pw<=0||ph<=0)return;
    const patch=wCtx.getImageData(x0,y0,pw,ph);const d=patch.data,od=origData.data,W=origData.width;
    for(let py=0;py<ph;py++){for(let px=0;px<pw;px++){
      if((x0+px-fx)**2+(y0+py-fy)**2>fr*fr)continue;
      const i=(py*pw+px)*4,oi=((y0+py)*W+(x0+px))*4;
      d[i]=od[oi];d[i+1]=od[oi+1];d[i+2]=od[oi+2];d[i+3]=od[oi+3];
    }}
    wCtx.putImageData(patch,x0,y0);
  }
  drawComposite(); drawCursorRing(dispX, dispY, _brushScreenX, _brushScreenY);
}

/* ── SMART EDGE BRUSH ───────────────────────────────────────────────
   Samples the original image colour at the brush centre, then only
   affects pixels inside the circle whose colour is "similar enough"
   (within tolerance) to that seed colour.  Pixels near edges (colour
   change) are left alone, giving a clean, edge-respecting stroke.
   ----------------------------------------------------------------- */
function applySmartEdgeBrush(fx, fy, fr) {
  const W = wCanvas.width, H = wCanvas.height;
  const x0 = Math.max(0, Math.floor(fx - fr));
  const y0 = Math.max(0, Math.floor(fy - fr));
  const x1 = Math.min(W, Math.ceil(fx + fr));
  const y1 = Math.min(H, Math.ceil(fy + fr));
  const pw = x1 - x0, ph = y1 - y0;
  if (pw <= 0 || ph <= 0) return;

  // Sample seed colour from origData at brush centre
  const seedX = Math.max(0, Math.min(W-1, Math.round(fx)));
  const seedY = Math.max(0, Math.min(H-1, Math.round(fy)));
  const od = origData.data, oW = origData.width;
  const si = (seedY * oW + seedX) * 4;
  const sr = od[si], sg = od[si+1], sb = od[si+2];

  // Tolerance: 0-100 slider → 0-441 colour distance (max possible = sqrt(255²*3) ≈ 441)
  const tol = (window.smartEdgeTol / 100) * 441;

  const patch = wCtx.getImageData(x0, y0, pw, ph);
  const d = patch.data;

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      // Must be inside circle
      if ((x0+px-fx)**2 + (y0+py-fy)**2 > fr*fr) continue;

      // Colour similarity check against origData
      const oi = ((y0+py) * oW + (x0+px)) * 4;
      const dr = od[oi]-sr, dg = od[oi+1]-sg, db = od[oi+2]-sb;
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);
      if (dist > tol) continue;   // edge pixel — skip

      // Soft falloff at tolerance boundary (smooth transition)
      const strength = tol > 0 ? Math.max(0, 1 - dist / tol) : 1;

      const i = (py * pw + px) * 4;
      if (brushMode === 'erase') {
        // Reduce alpha proportional to strength
        d[i+3] = Math.max(0, d[i+3] - Math.round(255 * strength));
      } else {
        // Restore: blend from origData weighted by strength
        d[i]   = Math.round(d[i]   * (1-strength) + od[oi]   * strength);
        d[i+1] = Math.round(d[i+1] * (1-strength) + od[oi+1] * strength);
        d[i+2] = Math.round(d[i+2] * (1-strength) + od[oi+2] * strength);
        d[i+3] = Math.round(d[i+3] * (1-strength) + od[oi+3] * strength);
      }
    }
  }
  wCtx.putImageData(patch, x0, y0);
}
let _brushScreenX, _brushScreenY;

function bakeToItem(){
  // Save wCanvas back to item
  const item = items.find(i=>i.id==activeId);
  if (item && wCanvas) {
    const cvs = document.createElement('canvas');
    cvs.width=wCanvas.width; cvs.height=wCanvas.height;
    cvs.getContext('2d').drawImage(wCanvas,0,0);
    item.resultCanvas = cvs;
  }
}

/* ── UNDO ── */
function saveSnapshot(){
  const snap=document.createElement('canvas'); snap.width=wCanvas.width; snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0); undoStack.push(snap);
  if(undoStack.length>MAX_UNDO)undoStack.shift(); redoStack=[]; updateUndoUI();
}
function updateUndoUI(){
  const u=document.getElementById('btn-undo'),r=document.getElementById('btn-redo');
  if(u)u.disabled=undoStack.length===0; if(r)r.disabled=redoStack.length===0;
}
window.undoStroke=function(){
  if(!undoStack.length)return;
  const snap=document.createElement('canvas'); snap.width=wCanvas.width; snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0); redoStack.push(snap);
  const prev=undoStack.pop(); wCtx.clearRect(0,0,wCanvas.width,wCanvas.height); wCtx.drawImage(prev,0,0);
  drawComposite(); updateUndoUI(); bakeToItem();
};
window.redoStroke=function(){
  if(!redoStack.length)return;
  const snap=document.createElement('canvas'); snap.width=wCanvas.width; snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0); undoStack.push(snap);
  const next=redoStack.pop(); wCtx.clearRect(0,0,wCanvas.width,wCanvas.height); wCtx.drawImage(next,0,0);
  drawComposite(); updateUndoUI(); bakeToItem();
};

/* ── BRUSH MODE ── */
window.setBrushMode=function(mode){
  if(brushMode===mode){brushMode=null;updateViewportCursor();document.getElementById('btn-erase').classList.remove('mode-erase');document.getElementById('btn-restore').classList.remove('mode-restore');}
  else{brushMode=mode;viewport.style.cursor='none';document.getElementById('btn-erase').classList.toggle('mode-erase',mode==='erase');document.getElementById('btn-restore').classList.toggle('mode-restore',mode==='restore');document.getElementById('btn-erase').classList.toggle('mode-restore',false);document.getElementById('btn-restore').classList.toggle('mode-erase',false);}
};

/* ── SMART EDGE TOGGLE ── */
window.toggleSmartEdge = function() {
  window.smartEdge = !window.smartEdge;
  const btn = document.getElementById('btn-smart-edge');
  const tolWrap = document.getElementById('smart-edge-tol-wrap');
  if (window.smartEdge) {
    btn.classList.add('mode-smart-edge');
    if (tolWrap) tolWrap.style.display = '';
  } else {
    btn.classList.remove('mode-smart-edge');
    if (tolWrap) tolWrap.style.display = 'none';
  }
};

/* ── BG COLOR ── */
window.setBg=function(color,el){
  currentBgColor=color; currentPhotoBg=null;
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  if(el)el.classList.add('active');
  document.querySelectorAll('.photo-thumb').forEach(t=>t.classList.remove('active'));
  if(color==='transparent'){
    viewport.classList.add('checker-bg-vp');
  } else {
    viewport.classList.remove('checker-bg-vp');
  }
  updateBgTransformVisibility();
  drawComposite();
};
window.applyCustomColor=function(val){
  document.getElementById('custom-hex').value=val;
  // find & remove active swatch, use raw hex
  setBg(val, null);
};
window.hexInputChange=function(val){
  if(/^#[0-9a-fA-F]{6}$/.test(val)){
    document.getElementById('custom-color-pick').value=val;
    setBg(val,null);
  }
};

/* ── EFFECTS ── */
window.updateEffects=function(){
  shadowEnabled=document.getElementById('shadow-enable').checked;
  document.getElementById('shadow-controls').style.display=shadowEnabled?'flex':'none';
  shadowColor=document.getElementById('shadow-color').value;
  shadowOpacity=+document.getElementById('shadow-opacity').value;
  document.getElementById('shadow-opacity-val').textContent=shadowOpacity+'%';
  shadowBlur=+document.getElementById('shadow-blur').value;
  document.getElementById('shadow-blur-val').textContent=shadowBlur+'px';
  shadowDistance=+document.getElementById('shadow-distance').value;
  document.getElementById('shadow-distance-val').textContent=shadowDistance+'px';
  shadowAngle=+document.getElementById('shadow-angle').value;
  document.getElementById('shadow-angle-val').textContent=shadowAngle+'°';
  bgBlur=+document.getElementById('bg-blur').value;
  document.getElementById('bg-blur-val').textContent=bgBlur+'px';
  // Outline
  outlineEnabled=document.getElementById('outline-enable').checked;
  document.getElementById('outline-controls').style.display=outlineEnabled?'flex':'none';
  outlineColor=document.getElementById('outline-color').value;
  outlineWidth=+document.getElementById('outline-width').value;
  document.getElementById('outline-width-val').textContent=outlineWidth+'px';
  // Glow
  glowEnabled=document.getElementById('glow-enable').checked;
  document.getElementById('glow-controls').style.display=glowEnabled?'flex':'none';
  glowColor=document.getElementById('glow-color').value;
  glowStrength=+document.getElementById('glow-strength').value;
  document.getElementById('glow-strength-val').textContent=glowStrength+'%';
  glowBlur=+document.getElementById('glow-blur').value;
  document.getElementById('glow-blur-val').textContent=glowBlur+'px';
  // Feather
  featherRadius = +document.getElementById('feather-radius').value;
  document.getElementById('feather-radius-val').textContent = featherRadius+'px';
  drawComposite();
};

/* ── PHOTO SEARCH (shared engine in /assets/js/wm-studio.js) ── */
window.searchPhotos = async function() {
  const q = document.getElementById('photo-query').value.trim();
  if (!q) {
    document.getElementById('photo-grid').innerHTML = '<div class="photo-loading">Type something and press Search.</div>';
    return;
  }
  await runPhotoSearch(q, applyPhotoBg);
};

// Pre-fill the grid with a default set of photos as soon as the tool loads,
// so the panel never looks empty — it visually signals "pick a background
// here" right away. The search box itself stays untouched/empty so the
// user can still search for whatever they actually want afterwards.
(function initDefaultPhotoGrid(){
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  runPhotoSearch('gradient background', applyPhotoBg);
})();

// Upload BG from PC
window.applyUploadedBg = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = await loadImg(url);
  document.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  viewport.classList.remove('checker-bg-vp');
  currentPhotoBg = { url, img };
  currentBgColor = 'transparent';
  updateBgTransformVisibility();
  drawComposite();
  const lbl = document.getElementById('bg-upload-file').parentElement;
  lbl.style.backgroundImage = `url(${url})`;
  lbl.style.backgroundSize = 'cover';
  lbl.style.backgroundPosition = 'center';
  lbl.querySelector('div').children[0].textContent = '✓ ' + file.name.slice(0,18);
};

function showBgPhotoLoading(show) {
  let el = document.getElementById('bg-photo-loading-badge');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'bg-photo-loading-badge';
      el.textContent = 'Loading photo…';
      el.style.cssText = 'position:absolute;top:10px;left:10px;z-index:50;background:rgba(0,0,0,0.72);color:#fff;font-size:12px;font-family:inherit;padding:6px 10px;border-radius:6px;pointer-events:none;display:flex;align-items:center;gap:6px;';
      const spin = document.createElement('span');
      spin.style.cssText = 'width:10px;height:10px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:bgPhotoSpin 0.7s linear infinite;';
      el.prepend(spin);
      if (!document.getElementById('bg-photo-spin-style')) {
        const style = document.createElement('style');
        style.id = 'bg-photo-spin-style';
        style.textContent = '@keyframes bgPhotoSpin{to{transform:rotate(360deg);}}';
        document.head.appendChild(style);
      }
      const cs = getComputedStyle(viewport);
      if (cs.position === 'static') viewport.style.position = 'relative';
      viewport.appendChild(el);
    }
    el.style.display = 'flex';
  } else if (el) {
    el.style.display = 'none';
  }
}

async function applyPhotoBg(el, url) {
  // Shared handler sets active thumbnail/swatch states + fires onApplied.
  await applyPhotoBgGeneric(el, url, (bg) => {
    viewport.classList.remove('checker-bg-vp');
    currentPhotoBg = bg;
    currentBgColor = 'transparent';
    if (bg.isPlaceholder) {
      showBgPhotoLoading(true);
    } else {
      showBgPhotoLoading(false);
      el.style.opacity = '';
    }
    updateBgTransformVisibility();
    drawComposite();
  });
  if (currentPhotoBg && !currentPhotoBg.isPlaceholder) {
    el.style.opacity = '';
  }
}

/* ── SUBJECT TRANSFORM ── */
window.updateSubjectTransform = function() {
  subjectScale = +document.getElementById('subject-scale').value / 100;
  subjectX = +document.getElementById('subject-x').value;
  subjectY = +document.getElementById('subject-y').value;
  subjectRotation = +document.getElementById('subject-rotate').value;
  document.getElementById('subject-scale-val').textContent = Math.round(subjectScale*100) + '%';
  document.getElementById('subject-x-val').textContent = subjectX;
  document.getElementById('subject-y-val').textContent = subjectY;
  document.getElementById('subject-rotate-val').textContent = subjectRotation + '°';
  drawComposite();
};

window.resetSubjectTransform = function() {
  subjectScale = 1; subjectX = 0; subjectY = 0; subjectRotation = 0;
  flipX = false; flipY = false;
  document.getElementById('subject-scale').value = 100;
  document.getElementById('subject-x').value = 0;
  document.getElementById('subject-y').value = 0;
  document.getElementById('subject-rotate').value = 0;
  document.getElementById('subject-scale-val').textContent = '100%';
  document.getElementById('subject-x-val').textContent = '0';
  document.getElementById('subject-y-val').textContent = '0';
  document.getElementById('subject-rotate-val').textContent = '0°';
  updateFlipButtons();
  drawComposite();
};

/* ── BACKGROUND PHOTO TRANSFORM (desktop) ── */
window.updateBgTransform = function() {
  bgScale   = +document.getElementById('bg-scale').value / 100;
  bgOffsetX = +document.getElementById('bg-offset-x').value;
  bgOffsetY = +document.getElementById('bg-offset-y').value;
  document.getElementById('bg-scale-val').textContent = Math.round(bgScale*100) + '%';
  document.getElementById('bg-offset-x-val').textContent = bgOffsetX;
  document.getElementById('bg-offset-y-val').textContent = bgOffsetY;
  drawComposite();
};

window.resetBgTransform = function() {
  bgScale = 1; bgOffsetX = 0; bgOffsetY = 0;
  document.getElementById('bg-scale').value = 100;
  document.getElementById('bg-offset-x').value = 0;
  document.getElementById('bg-offset-y').value = 0;
  document.getElementById('bg-scale-val').textContent = '100%';
  document.getElementById('bg-offset-x-val').textContent = '0';
  document.getElementById('bg-offset-y-val').textContent = '0';
  drawComposite();
};

// Show/hide the background-position controls based on whether a photo bg is active
function updateBgTransformVisibility() {
  const show = !!currentPhotoBg;
  const dEl = document.getElementById('bg-transform-controls');
  if (dEl) dEl.style.display = show ? 'flex' : 'none';
}

/* ── PANEL TOGGLE ── */
window.togglePanel=function(id){document.getElementById(id).classList.toggle('collapsed');};

/* ── DOWNLOAD ── */
function buildExportCanvasForItem(item) {
  return buildExportCanvas(item.resultCanvas, item.bgSnapshot || {});
}

// ── Format selector ──────────────────────────────────────────
let _dlFormat = 'png';

window.setFormat = function(fmt, btn) {
  _dlFormat = fmt;
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('fmt-btn-active'));
  document.querySelectorAll(`.fmt-btn[data-fmt="${fmt}"]`).forEach(b => b.classList.add('fmt-btn-active'));
  const showQ = fmt === 'jpeg' || fmt === 'webp';
  const qRow = document.getElementById('fmt-quality-row'); if(qRow) qRow.style.display = showQ ? 'flex' : 'none';
  const label = fmt.toUpperCase();
  const dlLabel = document.getElementById('dl-btn-label'); if(dlLabel) dlLabel.textContent = 'Download ' + label;
};

function _getMimeAndExt() {
  if (_dlFormat === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
  if (_dlFormat === 'webp') return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/png', ext: 'png' };
}

function _getQuality() {
  const q = document.getElementById('fmt-quality');
  return q ? (+q.value / 100) : 0.92;
}
// ─────────────────────────────────────────────────────────────

window.downloadCurrent=function(){
  const item=items.find(i=>i.id==activeId); if(!item)return;
  if(wCanvas){
    const cvs=document.createElement('canvas');cvs.width=wCanvas.width;cvs.height=wCanvas.height;
    cvs.getContext('2d').drawImage(wCanvas,0,0);
    item.resultCanvas=cvs;
  }
  const exp=buildExportCanvasForItem(item);
  const {mime,ext}=_getMimeAndExt();
  exp.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`wc-bg-removed.${ext}`;a.click();},mime,_getQuality());
};

// ── Cross-tool connector adapter: returns the current result as a blob ──
// without triggering a download — used by tool-connect.js when the user
// clicks "Send to another tool".
window.WM_getCurrentBlob = async function() {
  const item = items.find(i => i.id == activeId);
  if (!item) return null;
  if (wCanvas) {
    const cvs = document.createElement('canvas'); cvs.width = wCanvas.width; cvs.height = wCanvas.height;
    cvs.getContext('2d').drawImage(wCanvas, 0, 0);
    item.resultCanvas = cvs;
  }
  const exp = buildExportCanvasForItem(item);
  const { mime, ext } = _getMimeAndExt();
  const blob = await new Promise(res => exp.toBlob(res, mime, _getQuality()));
  return { blob, fileName: `wc-bg-removed.${ext}`, mimeType: mime };
};

window.downloadItem=async function(id){
  const item=items.find(i=>i.id==id); if(!item||!item.resultCanvas)return;
  const exp=buildExportCanvasForItem(item);
  const {mime,ext}=_getMimeAndExt();
  exp.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`wc-${item.name.replace(/\.[^.]+$/,'')}-nobg.${ext}`;a.click();},mime,_getQuality());
};

window.downloadAll=async function(){
  const done=items.filter(i=>i.status==='done'); if(!done.length)return;
  const JSZip=window.JSZip;
  if(!JSZip){alert('JSZip not loaded. Please try again.');return;}
  const zip=new JSZip();
  const {mime,ext}=_getMimeAndExt();
  for(const item of done){
    const exp=buildExportCanvasForItem(item);
    const blob=await new Promise(res=>exp.toBlob(res,mime,_getQuality()));
    zip.file(`wc-${item.name.replace(/\.[^.]+$/,'')}-nobg.${ext}`,blob);
  }
  const zipBlob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');a.href=URL.createObjectURL(zipBlob);a.download='westcrest-bg-removed.zip';a.click();
};

window.clearAll=function(){
  items=[]; activeId=null; editorOpened=false; wCanvas=null; wCtx=null; origData=null;
  brushMode=null; isPainting=false; isPanning=false; eventsReady=false;
  zoom=1;panX=0;panY=0;baseW=0;baseH=0;
  undoStack=[];redoStack=[];updateUndoUI();
  currentBgColor='transparent';currentPhotoBg=null;
  fileIn.value='';
  dc.width=0;dc.height=0;cc.width=0;cc.height=0;
  document.getElementById('batch-grid').innerHTML='';
  document.getElementById('batch-header').classList.remove('active');
  document.getElementById('editor-wrap').classList.remove('active');
  dropZone.classList.remove('hidden');
};

/* ── FAQ ── */
window.toggleFaq = function(el) {
  document.querySelectorAll('.faq-item.open').forEach(item => {
    if (item !== el) item.classList.remove('open');
  });
  el.classList.toggle('open');
};

/* ── BEFORE / AFTER COMPARE ── */
window.toggleBeforeAfter = function() {
  if (!wCanvas || !origData) return;
  beforeAfterMode = !beforeAfterMode;
  window._baMode = beforeAfterMode;
  const baBtn = document.getElementById('btn-before-after');
  if (baBtn) {
    if (beforeAfterMode) {
      baBtn.style.borderColor = 'var(--gold-border)';
      baBtn.style.color = 'var(--gold)';
      baBtn.style.background = 'var(--gold-dim)';
      baBtn.textContent = '← Back to Result';
      // Draw original image on display canvas
      const dw = dc.width, dh = dc.height;
      dctx.clearRect(0, 0, dw, dh);
      const tmpC = document.createElement('canvas');
      tmpC.width = origData.width; tmpC.height = origData.height;
      tmpC.getContext('2d').putImageData(origData, 0, 0);
      dctx.drawImage(tmpC, 0, 0, dw, dh);
    } else {
      baBtn.style.borderColor = 'var(--faint)';
      baBtn.style.color = 'var(--text-muted)';
      baBtn.style.background = 'var(--dark-4)';
      baBtn.textContent = '⇔ Before/After';
      drawComposite(); // restore result view
    }
  }
};

// ── UTIL ── */
// loadImg, applyFeatherToCanvas, drawOutline, buildExportCanvas, enhanceSliders,
// runPhotoSearch, applyPhotoBgGeneric are imported from /assets/js/wm-studio.js.

// Run slider enhancer once DOM is ready (safe even if this script runs after
// DOMContentLoaded already fired), then re-scan lazily when panels open.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => enhanceSliders());
} else {
  enhanceSliders();
}
window.enhanceSliders = enhanceSliders;

