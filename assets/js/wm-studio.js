/**
 * wm-studio.js — Shared canvas compositing engine for Westcrest Media tools.
 *
 * Single source of truth for logic used by BOTH:
 *   - /tools/background-remover/
 *   - /tools/photo-editor-pro/
 *
 * Provides: composite scene rendering (background + glow + shadow + outline +
 * feather + subject transform), full-resolution export, feather/outline pixel
 * helpers, gradient backgrounds, image loader, Pexels/Pixabay photo search
 * (with infinite scroll) and the editable-slider enhancer.
 *
 * All functions are pure/parameterised — they take explicit inputs and never
 * reach into page globals, so any page can use them with its own state.
 */

/* ── GRADIENTS ── */
export const GRADIENTS = {
  'gradient-purple': ['#667eea', '#764ba2'],
  'gradient-pink':   ['#f093fb', '#f5576c'],
  'gradient-blue':   ['#4facfe', '#00f2fe'],
  'gradient-green':  ['#43e97b', '#38f9d7'],
};

export function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/* ── IMAGE LOADER ── */
export function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => {
      const i2 = new Image();
      i2.onload = () => res(i2);
      i2.onerror = () => rej(new Error('Image load failed: ' + src));
      i2.src = src + (src.includes('?') ? '&' : '?') + '_t=' + Date.now();
    };
    i.src = src;
  });
}

/* ── FEATHER: soften edges of alpha mask ── */
export function applyFeatherToCanvas(srcCanvas, radius) {
  if (!radius || radius <= 0) return srcCanvas;
  const w = srcCanvas.width, h = srcCanvas.height;

  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tCtx = tmp.getContext('2d');
  tCtx.drawImage(srcCanvas, 0, 0);
  const imgData = tCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3] / 255;

  const r = Math.round(radius);
  const blurred = boxBlurAlpha(alpha, w, h, r);

  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const oCtx = out.getContext('2d');
  oCtx.drawImage(srcCanvas, 0, 0);
  const outData = oCtx.getImageData(0, 0, w, h);
  const od = outData.data;
  for (let i = 0; i < w * h; i++) {
    od[i * 4 + 3] = Math.round(blurred[i] * 255);
  }
  oCtx.putImageData(outData, 0, 0);
  return out;
}

export function boxBlurAlpha(alpha, w, h, r) {
  let src = new Float32Array(alpha);
  let dst = new Float32Array(w * h);
  const passes = 3;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let sum = 0, count = 0;
      for (let x = -r; x <= r; x++) {
        const xi = Math.max(0, Math.min(w - 1, x));
        sum += src[y * w + xi]; count++;
      }
      for (let x = 0; x < w; x++) {
        dst[y * w + x] = sum / count;
        const addX = Math.min(w - 1, x + r + 1);
        const remX = Math.max(0, x - r);
        sum += src[y * w + addX] - src[y * w + remX];
      }
    }
    const tmp2 = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let y = -r; y <= r; y++) {
        const yi = Math.max(0, Math.min(h - 1, y));
        sum += dst[yi * w + x]; count++;
      }
      for (let y = 0; y < h; y++) {
        tmp2[y * w + x] = sum / count;
        const addY = Math.min(h - 1, y + r + 1);
        const remY = Math.max(0, y - r);
        sum += dst[addY * w + x] - dst[remY * w + x];
      }
    }
    src = tmp2;
  }
  return src;
}

