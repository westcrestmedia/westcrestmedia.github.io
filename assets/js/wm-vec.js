// wm-vec.js — shared text & shape drawing engine for Westcrest Media tools.
// Pure data catalogs + canvas drawing helpers. No DOM state, no app logic,
// so every tool (photo-editor-pro, thumbnail-maker, …) can import the same
// fonts, shapes and draw routines instead of duplicating them.

export const GOOGLE_FONTS = [
  'Bebas Neue', 'Anton', 'Oswald', 'Montserrat', 'Playfair Display', 'Cormorant Garamond', 'Rajdhani', 'Syne',
  'Barlow Condensed', 'Righteous', 'Permanent Marker', 'Russo One', 'Orbitron', 'Pacifico', 'Lobster',
  'Black Han Sans', 'Teko', 'Bungee', 'Alfa Slab One', 'Exo 2', 'Chakra Petch', 'Archivo Black', 'Caveat',
  'Indie Flower', 'Shrikhand', 'Baloo 2', 'Kalam', 'Passion One', 'Bowlby One SC', 'Squada One', 'Titan One',
  'Luckiest Guy', 'Fredoka', 'Press Start 2P', 'Audiowide', 'Monoton', 'Comfortaa', 'Great Vibes', 'Cinzel',
  'Lora', 'Merriweather', 'Ubuntu', 'Overpass', 'Dancing Script'
];

export const SYSTEM_FONTS = [
  'Arial', 'Arial Black', 'Arial Narrow', 'Assistant', 'Bahnschrift', 'Baskerville', 'Book Antiqua', 'Bookman Old Style',
  'Brush Script MT', 'Calibri', 'Cambria', 'Candara', 'Century', 'Century Gothic', 'Comic Sans MS', 'Copperplate',
  'Corbel', 'Courier', 'Courier New', 'DejaVu Sans', 'DejaVu Serif', 'Eurostile', 'Footlight MT Light', 'Franklin Gothic Medium',
  'Georgia', 'Gill Sans', 'HammerKeys', 'Impact', 'Lucida Console', 'Lucida Sans', 'Microsoft JhengHei', 'Microsoft YaHei',
  'Monaco', 'Papyrus', 'Perpetua', 'Pristina', 'Rockwell', 'Segoe Script', 'Segoe UI', 'Sitka Text', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Twentieth Century', 'Verdana', 'Bradley Hand ITC', 'Rage Italic', 'Master of Break',
  'Jokerman', 'Magneto', 'Viner Hand ITC', 'System-wide', 'Palatino Linotype', 'Consolas'
];

export const ALL_FONTS = GOOGLE_FONTS.concat(SYSTEM_FONTS).filter(function (v, i, arr) {
  return arr.indexOf(v) === i;
});

