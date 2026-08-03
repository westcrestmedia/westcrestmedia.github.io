/**
 * edge-refine-worker.js — Off-thread alpha edge refinement (guided-filter style matting)
 *
 * Goal: take the AI's binary-ish alpha mask + the original RGB pixels and produce a
 * softer, more detail-preserving alpha specifically along the foreground/background
 * boundary (hair strands, fabric texture, fuzzy edges) — WITHOUT ever touching RGB,
 * WITHOUT blocking the main thread, and WITHOUT ever crashing into a "solid background"
 * state. If anything goes wrong, we postMessage back the original alpha untouched.
 *
 * PERFORMANCE: the naive version of this (full 2D neighborhood scan per edge pixel) is
 * O(edgePixels * radius^2), which is too slow on real camera photos (13-24MP) with large
 * hair/fur regions — it was timing out before finishing. This version uses a SEPARABLE
 * box-style approximation (horizontal pass, then vertical pass) which is O(n * radius),
 * a large speedup, while still being edge-aware via a color-similarity gate per pixel.
 */

self.onmessage = function (e) {
  const { id, width, height, rgba, bandPx, strength } = e.data;
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  try {
    const w = width, h = height;
    const src = new Uint8ClampedArray(rgba); // original RGBA pixels (untouched, used only as guide)
    const n = w * h;

    // 1) Extract alpha
    const alphaIn = new Uint8Array(n);
    for (let i = 0; i < n; i++) alphaIn[i] = src[i * 4 + 3];

    const band = bandPx || 22;

    // 2) Find edge pixels: cheap single-pass check against left/up neighbor (good enough
    //    to locate boundaries) PLUS any pixel that already has partial alpha (soft/uncertain
    //    hair-edge pixels we most want to refine).
    const isEdge = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;
        const a = alphaIn[idx];
        let edge = (a > 0 && a < 255);
        if (!edge && x > 0 && Math.abs(a - alphaIn[idx - 1]) > 15) edge = true;
        if (!edge && y > 0 && Math.abs(a - alphaIn[idx - w]) > 15) edge = true;
        if (edge) isEdge[idx] = 1;
      }
    }

    // 3) Dilate the edge flag outward by `band` px using a SEPARABLE dilation
    //    (horizontal run-spread, then vertical run-spread) — O(n) instead of O(n*r^2).
    const r = Math.max(3, Math.round(band / 2));
    const edgeH = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let countdown = 0;
      for (let x = 0; x < w; x++) {
        if (isEdge[row + x]) countdown = r;
        else if (countdown > 0) countdown--;
        if (countdown > 0 || isEdge[row + x]) edgeH[row + x] = 1;
      }
      countdown = 0;
      for (let x = w - 1; x >= 0; x--) {
        if (isEdge[row + x]) countdown = r;
        else if (countdown > 0) countdown--;
        if (countdown > 0 || isEdge[row + x]) edgeH[row + x] = 1;
      }
    }
    const edgeDilated = new Uint8Array(n);
    for (let x = 0; x < w; x++) {
      let countdown = 0;
      for (let y = 0; y < h; y++) {
        const idx = y * w + x;
        if (edgeH[idx]) countdown = r;
        else if (countdown > 0) countdown--;
        if (countdown > 0 || edgeH[idx]) edgeDilated[idx] = 1;
      }
      countdown = 0;
      for (let y = h - 1; y >= 0; y--) {
        const idx = y * w + x;
        if (edgeH[idx]) countdown = r;
        else if (countdown > 0) countdown--;
        if (countdown > 0 || edgeH[idx]) edgeDilated[idx] = 1;
      }
    }

    // 4) Separable, edge-aware box refinement applied ONLY to flagged pixels:
    //    Pass A (horizontal): for each flagged pixel, average alpha over a horizontal
    //    window, gated by color similarity to the center pixel (so it still respects
    //    hair-strand boundaries instead of blindly blurring across them).
    //    Pass B (vertical): same, but reading Pass A's result and gating against the
    //    ORIGINAL pixel color at each row position.
    //    This two-pass separable approach approximates the full 2D weighted filter at a
    //    fraction of the cost, which is what makes 13-24MP images finish in time.
    let edgeCount = 0;
    for (let i = 0; i < n; i++) if (edgeDilated[i]) edgeCount++;

    // Safety valve: if the edge band ended up covering most of the image (rare, but
    // can happen with very noisy/grainy masks), shrink the filter radius so the total
    // work stays bounded — this trades a bit of softness for guaranteed completion
    // instead of timing out and falling back to the unrefined mask.
    let rad = Math.max(3, Math.round(band / 2.5));
    const edgeFraction = edgeCount / n;
    if (edgeFraction > 0.35) rad = Math.max(2, Math.round(rad * 0.4));
    else if (edgeFraction > 0.18) rad = Math.max(2, Math.round(rad * 0.6));

    const sFactor = (typeof strength === 'number' ? strength : 0.85);

    const passA = new Float32Array(n); // intermediate horizontally-filtered alpha
    const passAWeight = new Float32Array(n);

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;
        if (!edgeDilated[idx]) { passA[idx] = alphaIn[idx]; passAWeight[idx] = 1; continue; }

        const cIdx = idx * 4;
        const cr = src[cIdx], cg = src[cIdx + 1], cb = src[cIdx + 2];

        let wsum = 0, asum = 0;
        const x0 = Math.max(0, x - rad), x1 = Math.min(w - 1, x + rad);
        for (let nx = x0; nx <= x1; nx++) {
          const nIdx = row + nx;
          const nPix = nIdx * 4;
          const dr = cr - src[nPix], dg = cg - src[nPix + 1], db = cb - src[nPix + 2];
          const colorDist = dr * dr + dg * dg + db * db;
          const dx = nx - x;
          const weight = Math.exp(-colorDist / 9000) * Math.exp(-(dx * dx) / (2 * rad * rad));
          wsum += weight;
          asum += weight * alphaIn[nIdx];
        }
        passA[idx] = wsum > 0 ? asum / wsum : alphaIn[idx];
        passAWeight[idx] = 1;
      }
    }

    const alphaOut = new Uint8Array(alphaIn); // safe fallback baseline
    let refinedCount = 0;

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const idx = y * w + x;
        if (!edgeDilated[idx]) continue;

        const cIdx = idx * 4;
        const cr = src[cIdx], cg = src[cIdx + 1], cb = src[cIdx + 2];

        let wsum = 0, asum = 0;
        const y0 = Math.max(0, y - rad), y1 = Math.min(h - 1, y + rad);
        for (let ny = y0; ny <= y1; ny++) {
          const nIdx = ny * w + x;
          const nPix = nIdx * 4;
          const dr = cr - src[nPix], dg = cg - src[nPix + 1], db = cb - src[nPix + 2];
          const colorDist = dr * dr + dg * dg + db * db;
          const dy = ny - y;
          const weight = Math.exp(-colorDist / 9000) * Math.exp(-(dy * dy) / (2 * rad * rad));
          wsum += weight;
          asum += weight * passA[nIdx];
        }
        const refined = wsum > 0 ? asum / wsum : passA[idx];
        alphaOut[idx] = Math.round(alphaIn[idx] * (1 - sFactor) + refined * sFactor);
        refinedCount++;
      }
    }

    // 5) Write refined alpha back into a fresh RGBA buffer — RGB is NEVER modified,
    //    so there is no possibility of this producing a solid-color background.
    const out = new Uint8ClampedArray(src); // copy original RGB+old alpha
    for (let i = 0; i < n; i++) out[i * 4 + 3] = alphaOut[i];

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    self.postMessage({ id, ok: true, rgba: out.buffer, edgePixelCount: refinedCount, elapsedMs: elapsed }, [out.buffer]);
  } catch (err) {
    // Never let a worker error corrupt the image — caller will fall back to the
    // original unrefined mask it already has.
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