/* ── OUTLINE HELPER ── */
export function drawOutline(ctx, srcCanvas, sx, sy, sw, sh, color, width) {
  if (!width || width <= 0) return;
  const iw = Math.round(sw), ih = Math.round(sh);
  if (iw <= 0 || ih <= 0) return;

  const pixelCount = iw * ih;
  const useAccurate = pixelCount < 1500000 && width <= 20;

  if (useAccurate) {
    const { r, g, b } = hexToRgb(color);
    const maskC = document.createElement('canvas');
    maskC.width = iw; maskC.height = ih;
    const maskCtx = maskC.getContext('2d');
    maskCtx.drawImage(srcCanvas, 0, 0, iw, ih);
    const maskData = maskCtx.getImageData(0, 0, iw, ih);
    const alpha = new Uint8Array(iw * ih);
    for (let i = 0; i < iw * ih; i++) alpha[i] = maskData.data[i * 4 + 3];

    const outC = document.createElement('canvas');
    outC.width = iw; outC.height = ih;
    const outCtx = outC.getContext('2d');
    const outImg = outCtx.createImageData(iw, ih);
    const od = outImg.data;
    const w = Math.ceil(width);

    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        if (alpha[y * iw + x] > 128) continue;
        let hit = false;
        const x0 = Math.max(0, x - w), x1 = Math.min(iw - 1, x + w);
        const y0 = Math.max(0, y - w), y1 = Math.min(ih - 1, y + w);
        outer: for (let ny = y0; ny <= y1; ny++) {
          for (let nx = x0; nx <= x1; nx++) {
            if ((nx - x) * (nx - x) + (ny - y) * (ny - y) <= w * w && alpha[ny * iw + nx] > 128) { hit = true; break outer; }
          }
        }
        if (hit) {
          const idx = (y * iw + x) * 4;
          od[idx] = r; od[idx + 1] = g; od[idx + 2] = b; od[idx + 3] = 255;
        }
      }
    }
    outCtx.putImageData(outImg, 0, 0);
    ctx.drawImage(outC, sx, sy, sw, sh);
  } else {
    const tc = document.createElement('canvas');
    tc.width = iw; tc.height = ih;
    const tctx = tc.getContext('2d');
    tctx.drawImage(srcCanvas, 0, 0, iw, ih);
    const outC = document.createElement('canvas');
    outC.width = iw; outC.height = ih;
    const octx = outC.getContext('2d');
    octx.save();
    octx.shadowColor = color;
    octx.shadowBlur = width * 2;
    octx.shadowOffsetX = 0; octx.shadowOffsetY = 0;
    for (let i = 0; i < 4; i++) octx.drawImage(tc, 0, 0);
    octx.restore();
    ctx.drawImage(outC, sx, sy);
  }
}

/* ── GRADIENT BACKGROUND (returns a gradient fill or null) ── */
export function createGradient(ctx, color, w, h) {
  if (GRADIENTS[color]) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, GRADIENTS[color][0]);
    g.addColorStop(1, GRADIENTS[color][1]);
    return g;
  }
  return null;
}

/**
 * Draw the full composite scene onto `ctx` at (outW x outH).
 *
 * @param ctx          target 2d context
 * @param subjectCanvas the foreground (subject) canvas — usually has alpha
 * @param P            params object:
 *   photoBg:{img} | bgColor | bgBlur | bgScale | bgOffsetX | bgOffsetY |
 *   shadowEnabled|shadowColor|shadowOpacity|shadowBlur|shadowDistance|shadowAngle |
 *   outlineEnabled|outlineColor|outlineWidth |
 *   glowEnabled|glowColor|glowStrength|glowBlur |
 *   featherRadius | subjectScale|subjectX|subjectY|subjectRotation|flipX|flipY
 */
/* ── BACKGROUND LAYER ──
   Draws the full-canvas backdrop (photo or solid/gradient colour).
   Used by both drawCompositeScene and multi-layer editors. */