export const SHAPE_META = [
  { id: 'rect', label: 'Rect', svg: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'circle', label: 'Circle', svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'ellipse', label: 'Ellipse', svg: '<ellipse cx="12" cy="12" rx="10" ry="6" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'triangle', label: 'Triangle', svg: '<path d="M12 3.5 21 20H3Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'diamond', label: 'Diamond', svg: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'hexagon', label: 'Hexagon', svg: '<path d="M12 2.5 20.5 7.5V16.5L12 21.5 3.5 16.5V7.5Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'octagon', label: 'Octagon', svg: '<path d="M8.5 2.5H15.5L21.5 8.5V15.5L15.5 21.5H8.5L2.5 15.5V8.5Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'star', label: 'Star', svg: '<path d="M12 2 14.5 8.5 21 9 16 13.5 17.5 20 12 16.5 6.5 20 8 13.5 3 9 9.5 8.5Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'burst', label: 'Burst', svg: '<path d="M12 2l1.6 3.8 4-1.4-1.4 4 3.8 1.6-3.8 1.6 1.4 4-4-1.4-1.6 3.8-1.6-3.8-4 1.4 1.4-4-3.8-1.6 3.8-1.6-1.4-4 4 1.4Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'heart', label: 'Heart', svg: '<path d="M12 20S5 16 5 11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5-7 9-7 9z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'arrow', label: 'Arrow', svg: '<path d="M3 12h15l-4.5-4.5L15 6l6 6-6 6-1.5-1.5L18 13H3z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'arrow-down', label: 'Down', svg: '<path d="M12 21 4 13l1.5-1.5L11 16V3h2v13l5.5-4.5L20 13z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'chevron', label: 'Chevron', svg: '<path d="M3 12h13.5L12 7l1.5-1.5L21 12l-7.5 6.5L12 17l4.5-5H3z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'ribbon', label: 'Ribbon', svg: '<path d="M3 4h18l-2 8 2 8H3l2-8Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'speech', label: 'Speech', svg: '<path d="M3 4h18v13h-9l-6 4-1.5-2H3Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'cross', label: 'Cross', svg: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'parallelogram', label: 'Slant', svg: '<path d="M5 4h16l-2 16H3Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'cloud', label: 'Cloud', svg: '<path d="M8 18h9a4.5 4.5 0 0 0 .5-8.97A5.5 5.5 0 0 0 7.3 9 4 4 0 0 0 8 18z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'blob', label: 'Blob', svg: '<path d="M12 2c5 1 8 4 8 8s-3 7-8 8-8-3-8-8 3-7 8-8z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'ring', label: 'Ring', svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>' },
  { id: 'semicircle', label: 'Semi', svg: '<path d="M3 12a9 9 0 0 1 18 0Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'quarter', label: 'Quarter', svg: '<path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'trapezoid', label: 'Trapezoid', svg: '<path d="M6 4h12l3 16H3Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'pentagon', label: 'Pentagon', svg: '<path d="M12 3 21.5 9.5 18 20.5H6L2.5 9.5Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'play', label: 'Play', svg: '<path d="m9 5 10 7-10 7Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'pause', label: 'Pause', svg: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>' },
  { id: 'plus', label: 'Plus', svg: '<path d="M12 4v16M4 12h16"/>' },
  { id: 'minus', label: 'Minus', svg: '<path d="M4 12h16"/>' },
  { id: 'check', label: 'Check', svg: '<path d="m4 12.5 5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.5"/>' },
  { id: 'moon', label: 'Moon', svg: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="2"/>' },
  { id: 'sun', label: 'Sun', svg: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>' }
];

export function fontStack(name) {
  return '"' + String(name || 'Arial').replace(/"/g, '') + '"';
}

export function hexToRgba(hex, a) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return 'rgba(0,0,0,' + (a == null ? 1 : a) + ')';
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + (a == null ? 1 : a) + ')';
}

export function gradFor(c, x, y, w, h, c1, c2, dir) {
  let g;
  if (dir === 'lr') g = c.createLinearGradient(x, y + h / 2, x + w, y + h / 2);
  else if (dir === 'diag') g = c.createLinearGradient(x, y, x + w, y + h);
  else g = c.createLinearGradient(x + w / 2, y, x + w / 2, y + h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

/* ---- shape path builders (path only, so fill & stroke both work) ---- */
function roundedRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}
function ngon(c, cx, cy, R, n, rot) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i * (2 * Math.PI)) / n;
    const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}
function starPathG(c, cx, cy, R, r, n, rot) {
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = rot + (i * Math.PI) / n;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}
function arrowPath(c, x, y, w, h, cy) {
  c.moveTo(x, y + h * 0.15);
  c.lineTo(x + w * 0.55, y + h * 0.15);
  c.lineTo(x + w * 0.55, y);
  c.lineTo(x + w, cy);
  c.lineTo(x + w * 0.55, y + h);
  c.lineTo(x + w * 0.55, y + h * 0.85);
  c.lineTo(x, y + h * 0.85);
  c.closePath();
}
function arrowDownPath(c, x, y, w, h, cx) {
  c.moveTo(x + w * 0.15, y);
  c.lineTo(x + w * 0.15, y + h * 0.55);
  c.lineTo(x, y + h * 0.55);
  c.lineTo(cx, y + h);
  c.lineTo(x + w, y + h * 0.55);
  c.lineTo(x + w * 0.85, y + h * 0.55);
  c.lineTo(x + w * 0.85, y);
  c.closePath();
}

export function pathShape(c, type, x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2;
  const R = Math.min(w, h) / 2;
  c.beginPath();
  switch (type) {
    case 'rect': roundedRectPath(c, x, y, w, h, r || 0); break;
    case 'circle': c.arc(cx, cy, R, 0, Math.PI * 2); break;
    case 'ellipse': c.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'triangle': c.moveTo(cx, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); break;
    case 'diamond': c.moveTo(cx, y); c.lineTo(x + w, cy); c.lineTo(cx, y + h); c.lineTo(x, cy); c.closePath(); break;
    case 'hexagon': ngon(c, cx, cy, R, 6, 0); break;
    case 'octagon': ngon(c, cx, cy, R, 8, Math.PI / 8); break;
    case 'star': starPathG(c, cx, cy, R, R * 0.45, 5, -Math.PI / 2); break;
    case 'burst': starPathG(c, cx, cy, R, R * 0.55, 6, -Math.PI / 2); break;
    case 'heart':
      c.moveTo(cx, cy + R * 0.45);
      c.bezierCurveTo(cx + R, cy + R * 0.7, cx + R * 1.15, cy - R * 0.35, cx, cy - R * 0.6);
      c.bezierCurveTo(cx - R * 1.15, cy - R * 0.35, cx - R, cy + R * 0.7, cx, cy + R * 0.45);
      c.closePath(); break;
    case 'arrow': arrowPath(c, x, y, w, h, cy); break;
    case 'arrow-down': arrowDownPath(c, x, y, w, h, cx); break;
    case 'chevron':
      c.moveTo(x, y); c.lineTo(x + w * 0.6, cy); c.lineTo(x + w * 0.25, y + h);
      c.lineTo(x + w * 0.85, cy); c.lineTo(x + w * 0.25, y); c.closePath(); break;
    case 'ribbon':
      c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w * 0.85, cy);
      c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.lineTo(x + w * 0.12, cy); c.closePath(); break;
    case 'speech':
      roundedRectPath(c, x, y, w, h, r && r > 0 ? r : 4);
      c.moveTo(x + w * 0.28, y + h);
      c.lineTo(x + w * 0.42, y + h + h * 0.25);
      c.lineTo(x + w * 0.56, y + h);
      c.closePath(); break;
    case 'cross': {
      const t = Math.min(w, h) * 0.28;
      c.moveTo(cx - t, y); c.lineTo(cx + t, y); c.lineTo(cx + t, cy - t);
      c.lineTo(x + w, cy - t); c.lineTo(x + w, cy + t); c.lineTo(cx + t, cy + t);
      c.lineTo(cx + t, y + h); c.lineTo(cx - t, y + h); c.lineTo(cx - t, cy + t);
      c.lineTo(x, cy + t); c.lineTo(x, cy - t); c.lineTo(cx - t, cy - t); c.closePath(); break;
    }
    case 'parallelogram':
      c.moveTo(x + w * 0.18, y); c.lineTo(x + w, y); c.lineTo(x + w * 0.82, y + h); c.lineTo(x, y + h); c.closePath(); break;
    case 'cloud':
      c.moveTo(x + w * 0.2, y + h);
      c.arc(x + w * 0.22, y + h * 0.6, h * 0.22, Math.PI * 0.5, Math.PI * 1.55);
      c.arc(cx, y + h * 0.4, h * 0.38, Math.PI * 1.2, Math.PI * 1.85);
      c.arc(x + w * 0.78, y + h * 0.6, h * 0.22, Math.PI * 1.5, Math.PI * 2.5);
      c.arc(x + w * 0.8, y + h * 0.8, h * 0.16, 0, Math.PI * 0.5);
      c.arc(x + w * 0.2, y + h * 0.8, h * 0.16, Math.PI * 0.5, Math.PI);
      c.closePath(); break;
    case 'blob': {
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const j = 1 + 0.22 * Math.sin(a * 3) * Math.sin(a * 2 + 0.5);
        const px = cx + Math.cos(a) * (w / 2) * j, py = cy + Math.sin(a) * (h / 2) * j;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); break;
    }
    case 'ring':
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.arc(cx, cy, R * 0.55, 0, Math.PI * 2, true);
      c.closePath(); break;
    case 'semicircle':
      c.arc(cx, cy, R, 0, Math.PI);
      c.closePath(); break;
    case 'quarter':
      c.arc(cx, cy, R, 0, Math.PI / 2);
      c.closePath(); break;
    case 'trapezoid':
      c.moveTo(x + w * 0.22, y); c.lineTo(x + w * 0.78, y);
      c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); break;
    case 'pentagon': ngon(c, cx, cy, R, 5, -Math.PI / 2); break;
    case 'play':
      c.moveTo(x + w * 0.22, y); c.lineTo(x + w, cy); c.lineTo(x + w * 0.22, y + h);
      c.closePath(); break;
    case 'pause':
      c.rect(x + w * 0.22, y, w * 0.24, h);
      c.rect(x + w * 0.54, y, w * 0.24, h);
      break;
    case 'plus':
      c.rect(x + w * 0.34, y, w * 0.32, h);
      c.rect(x, y + h * 0.34, w, h * 0.32);
      break;
    case 'minus':
      c.rect(x, y + h * 0.34, w, h * 0.32);
      break;
    case 'check':
      c.moveTo(x + w * 0.08, y + h * 0.55);
      c.lineTo(x + w * 0.4, y + h * 0.88);
      c.lineTo(x + w * 0.92, y + h * 0.2);
      c.lineTo(x + w * 0.74, y + h * 0.05);
      c.lineTo(x + w * 0.4, y + h * 0.48);
      c.lineTo(x + w * 0.26, y + h * 0.34);
      c.closePath(); break;
    case 'moon':
      c.arc(cx - R * 0.18, cy, R * 0.82, -Math.PI / 2, Math.PI / 2);
      c.arc(cx + R * 0.12, cy, R * 0.92, Math.PI / 2, -Math.PI / 2);
      c.closePath(); break;
    case 'sun': {
      const n = 12;
      for (let i = 0; i < n * 2; i++) {
        const rad = i % 2 === 0 ? R : R * 0.8;
        const a = -Math.PI / 2 + (i * Math.PI) / n;
        const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); break;
    }
  }
}

export function wrapText(c, txt, maxW) {
  const lines = String(txt || ' ').split('\n');
  const out = [];
  lines.forEach(function (line) {
    if (line === '') { out.push(''); return; }
    if (c.measureText(line).width <= maxW) { out.push(line); return; }
    const words = line.split(' ');
    let cur = '';
    words.forEach(function (word) {
      const test = cur ? cur + ' ' + word : word;
      if (c.measureText(test).width <= maxW || !cur) cur = test;
      else { out.push(cur); cur = word; }
    });
    if (cur) out.push(cur);
  });
  return out;
}

/* ---- drawing (L = layer object with base-space geometry + style fields) ---- */
export function drawTextInto(c, L, scale) {
  const size = Math.max(1, (L.size || 0) * scale);
  const boxX = L.x * scale, boxY = L.y * scale;
  const boxW = Math.max(1, L.w * scale), boxH = L.h * scale;
  c.font = (L.italic ? 'italic ' : '') + (L.weight || 400) + ' ' + size + 'px ' + fontStack(L.font);
  c.textBaseline = 'middle';
  const align = L.align || 'center';
  c.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
  const sp = (L.spacing || 0) * scale;
  const txt = L.allcaps ? String(L.text).toUpperCase() : String(L.text || ' ');
  const lines = wrapText(c, txt, Math.max(10, boxW - size));
  const lh = size * (L.lineH || 1);
  const totalH = lines.length * lh;
  let y = boxY + boxH / 2 - totalH / 2 + lh / 2;
  const anchorX = align === 'left' ? boxX : align === 'right' ? boxX + boxW : boxX + boxW / 2;
  const strokeOn = L.strokeEnabled && L.strokeWidth > 0;
  c.letterSpacing = sp + 'px';
  lines.forEach(function (ln) {
    if (strokeOn) {
      c.save();
      c.strokeStyle = L.strokeColor || '#000000';
      c.lineWidth = Math.max(1e-3, (L.strokeWidth || 0) * scale);
      c.lineJoin = 'round';
      c.strokeText(ln, anchorX, y);
      c.restore();
    }
    if (L.fillType !== 'transparent') {
      c.fillStyle = L.fillType === 'gradient'
        ? gradFor(c, boxX, boxY, boxW, boxH, L.grad1, L.grad2, L.gradDir)
        : (L.color || '#ffffff');
      c.fillText(ln, anchorX, y);
    }
    y += lh;
  });
  c.letterSpacing = '0px';
}