export function drawBackground(ctx, P, outW, outH) {
  const dw = outW, dh = outH;
  if (P.photoBg && P.photoBg.img) {
    ctx.save();
    if (P.bgBlur > 0) ctx.filter = 'blur(' + P.bgBlur + 'px)';
    const imgW = P.photoBg.img.naturalWidth, imgH = P.photoBg.img.naturalHeight;
    const scale = Math.max(dw / imgW, dh / imgH) * (P.bgScale != null ? P.bgScale : 1);
    const sw = imgW * scale, sh = imgH * scale;
    ctx.drawImage(P.photoBg.img, (dw - sw) / 2 + (P.bgOffsetX || 0), (dh - sh) / 2 + (P.bgOffsetY || 0), sw, sh);
    ctx.filter = 'none';
    ctx.restore();
  } else if (P.bgColor && P.bgColor !== 'transparent') {
    ctx.save();
    const grad = createGradient(ctx, P.bgColor, dw, dh);
    ctx.fillStyle = grad || P.bgColor;
    ctx.fillRect(0, 0, dw, dh);
    ctx.restore();
  }
}

/* ── SUBJECT LAYER ──
   Draws a single subject canvas with its own transform (scale/pos/rotate/flip)
   and optional glow / shadow / outline / feather effects. Shared by
   drawCompositeScene and multi-layer editors so effects code is never duplicated. */
export function drawCompositeSubject(ctx, subjectCanvas, P, outW, outH, rect) {
  if (!subjectCanvas) return;
  const dw = outW, dh = outH;

  // Subject — its own independent transform.
  // `rect` (optional) gives an explicit destination rect {x,y,w,h}; when
  // omitted the subject is scaled relative to the canvas via P.subjectScale.
  let sx, sy, sw, sh;
  if (rect) {
    sx = rect.x; sy = rect.y; sw = rect.w; sh = rect.h;
  } else {
    const sScale = P.subjectScale != null ? P.subjectScale : 1;
    sw = dw * sScale;
    sh = dh * sScale;
    sx = (dw - sw) / 2 + (P.subjectX || 0);
    sy = (dh - sh) / 2 + (P.subjectY || 0);
  }
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const rad = (P.subjectRotation || 0) * Math.PI / 180;
  const flipX = !!P.flipX, flipY = !!P.flipY;

  // Glow — behind subject
  if (P.glowEnabled && P.glowBlur > 0) {
    const { r, g, b } = hexToRgb(P.glowColor);
    const a = (P.glowStrength != null ? P.glowStrength : 60) / 100;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rad);
    if (flipX) ctx.scale(-1, 1);
    if (flipY) ctx.scale(1, -1);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    ctx.shadowBlur = P.glowBlur * 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const passes = Math.max(1, Math.round((P.glowStrength != null ? P.glowStrength : 60) / 30));
    for (let p = 0; p < passes; p++) {
      ctx.drawImage(subjectCanvas, sx, sy, sw, sh);
    }
    ctx.restore();
  }

  // Shadow
  if (P.shadowEnabled) {
    const rad2 = (P.shadowAngle || 0) * Math.PI / 180;
    const dx = Math.cos(rad2) * (P.shadowDistance || 0);
    const dy = Math.sin(rad2) * (P.shadowDistance || 0);
    const { r, g, b } = hexToRgb(P.shadowColor);
    const a = (P.shadowOpacity != null ? P.shadowOpacity : 60) / 100;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rad);
    if (flipX) ctx.scale(-1, 1);
    if (flipY) ctx.scale(1, -1);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    ctx.shadowBlur = P.shadowBlur || 0;
    ctx.shadowOffsetX = dx;
    ctx.shadowOffsetY = dy;
    ctx.drawImage(subjectCanvas, sx, sy, sw, sh);
    ctx.restore();
  }

  // Outline
  if (P.outlineEnabled && P.outlineWidth > 0) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rad);
    if (flipX) ctx.scale(-1, 1);
    if (flipY) ctx.scale(1, -1);
    ctx.translate(-cx, -cy);
    drawOutline(ctx, subjectCanvas, sx, sy, sw, sh, P.outlineColor, P.outlineWidth);
    ctx.restore();
  }

  // Subject
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rad);
  if (flipX) ctx.scale(-1, 1);
  if (flipY) ctx.scale(1, -1);
  ctx.translate(-cx, -cy);
  const featheredSrc = P.featherRadius > 0 ? applyFeatherToCanvas(subjectCanvas, P.featherRadius * 0.3) : subjectCanvas;
  ctx.drawImage(featheredSrc, sx, sy, sw, sh);
  ctx.restore();
}