function paintShapePath(c, L, x, y, w, h, scale) {
  if (L.shape === 'freehand') {
    const pts = L.poly || [];
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const px = x + pts[i][0] * w, py = y + pts[i][1] * h;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    if (L.pathClosed !== false) c.closePath();
  } else {
    pathShape(c, L.shape, x, y, w, h, (L.radius || 0) * scale);
  }
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const bw = L.borderEnabled ? (L.borderWidth || 0) * scale : 0;
  if (L.fillType === 'none') {
    if (bw > 0) { strokeShape(c, L, bw); }
  } else {
    c.fillStyle = L.fillType === 'gradient'
      ? gradFor(c, x, y, w, h, L.grad1, L.grad2, L.gradDir)
      : (L.color || '#c8a96e');
    c.fill();
    if (bw > 0) strokeShape(c, L, bw);
  }
}

function bendAmount(b, side) {
  return Math.max(-1, Math.min(1, +(b && b[side]) || 0));
}

/* Side-bend warp: takes the shape drawn into an offscreen "src" canvas and
   returns a new canvas whose edges curve in/down/up/etc. Works for ANY shape
   because it warps pixels, not just vertices. bend = {top,bottom,left,right}
   in -1..1 (magnitude scaled to ~0.45 of the side length). */
function warpBend(src, bend) {
  const W = src.width, H = src.height;
  const sr = src.getContext('2d').getImageData(0, 0, W, H).data;
  const cap = 620;
  const k = Math.min(1, cap / Math.max(W, H));
  const ow = Math.max(1, Math.round(W * k)), oh = Math.max(1, Math.round(H * k));
  const out = document.createElement('canvas');
  out.width = ow; out.height = oh;
  const octx = out.getContext('2d');
  const oid = octx.createImageData(ow, oh);
  const od = oid.data;
  const tA = bend.top * 0.45 * oh, bA = bend.bottom * 0.45 * oh;
  const lA = bend.left * 0.45 * ow, rA = bend.right * 0.45 * ow;
  const PI = Math.PI;
  function getSX(nx, ny) {
    return lA * Math.sin(PI * ny) * Math.pow(1 - nx, 2) + rA * Math.sin(PI * ny) * Math.pow(nx, 2);
  }
  function getSY(nx, ny) {
    return tA * Math.sin(PI * nx) * Math.pow(1 - ny, 2) + bA * Math.sin(PI * nx) * Math.pow(ny, 2);
  }
  for (let y = 0; y < oh; y++) {
    const ny = y / (oh - 1 || 1);
    for (let x = 0; x < ow; x++) {
      const nx = x / (ow - 1 || 1);
      let sx = (x / k) + getSX(nx, ny);
      let sy = (y / k) + getSY(nx, ny);
      // bilinear sample
      sx = Math.max(0, Math.min(W - 1.001, sx));
      sy = Math.max(0, Math.min(H - 1.001, sy));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
      const i00 = (y0 * W + x0) * 4, i10 = (y0 * W + x1) * 4;
      const i01 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
      const o = (y * ow + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const v =
          sr[i00 + ch] * (1 - fx) * (1 - fy) +
          sr[i10 + ch] * fx * (1 - fy) +
          sr[i01 + ch] * (1 - fx) * fy +
          sr[i11 + ch] * fx * fy;
        od[o + ch] = v;
      }
    }
  }
  octx.putImageData(oid, 0, 0);
  return out;
}

export function drawShapeInto(c, L, scale) {
  const x = L.x * scale, y = L.y * scale, w = L.w * scale, h = L.h * scale;
  const b = L.bend;
  const hasBend = b && (b.top || b.bottom || b.left || b.right);
  if (hasBend) {
    const cap = 760;
    const k = Math.min(1, cap / Math.max(w, h));
    const ow = Math.max(1, Math.round(w * k)), oh = Math.max(1, Math.round(h * k));
    const oc = document.createElement('canvas');
    oc.width = ow; oc.height = oh;
    const octx = oc.getContext('2d');
    paintShapePath(octx, L, 0, 0, ow, oh, k);
    const warped = warpBend(oc, b);
    c.drawImage(warped, 0, 0, w, h);
    return;
  }
  paintShapePath(c, L, x, y, w, h, scale);
}

function strokeShape(c, L, bw) {
  c.strokeStyle = L.borderColor || '#ffffff';
  c.lineWidth = Math.max(1e-3, bw);
  if (L.borderDash) c.setLineDash([Math.max(2, bw * 2.2), Math.max(1.5, bw * 1.2)]);
  c.stroke();
  if (L.borderDash) c.setLineDash([]);
}

function applyVecFx(c, L, scale, drawFn) {
  const fx = L.fx || {};
  const hasGlow = fx.glowEnabled && fx.glowBlur > 0;
  const hasShadow = fx.shadowEnabled;
  if (!hasGlow && !hasShadow) { drawFn(); return; }
  if (hasGlow) {
    c.save();
    c.shadowColor = hexToRgba(fx.glowColor || '#c8a96e', (fx.glowStrength != null ? fx.glowStrength : 60) / 100);
    c.shadowBlur = (fx.glowBlur || 0) * scale;
    c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    drawFn();
    c.restore();
  }
  if (hasShadow) {
    c.save();
    const rad2 = (fx.shadowAngle || 135) * Math.PI / 180;
    c.shadowColor = hexToRgba(fx.shadowColor || '#000000', (fx.shadowOpacity != null ? fx.shadowOpacity : 60) / 100);
    c.shadowBlur = (fx.shadowBlur || 0) * scale;
    c.shadowOffsetX = Math.cos(rad2) * (fx.shadowDistance || 0) * scale;
    c.shadowOffsetY = Math.sin(rad2) * (fx.shadowDistance || 0) * scale;
    drawFn();
    c.restore();
  }
  drawFn();
}