/* ── FULL COMPOSITE ──
   Background + single subject. Kept for compatibility with single-subject
   editors; multi-layer editors call drawBackground + drawCompositeSubject per layer. */
export function drawCompositeScene(ctx, subjectCanvas, P, outW, outH) {
  if (!subjectCanvas) return;
  ctx.clearRect(0, 0, outW, outH);
  drawBackground(ctx, P, outW, outH);
  drawCompositeSubject(ctx, subjectCanvas, P, outW, outH);
}

/**
 * Build a full-resolution export canvas from a subject canvas + params.
 * Mirrors drawCompositeScene but scales dc-relative offsets to full size using
 * P.dcWidth / P.dcHeight as the reference display size.
 */
export function buildExportCanvas(subjectCanvas, P) {
  const w = subjectCanvas.width, h = subjectCanvas.height;
  const exp = document.createElement('canvas'); exp.width = w; exp.height = h;
  const ectx = exp.getContext('2d');

  const dcW0 = P.dcWidth || w;
  const ratio = w / dcW0;

  // 1. Background
  if (P.photoBg && P.photoBg.img) {
    ectx.save();
    if (P.bgBlur > 0) ectx.filter = 'blur(' + P.bgBlur + 'px)';
    const imgW = P.photoBg.img.naturalWidth, imgH = P.photoBg.img.naturalHeight;
    const bgSc = P.bgScale != null ? P.bgScale : 1;
    const sc = Math.max(w / imgW, h / imgH) * bgSc;
    ectx.drawImage(P.photoBg.img, (w - imgW * sc) / 2 + (P.bgOffsetX || 0) * ratio, (h - imgH * sc) / 2 + (P.bgOffsetY || 0) * ratio, imgW * sc, imgH * sc);
    ectx.filter = 'none'; ectx.restore();
  } else if (P.bgColor && P.bgColor !== 'transparent') {
    const grad = createGradient(ectx, P.bgColor, w, h);
    ectx.fillStyle = grad || P.bgColor;
    ectx.fillRect(0, 0, w, h);
  }

  // 2. Subject — mirror drawCompositeScene at full res
  const sScale = P.subjectScale != null ? P.subjectScale : 1;
  const dcW = dcW0;
  const dcH = P.dcHeight || h;

  const drawnW_dc = dcW * sScale;
  const drawnH_dc = dcH * sScale;
  const originX_dc = (dcW - drawnW_dc) / 2 + (P.subjectX || 0);
  const originY_dc = (dcH - drawnH_dc) / 2 + (P.subjectY || 0);

  const eSW = drawnW_dc * ratio;
  const eSH = drawnH_dc * ratio;
  const eSX = originX_dc * ratio;
  const eSY = originY_dc * ratio;
  const eCX = eSX + eSW / 2;
  const eCY = eSY + eSH / 2;
  const eRad = (P.subjectRotation || 0) * Math.PI / 180;
  const eFlipX = !!P.flipX, eFlipY = !!P.flipY;

  if (P.glowEnabled && P.glowBlur > 0) {
    const { r, g, b } = hexToRgb(P.glowColor);
    const a = (P.glowStrength != null ? P.glowStrength : 60) / 100;
    ectx.save();
    ectx.translate(eCX, eCY); ectx.rotate(eRad);
    if (eFlipX) ectx.scale(-1, 1);
    if (eFlipY) ectx.scale(1, -1);
    ectx.translate(-eCX, -eCY);
    ectx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    ectx.shadowBlur = P.glowBlur * 2 * ratio;
    ectx.shadowOffsetX = 0;
    ectx.shadowOffsetY = 0;
    const passes = Math.max(1, Math.round((P.glowStrength != null ? P.glowStrength : 60) / 30));
    for (let p = 0; p < passes; p++) ectx.drawImage(subjectCanvas, eSX, eSY, eSW, eSH);
    ectx.restore();
  }

  if (P.shadowEnabled) {
    const rad = (P.shadowAngle || 0) * Math.PI / 180;
    const dx = Math.cos(rad) * (P.shadowDistance || 0) * ratio;
    const dy = Math.sin(rad) * (P.shadowDistance || 0) * ratio;
    const { r, g, b } = hexToRgb(P.shadowColor);
    const a = (P.shadowOpacity != null ? P.shadowOpacity : 60) / 100;
    ectx.save();
    ectx.translate(eCX, eCY); ectx.rotate(eRad);
    if (eFlipX) ectx.scale(-1, 1);
    if (eFlipY) ectx.scale(1, -1);
    ectx.translate(-eCX, -eCY);
    ectx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    ectx.shadowBlur = P.shadowBlur ? P.shadowBlur * ratio : 0;
    ectx.shadowOffsetX = dx;
    ectx.shadowOffsetY = dy;
    ectx.drawImage(subjectCanvas, eSX, eSY, eSW, eSH);
    ectx.restore();
  }

  if (P.outlineEnabled && P.outlineWidth > 0) {
    ectx.save();
    ectx.translate(eCX, eCY); ectx.rotate(eRad);
    if (eFlipX) ectx.scale(-1, 1);
    if (eFlipY) ectx.scale(1, -1);
    ectx.translate(-eCX, -eCY);
    drawOutline(ectx, subjectCanvas, eSX, eSY, eSW, eSH, P.outlineColor, P.outlineWidth * ratio);
    ectx.restore();
  }

  ectx.save();
  ectx.translate(eCX, eCY); ectx.rotate(eRad);
  if (eFlipX) ectx.scale(-1, 1);
  if (eFlipY) ectx.scale(1, -1);
  ectx.translate(-eCX, -eCY);
  const exportFeather = P.featherRadius || 0;
  const featheredExport = exportFeather > 0 ? applyFeatherToCanvas(subjectCanvas, exportFeather) : subjectCanvas;
  ectx.drawImage(featheredExport, eSX, eSY, eSW, eSH);
  ectx.restore();
  return exp;
}