export function drawTextLayerContent(c, L, scale) {
  const cx = (L.x + L.w / 2) * scale, cy = (L.y + L.h / 2) * scale;
  const rot = (L.rotation || 0) * Math.PI / 180;
  applyVecFx(c, L, scale, function () {
    c.save();
    if (L.flipX) { c.translate(cx, 0); c.scale(-1, 1); c.translate(-cx, 0); }
    if (L.flipY) { c.translate(0, cy); c.scale(1, -1); c.translate(0, -cy); }
    if (rot) {
      c.save();
      c.translate(cx, cy); c.rotate(rot); c.translate(-cx, -cy);
      drawTextInto(c, L, scale);
      c.restore();
    } else drawTextInto(c, L, scale);
    c.restore();
  });
}

export function drawShapeLayerContent(c, L, scale) {
  const cx = (L.x + L.w / 2) * scale, cy = (L.y + L.h / 2) * scale;
  const rot = (L.rotation || 0) * Math.PI / 180;
  applyVecFx(c, L, scale, function () {
    c.save();
    if (L.flipX) { c.translate(cx, 0); c.scale(-1, 1); c.translate(-cx, 0); }
    if (L.flipY) { c.translate(0, cy); c.scale(1, -1); c.translate(0, -cy); }
    if (rot) {
      c.save();
      c.translate(cx, cy); c.rotate(rot); c.translate(-cx, -cy);
      drawShapeInto(c, L, scale);
      c.restore();
    } else drawShapeInto(c, L, scale);
    c.restore();
  });
}