/* ── PHOTO SEARCH (Pexels + Pixabay, infinite scroll, shared state) ── */

export const PIXABAY_API_KEY = '56195183-28e328d32f454f70395ff87ba';
export const PEXELS_API_KEY  = 'o4lyPnNivfvjZiCGp6IfzVomd465edTzsZmJWlUMUHcvuJJoUmLVbAiC';

// Fixed priority: always try Pexels first, fall back to Pixabay if Pexels
// fails or returns no results for that page.
const SOURCE_ORDER = ['pexels', 'pixabay'];

export async function fetchPhotoPage(query, page) {
  for (const src of SOURCE_ORDER) {
    if (src === 'pixabay') {
      try {
        const res = await fetch(
          `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=18&page=${page}&safesearch=true`
        );
        if (!res.ok) throw new Error('pixabay ' + res.status);
        const data = await res.json();
        const hits = data.hits || [];
        if (!hits.length) throw new Error('empty');
        return {
          photos: hits.map(p => ({ thumb: p.webformatURL, full: p.largeImageURL, label: p.user })),
          source: 'pixabay',
          hasMore: data.totalHits > page * 18
        };
      } catch (e) { console.warn('Pixabay failed:', e.message); }
    }

    if (src === 'pexels') {
      try {
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=18&page=${page}&orientation=landscape`,
          { headers: { Authorization: PEXELS_API_KEY } }
        );
        if (!res.ok) throw new Error('pexels ' + res.status);
        const data = await res.json();
        const photos = data.photos || [];
        if (!photos.length) throw new Error('empty');
        return {
          photos: photos.map(p => ({ thumb: p.src.small, full: p.src.large, label: p.photographer })),
          source: 'pexels',
          hasMore: !!data.next_page
        };
      } catch (e) { console.warn('Pexels failed:', e.message); }
    }
  }
  return null;
}

export function appendPhotosToGrid(gridEl, photos, onPick, beforeEl) {
  photos.forEach(({ thumb, full, label }) => {
    const img = document.createElement('img');
    img.className = 'photo-thumb';
    img.title = label || '';
    img.loading = 'lazy';
    img._fullUrl = full;
    // NOTE: no crossOrigin here on purpose. These are display-only preview
    // thumbnails — we never read their pixels. Forcing crossOrigin='anonymous'
    // requires the CDN to send CORS headers; Pixabay/Pexels don't always do
    // that reliably, which made thumbnails randomly fail to show at all.
    img.src = thumb;
    img.onerror = () => {
      if (img._retried) return;
      img._retried = true;
      img.src = thumb + (thumb.includes('?') ? '&' : '?') + '_r=' + Date.now();
    };
    img.addEventListener('click', () => {
      if (img._picking) return;
      onPick(img, full);
    });
    if (beforeEl && beforeEl.parentElement === gridEl) gridEl.insertBefore(img, beforeEl);
    else gridEl.appendChild(img);
  });
}

export function setupInfiniteScroll(gridEl, onLoadMore) {
  // #photo-grid is itself the overflow-y:auto scroll box. The sentinel MUST
  // live inside it to ever move/scroll.
  const old = gridEl.querySelector('.photo-sentinel');
  if (old) old.remove();
  const sentinel = document.createElement('div');
  sentinel.className = 'photo-sentinel';
  sentinel.style.cssText = 'height:1px;width:100%;grid-column:1/-1;';
  gridEl.appendChild(sentinel);
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) onLoadMore();
  }, { root: gridEl, rootMargin: '150px 0px', threshold: 0 });
  obs.observe(sentinel);
  return { obs, sentinel };
}

/**
 * Run a photo search and render results into #photo-grid with infinite scroll.
 * `onPick(imgEl, fullUrl)` is called when the user clicks a thumbnail.
 * Requires DOM: #photo-grid, .photo-search-row button, .photo-attribution.
 */
export async function runPhotoSearch(q, onPick) {
  if (_searching) return;
  _searching = true;
  const searchBtn = document.querySelector('.photo-search-row button');
  if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = '…'; }
  const grid = document.getElementById('photo-grid');
  if (!grid) { _searching = false; return; }
  grid.innerHTML = '<div class="photo-loading">Searching…</div>';

  if (photoObs) { photoObs.obs.disconnect(); photoObs = null; }
  state = { query: q, page: 1, loading: true, exhausted: false, source: '' };

  const result = await fetchPhotoPage(q, 1);
  _searching = false;
  if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = 'Search'; }
  grid.innerHTML = '';
  if (!result || !result.photos.length) {
    grid.innerHTML = '<div class="photo-loading">No results found. Try a different search.</div>';
    return;
  }
  appendPhotosToGrid(grid, result.photos, onPick);
  state = { query: q, page: 1, loading: false, exhausted: !result.hasMore, source: result.source };
  const attr = document.querySelector('.photo-attribution');
  if (attr) {
    attr.innerHTML = result.source === 'pixabay'
      ? 'Photos via <a href="https://pixabay.com" target="_blank">Pixabay</a>'
      : 'Photos via <a href="https://www.pexels.com" target="_blank">Pexels</a>';
  }

  if (result.hasMore) {
    photoObs = setupInfiniteScroll(grid, async () => {
      if (state.loading || state.exhausted) return;
      state.loading = true;
      const nextPage = state.page + 1;
      const more = await fetchPhotoPage(state.query, nextPage);
      if (more && more.photos.length) {
        appendPhotosToGrid(grid, more.photos, onPick, photoObs.sentinel);
        state.page = nextPage;
        state.exhausted = !more.hasMore;
      } else {
        state.exhausted = true;
      }
      state.loading = false;
    });
  }
}
let photoObs = null;
let _searching = false;
let state = { query: '', page: 1, loading: false, exhausted: false, source: '' };

/**
 * Load a photo and apply it as a background. Shared by both tools.
 * `onApplied(url, img)` lets the page refresh its own render.
 */
export async function applyPhotoBgGeneric(el, url, onApplied) {
  if (el._picking) return;
  el._picking = true;
  document.querySelectorAll('.photo-thumb').forEach(t => { t.classList.remove('active'); t._picking = false; });
  el.classList.add('active');
  el.style.opacity = '0.6';
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));

  onApplied({ url, img: el, isPlaceholder: true });

  try {
    const img = await loadImg(url);
    onApplied({ url, img });
  } catch (e) {
    console.warn('applyPhotoBg failed:', e);
  } finally {
    el.style.opacity = '';
    el._picking = false;
  }
}

/* ══════════════════════════════════════════════════════════
   SLIDER ENHANCER
   Converts every <input type=range> + adjacent .slider-val span
   into: [range slider] [editable number box] [↺ mini reset]
   Safe to call more than once — never double-boxes.
   ══════════════════════════════════════════════════════════ */
export function enhanceSliders(root) {
  root = root || document;
  const ranges = root.querySelectorAll('input[type="range"]');

  ranges.forEach(range => {
    if (range.dataset.enhanced === '1') return;

    const valId = range.id + '-val';
    const valSpan = document.getElementById(valId);
    if (!valSpan) return;
    if (valSpan.dataset.enhanced === '1') return;

    const rawText = valSpan.textContent.trim();
    const numMatch = rawText.match(/-?\d+(\.\d+)?/);
    const unit = numMatch ? rawText.slice(numMatch.index + numMatch[0].length) : '';

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.className = 'slider-val-input';
    numInput.id = valId;
    numInput.min = range.min;
    numInput.max = range.max;
    numInput.step = range.step || '1';
    numInput.value = range.value;
    numInput.dataset.enhanced = '1';
    numInput.dataset.unit = unit;

    let unitSpan = null;
    if (unit) {
      unitSpan = document.createElement('span');
      unitSpan.className = 'slider-val-unit';
      unitSpan.textContent = unit;
    }

    const defaultVal = range.getAttribute('value') || range.defaultValue || range.min;
    const miniReset = document.createElement('button');
    miniReset.type = 'button';
    miniReset.className = 'slider-mini-reset';
    miniReset.title = 'Reset this value';
    miniReset.innerHTML = '↺';
    miniReset.addEventListener('click', () => {
      range.value = defaultVal;
      numInput.value = defaultVal;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });

    valSpan.replaceWith(numInput);
    if (unitSpan) numInput.insertAdjacentElement('afterend', unitSpan);
    (unitSpan || numInput).insertAdjacentElement('afterend', miniReset);

    // Back-compat shim: old code does el.textContent = '123%' — keep working.
    Object.defineProperty(numInput, 'textContent', {
      configurable: true,
      get() { return numInput.value + (numInput.dataset.unit || ''); },
      set(text) {
        const m = String(text).match(/-?\d+(\.\d+)?/);
        if (m) numInput.value = m[0];
        const u = m ? String(text).slice(m.index + m[0].length) : '';
        if (u && unitSpan) unitSpan.textContent = u;
      }
    });

    const pushToRange = () => {
      let v = parseFloat(numInput.value);
      if (isNaN(v)) return;
      const min = parseFloat(range.min), max = parseFloat(range.max);
      if (min !== undefined && !isNaN(min)) v = Math.max(min, v);
      if (max !== undefined && !isNaN(max)) v = Math.min(max, v);
      numInput.value = v;
      range.value = v;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    };
    numInput.addEventListener('change', pushToRange);
    numInput.addEventListener('keydown', e => { if (e.key === 'Enter') { pushToRange(); numInput.blur(); } });

    range.addEventListener('input', () => {
      numInput.value = range.value;
    });

    range.dataset.enhanced = '1';
  });
}
