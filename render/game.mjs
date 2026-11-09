// 2md55.arch — "every piece was a pawn once"
// Шапка профиля, собранная на canvas из фото-ассетов:
//   • фигуры — рендер CC0-набора Poly Haven «Chess Set» (render/sprites.html → source/sprites/)
//   • руки   — source/gen/hand_{top,bottom,right}.png на зелёном фоне (ключуются здесь)
// Монтаж — по сетке бита (~0.45 с), 20 fps. Кадры квантуются в общую палитру и пишутся в GIF.
//
//   node render/game.mjs                -> assets/header.gif + assets/header-static.png
//   SCALE=2 node render/game.mjs        -> чётче на retina, но GIF ≈ 6 МБ
//   SHEET=path.png node render/game.mjs -> ещё и лист ключевых кадров

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import gifenc from 'gifenc';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { GIFEncoder } = gifenc;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES = n => path.join(ROOT, 'source', 'sprites', `${n}.png`);
const GEN = n => path.join(ROOT, 'source', 'gen', `${n}.png`);

// ───────────────────────── config ─────────────────────────
const LW = 840, LH = 334;         // нижние ~34 px — фейд в фон страницы и чипы стека поверх него
const S = Number(process.env.SCALE ?? 1.5); // 1.5 ≈ 3.8 МБ, 2 — чётче, но ≈ 6 МБ
const WP = Math.round(LW * S), HP = Math.round(LH * S);
const DELAY = 50;                 // 20 fps
const BEAT = 9;                   // 9 кадров ≈ 0.45 с
const BG = [13, 17, 23];          // фон GitHub dark — баннер «растворяется» в странице
const BGS = `rgb(${BG})`;

// таймлайн (кадры)
const T = { flick: 0, pawn: 14, wall: 39, flash: 71, queen: 73, black: 127, king: 130, title: 158, lineup: 186, end: 240 };
const FRAMES = T.end;
const HOLD = { [T.end - 1]: 1900, [T.lineup - 1]: 300 }; // задержка на отдельных кадрах, мс

const WALL =
  'A PAWN MOVES ONE SQUARE AT A TIME AND NEVER GOES BACK. NOBODY GUARDS IT, NOBODY FEARS IT. ' +
  'IT IS SPENT FIRST AND REMEMBERED LAST. BUT THE PAWN THAT REACHES THE FAR SIDE OF THE BOARD ' +
  'BECOMES ANY PIECE IT CHOOSES. EVERY BINARY IS A BOARD. EVERY FUNCTION IS A MOVE. READ THE ' +
  'METADATA, LEARN THE RULES, THEN REWRITE THEM. GAMEASSEMBLY.DLL · GLOBAL-METADATA.DAT · IL2CPP · ' +
  'LUAU · LUNE · 2MD55.ARCH · ';

// ───────────────────────── fonts ─────────────────────────
function font(name, ...paths) {
  for (const p of paths) if (fs.existsSync(p) && GlobalFonts.registerFromPath(p, name)) return `"${name}"`;
  return 'sans-serif';
}
const COND = font('Cond', '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf',
  '/System/Library/Fonts/Supplemental/Impact.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf');
const SYM = font('Sym', '/System/Library/Fonts/Apple Symbols.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
const MONO = font('Mono', '/System/Library/Fonts/Menlo.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf');

// ───────────────────────── math ─────────────────────────
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeOutBack = t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rad = d => (d * Math.PI) / 180;
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hsv(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = c => `rgb(${c.map(Math.round)})`;

// ───────────────────────── palette ─────────────────────────
const IVORY = [242, 236, 220], PINK = [255, 70, 170], YEL = [214, 232, 96], GOLD = [236, 206, 80];
const PAL = [];
for (let i = 0; i < 56; i++) PAL.push(mix(BG, [255, 255, 255], i / 55));
for (let i = 1; i <= 26; i++) PAL.push(mix(BG, IVORY, i / 26));
for (let i = 1; i <= 10; i++) PAL.push(mix(BG, [200, 190, 175], i / 10)); // тёплые полутени фигур
for (let h = 0; h < 24; h++) for (const v of [0.45, 0.72, 1]) PAL.push(hsv(h * 15, 1, v));
for (let h = 0; h < 24; h++) PAL.push(hsv(h * 15, 0.5, 1));
for (let i = 1; i <= 10; i++) PAL.push(mix(BG, PINK, i / 10));
for (let i = 1; i <= 8; i++) PAL.push(mix(BG, YEL, i / 8));
for (let i = 1; i <= 6; i++) PAL.push(mix(BG, GOLD, i / 6));
const USED = PAL.length;
while (PAL.length < 255) PAL.push(BG.slice());
PAL.push([255, 0, 255]);
const TRANSPARENT = 255;
const PALETTE = PAL.map(c => c.map(v => Math.round(clamp(v, 0, 255))));
const LUT = new Uint8Array(32768);
for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
  const R = r * 8 + 4, G = g * 8 + 4, B = b * 8 + 4;
  let best = 0, bd = Infinity;
  for (let i = 0; i < USED; i++) {
    const p = PALETTE[i], dr = R - p[0], dg = G - p[1], db = B - p[2];
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bd) { bd = d; best = i; }
  }
  LUT[(r << 10) | (g << 5) | b] = best;
}

// ───────────────────────── canvas ─────────────────────────
const cvs = createCanvas(WP, HP);
const ctx = cvs.getContext('2d');
const resetCtx = () => {
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.setLineDash([]);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.imageSmoothingEnabled = true;
};
function withPixels(fn) {
  const img = ctx.getImageData(0, 0, WP, HP);
  fn(img.data);
  ctx.putImageData(img, 0, 0);
}
// нарисовать картинку с якорем, поворотом, масштабом и размытием (логические координаты)
function drawImg(can, x, y, w, h, { ang = 0, blur = 0, alpha = 1, ax = 0.5, ay = 0.5, sx = 1, sy = 1, smooth = true } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0.05) ctx.filter = `blur(${(blur * S).toFixed(2)}px)`;
  ctx.imageSmoothingEnabled = smooth;
  ctx.translate(x, y); if (ang) ctx.rotate(ang); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(can, -ax * w, -ay * h, w, h);
  ctx.restore();
}

// ───────────────────────── sprites ─────────────────────────
async function readImage(file) {
  const im = await loadImage(fs.readFileSync(file));
  const c = createCanvas(im.width, im.height), x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  return c;
}
// зелёный фон → альфа, плюс подавление зелёного ореола по краю
function keyGreen(c) {
  const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], m = Math.max(r, b);
    d[i + 3] = Math.round(255 * (1 - clamp((g - m - 18) / 42)));
    if (g > m) d[i + 1] = m + (g - m) * 0.15;
  }
  x.putImageData(id, 0, 0);
  return c;
}
function trim(c, thr = 16) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > thr) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const o = createCanvas(x1 - x0 + 1, y1 - y0 + 1);
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
// масштабировать до высоты hp (физ. px) и посчитать маску/яркость/края силуэта
function sprite(src, hp, { normalize = false, width } = {}) {
  const h = Math.round(width ? (src.height * width) / src.width : hp);
  const w = Math.round(width ?? (src.width * hp) / src.height);
  const can = createCanvas(w, h), c = can.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, w, h);
  const d = c.getImageData(0, 0, w, h).data;
  const alpha = new Uint8Array(w * h), lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { alpha[i] = d[i * 4 + 3]; lum[i] = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255; }
  if (normalize) {
    const v = []; for (let i = 0; i < w * h; i++) if (alpha[i] > 140) v.push(lum[i]);
    v.sort((a, b) => a - b);
    const lo = v[Math.floor(v.length * 0.04)], hi = v[Math.floor(v.length * 0.99)];
    for (let i = 0; i < w * h; i++) lum[i] = clamp((lum[i] - lo) / (hi - lo || 1));
  }
  const left = new Int16Array(h).fill(-1), right = new Int16Array(h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > 128) { if (left[y] < 0) left[y] = x; right[y] = x; }
  return { can, w, h, cx: w / 2, by: h, lum, alpha, left, right, lw: w / S, lh: h / S };
}
// поставить фигуру: (x, base) — центр основания
function placePiece(P, x, base, { alpha = 1, blur = 0, ang = 0, sx = 1 } = {}) {
  drawImg(P.can, x, base, P.lw, P.lh, { alpha, blur, ang, sx, ax: 0.5, ay: 1 });
  return { X: Math.round(x * S - P.cx), Y: Math.round(base * S - P.by) };
}
function pixelate(P, cell, tint) {
  const sw = Math.max(1, Math.round(P.w / (cell * S))), sh = Math.max(1, Math.round(P.h / (cell * S)));
  const c = createCanvas(sw, sh), x = c.getContext('2d');
  x.drawImage(P.can, 0, 0, sw, sh);
  const id = x.getImageData(0, 0, sw, sh), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = d[i + 3] > 110 ? 255 : 0;
    if (tint) { d[i] = lerp(d[i], tint[0], 0.3); d[i + 1] = lerp(d[i + 1], tint[1], 0.3); d[i + 2] = lerp(d[i + 2], tint[2], 0.3); }
  }
  x.putImageData(id, 0, 0);
  return c;
}

// ───────────────────────── effects ─────────────────────────
// радужный датамош-шлейф от края силуэта по горизонтали
function smear(d, P, X0, Y0, dir, len, f, seed = 0) {
  if (len <= 1) return;
  for (let j = 0; j < P.h; j++) {
    const e = dir > 0 ? P.right[j] : P.left[j];
    const yy = Y0 + j;
    if (e < 0 || yy < 0 || yy >= HP) continue;
    const nz = 0.6 + 0.4 * Math.sin(j * 0.031 + f * 0.7 + seed) * Math.cos(j * 0.013 - f * 0.4);
    const L = len * S * nz;
    const wob = Math.sin(j * 0.018 + f * 0.6 + seed) * 10 * S;
    for (let k = 0; k < L; k++) {
      const t = k / L;
      const xx = Math.round(X0 + e + dir * (k + 1) + wob * t * t);
      if (xx < 0 || xx >= WP) continue;
      const hue = ((((k / S) * 2.3 + (j / S) * 0.35 - f * 26) % 360) + 360) % 360;
      const [r, g, b] = hsv(hue, 1, 0.3 + 0.7 * (1 - Math.pow(t, 2.2)));
      const o = (yy * WP + xx) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b;
    }
  }
}
// то же вниз: шлейф из-под силуэта (альфа-маска произвольного холста)
function smearDown(d, alpha, w, h, X0, Y0, len, f) {
  for (let i = 0; i < w; i++) {
    let bottom = -1;
    for (let y = h - 1; y >= 0; y--) if (alpha[(y * w + i) * 4 + 3] > 128) { bottom = y; break; }
    if (bottom < 0) continue;
    const xx0 = X0 + i;
    const nz = 0.7 + 0.3 * Math.sin(i * 0.04 + f * 0.5);
    const L = len * S * nz;
    for (let k = 0; k < L; k++) {
      const t = k / L, yy = Y0 + bottom + k + 1;
      const xx = Math.round(xx0 + Math.sin(k * 0.03 + f * 0.4) * 6 * S * t);
      if (yy < 0 || yy >= HP || xx < 0 || xx >= WP) continue;
      const hue = ((((k / S) * 2.6 - (i / S) * 0.4 - f * 22) % 360) + 360) % 360;
      const [r, g, b] = hsv(hue, 1, 0.35 + 0.65 * (1 - Math.pow(t, 2)));
      const o = (yy * WP + xx) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b;
    }
  }
}
// чёрно-белые «битые» блоки
function moshBlocks(d, x0, y0, w, h, f, density, seed, mask) {
  const R = rng(f * 131 + seed), B = Math.max(2, Math.round(4 * S));
  for (let by = Math.max(0, y0); by < Math.min(HP, y0 + h); by += B) for (let bx = Math.max(0, x0); bx < Math.min(WP, x0 + w); bx += B) {
    const pick = R();
    if (mask && !mask(bx + B / 2, by + B / 2)) continue;
    if (pick > density) continue;
    const v = R() < 0.5 ? 0 : 245, checker = R() < 0.3;
    for (let y = by; y < Math.min(HP, by + B); y++) for (let x = bx; x < Math.min(WP, bx + B); x++) {
      const vv = checker ? (((x >> 1) + (y >> 1)) & 1 ? 245 : 0) : v;
      const o = (y * WP + x) * 4; d[o] = d[o + 1] = d[o + 2] = vv;
    }
  }
}
// whip-переход: сдвиг влево + горизонтальный моушн-блюр
function whip(d, shift, radius) {
  const row = new Float32Array((WP + 1) * 3);
  for (let y = 0; y < HP; y++) {
    const o = y * WP * 4;
    row[0] = row[1] = row[2] = 0;
    for (let x = 0; x < WP; x++) for (let c = 0; c < 3; c++) row[(x + 1) * 3 + c] = row[x * 3 + c] + d[o + x * 4 + c];
    for (let x = 0; x < WP; x++) {
      const a = clamp(x + shift - radius, 0, WP), b = clamp(x + shift + radius, 0, WP), n = Math.max(1, b - a);
      for (let c = 0; c < 3; c++) {
        const v = b > a ? (row[b * 3 + c] - row[a * 3 + c]) / n : BG[c];
        d[o + x * 4 + c] = b > a ? lerp(BG[c], v, n / (2 * radius)) : BG[c];
      }
    }
  }
}

// ───────────────────────── hands ─────────────────────────
// Зернистый «песочный» силуэт как в рефе: белое зерно по яркости кожи.
function grainHand(src, longSide, arm) {
  const tall = src.height >= src.width;
  const spr = tall ? sprite(src, longSide * S, { normalize: true }) : sprite(src, 0, { normalize: true, width: longSide * S });
  const c = spr.can.getContext('2d'), id = c.getImageData(0, 0, spr.w, spr.h), d = id.data;
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    const i = y * spr.w + x, o = i * 4;
    if (spr.alpha[i] < 120) { d[o + 3] = 0; continue; }
    const v = Math.pow(clamp((spr.lum[i] - 0.05) / 0.9), 0.85), g = hash2(x >> 1, y >> 1); // зерно 2×2 — легче для GIF
    const c0 = g < v ? 238 : g < v + 0.2 ? 150 : 58;
    d[o] = d[o + 1] = c0; d[o + 2] = c0 - 3; d[o + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  let tx = 0, ty = 0, best = -Infinity; // кончик — крайняя точка со стороны, противоположной руке
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    if (spr.alpha[y * spr.w + x] < 128) continue;
    const s = arm === 'top' ? y : arm === 'bottom' ? -y : arm === 'right' ? -x : x;
    if (s > best) { best = s; tx = x; ty = y; }
  }
  return { ...spr, tipX: tx, tipY: ty };
}

// ───────────────────────── text helpers ─────────────────────────
function txt(s, x, y, { size = 10, face = MONO, color = '#fff', align = 'left', alpha = 1 } = {}) {
  ctx.font = `${size}px ${face}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  return ctx.measureText(s).width;
}
const coord = (x, y, f, k = 0) => {
  const j = n => Math.round(n + (hash2(f, k * 31 + n) - 0.5) * 6);
  return `x: ${j(x * 1.74)} y: ${j(y * 3.1)}`;
};
function dotted(points, { color = '#ddd', dash = [1.5, 3], alpha = 0.8, offset = 0 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 0.8;
  ctx.setLineDash(dash); ctx.lineDashOffset = offset;
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.stroke(); ctx.restore();
}

// ───────────────────────── assets ─────────────────────────
const t0 = Date.now();
const src = {};
for (const n of ['w_pawn', 'w_rook', 'w_king', 'w_queen', 'w_bishop', 'w_knight_a', 'w_queen_big', 'b_king']) src[n] = trim(await readImage(SPRITES(n)));
const QUEEN = sprite(src.w_queen_big, 262 * S, { normalize: true });
const KING_B = sprite(src.b_king, 222 * S);
const KING_BIG = sprite(src.b_king, 430 * S);
const PAWN_M = sprite(src.w_pawn, 150 * S);
const KNIGHT_BIG = sprite(src.w_knight_a, 300 * S);
const GHOST = sprite(src.w_pawn, 70 * S, { normalize: true });
const LINEUP = ['w_pawn', 'w_rook', 'w_king', 'w_queen', 'w_bishop', 'w_knight_a']
  .map(n => sprite(src[n], (168 * S * src[n].height) / src.w_king.height)); // общий масштаб набора
const QPIX = { pixel: pixelate(QUEEN, 6), pixel2: pixelate(QUEEN, 9), photo: pixelate(QUEEN, 4.5, PINK) };
// холст для повёрнутого короля (из него же берём маску для шлейфа)
const KDIAG = Math.ceil(Math.hypot(KING_B.w, KING_B.h)) + 4;
const KCAN = createCanvas(KDIAG, KDIAG), KCTX = KCAN.getContext('2d');

// рамки с руками: въезжают с краёв и дрейфуют (логические координаты)
const HANDS = [
  { file: 'hand_right', arm: 'right', enter: 4, from: [880, 18], to: [640, 26], drift: [-0.55, 0.3], w: 160, h: 122, long: 270, rot: -14, tip: [0.08, 0.7], phase: 3.1 },
  { file: 'hand_top', arm: 'top', enter: 8, from: [-200, 30], to: [96, 22], drift: [0.5, 0.2], w: 158, h: 120, long: 205, rot: -28, tip: [0.7, 0.93], phase: 0 },
  { file: 'hand_bottom', arm: 'bottom', enter: 12, from: [880, 190], to: [672, 168], drift: [-0.4, -0.25], w: 136, h: 108, long: 185, rot: 24, tip: [0.62, 0.08], phase: 1.7 },
];
for (const H of HANDS) H.spr = grainHand(trim(keyGreen(await readImage(GEN(H.file)))), H.long, H.arm);
console.log(`assets ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ───────────────────────── bottom fade + stack chips ─────────────────────────
// GitHub не даёт наложить HTML поверх картинки, поэтому «бэйджи» вшиты в сам кадр:
// низ каждого кадра растворяется в фон страницы, а чипы лежат поверх фейда.
const STACK = ['c++', 'luau', 'lua', 'typescript', 'python'];
const FADE_FROM = 246;
const FADE = new Float32Array(HP);
for (let y = 0; y < HP; y++) FADE[y] = Math.pow(clamp((y / S - FADE_FROM) / (LH - 4 - FADE_FROM)), 1.6);
const CHIPS = (() => {
  const c = createCanvas(WP, HP), x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, 0, 0);
  x.font = `13px ${MONO}`;
  const padX = 7, h = 22, gap = 8, r = 6;
  const ws = STACK.map(s => x.measureText(s).width + padX * 2);
  let cx = (LW - ws.reduce((a, b) => a + b, 0) - gap * (STACK.length - 1)) / 2;
  const y = LH - h - 8;
  STACK.forEach((s, i) => {
    const w = ws[i];
    x.fillStyle = 'rgb(52,57,65)'; // цвет инлайн-кода GitHub в тёмной теме
    x.beginPath();
    x.moveTo(cx + r, y); x.arcTo(cx + w, y, cx + w, y + h, r); x.arcTo(cx + w, y + h, cx, y + h, r);
    x.arcTo(cx, y + h, cx, y, r); x.arcTo(cx, y, cx + w, y, r); x.closePath(); x.fill();
    x.fillStyle = '#e6edf3'; x.fillText(s, cx + padX, y + 15.5);
    cx += w + gap;
  });
  return x.getImageData(0, 0, WP, HP).data;
})();
function finishFrame(d) {
  for (let y = Math.floor(FADE_FROM * S); y < HP; y++) {
    const a = FADE[y], o = y * WP * 4;
    if (a <= 0) continue;
    for (let i = o; i < o + WP * 4; i += 4) {
      d[i] += (BG[0] - d[i]) * a; d[i + 1] += (BG[1] - d[i + 1]) * a; d[i + 2] += (BG[2] - d[i + 2]) * a;
      const k = CHIPS[i + 3] / 255;
      if (k) { d[i] += (CHIPS[i] - d[i]) * k; d[i + 1] += (CHIPS[i + 1] - d[i + 1]) * k; d[i + 2] += (CHIPS[i + 2] - d[i + 2]) * k; }
    }
  }
}

// ───────────────────────── boards ─────────────────────────
const POSITIONS = [
  ['rnbqkbnr', 'pppppppp', '........', '........', '....P...', '........', 'PPPP.PPP', 'RNBQKBNR'],
  ['r.bqkb.r', 'pppp.ppp', '..n..n..', '....p...', '..B.P...', '.....N..', 'PPPP.PPP', 'RNBQK..R'],
  ['r...k..r', 'ppp..ppp', '..nb.n..', '...pp...', '...P.B..', '..N..N..', 'PPP.QPPP', 'R...KB.R'],
  ['....k...', '..R.....', '....K...', '........', '........', '........', '........', '........'],
];
const GLY = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
function drawBoard(pos, x, y, sq, { light = '#ececec', dark = '#a9a9a9', frame = '#000', glyphs = true } = {}) {
  ctx.fillStyle = frame; ctx.fillRect(x - sq * 0.15, y - sq * 0.15, sq * 8.3, sq * 8.3);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    ctx.fillStyle = (r + c) & 1 ? dark : light; ctx.fillRect(x + c * sq, y + r * sq, sq, sq);
    const ch = pos?.[r]?.[c]; if (!glyphs || !ch || ch === '.') continue;
    const g = GLY[ch.toLowerCase()], white = ch === ch.toUpperCase();
    ctx.font = `${sq * 0.95}px ${SYM}`; ctx.textAlign = 'center';
    const cx = x + c * sq + sq / 2, cy = y + r * sq + sq * 0.84;
    if (white) {
      ctx.fillStyle = '#fff'; ctx.fillText(g, cx, cy);
      ctx.fillStyle = '#000'; ctx.fillText(String.fromCodePoint(g.codePointAt(0) - 6), cx, cy);
    } else { ctx.fillStyle = '#000'; ctx.fillText(g, cx, cy); }
  }
  ctx.textAlign = 'left';
}
function drawTree(x, y, w) { // дерево вариантов на белом листе
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x, y, w, w);
  const node = (nx, ny, s) => drawBoard(POSITIONS[1], nx - s * 4, ny, s, { frame: '#333', glyphs: false, light: '#fff', dark: '#999' });
  const lv = [[w / 2], [w * 0.2, w / 2, w * 0.8], [0.08, 0.2, 0.32, 0.42, 0.5, 0.58, 0.68, 0.8, 0.92].map(v => v * w)];
  ctx.strokeStyle = '#555'; ctx.lineWidth = 0.6;
  lv.forEach((row, li) => row.forEach((nx, i) => {
    if (li < 2) lv[li + 1].forEach((cx, j) => { if (Math.floor(j / (lv[li + 1].length / row.length)) === i) { ctx.beginPath(); ctx.moveTo(x + nx, y + 8 + li * 36 + 10); ctx.lineTo(x + cx, y + 8 + (li + 1) * 36); ctx.stroke(); } });
  }));
  lv.forEach((row, li) => row.forEach(nx => node(x + nx, y + 8 + li * 36, li === 2 ? 1.1 : 1.6)));
}
// «перспективная» доска: поворот + скос, приглушённая
function drawBoardAffine(cx, cy, size, ang, skew, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(ang); ctx.transform(1, 0, skew, 0.8, 0, 0);
  const sq = size / 8;
  drawBoard(POSITIONS[2], -size / 2, -size / 2, sq, { light: '#9c9c9c', dark: '#4b4b4b', frame: '#2b2b2b' });
  ctx.restore();
}
function drawSplash(cx, cy, R, t) {
  const N = 150;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.2);
  g.addColorStop(0, '#e8e8e8'); g.addColorStop(0.6, '#b9b9b9'); g.addColorStop(1, '#6d6d6d');
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = 0.62 + 0.16 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7 + 2) + 0.03 * Math.sin(t * 0.7 + i * 1.3);
    const h = hash2(i, 7);
    if (h > 0.78) r *= 1.25 + 0.8 * hash2(i, 9);
    ctx.lineTo(cx + Math.cos(a) * R * r, cy + Math.sin(a) * R * r * 0.9);
  }
  ctx.closePath(); ctx.fill();
  for (let k = 0; k < 40; k++) { // брызги
    const a = hash2(k, 3) * Math.PI * 2, dd = R * (1.05 + hash2(k, 4) * 0.8), s = 0.6 + hash2(k, 5) * 2.8;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd * 0.9, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ───────────────────────── scenes ─────────────────────────
// S0 — стробящие диаграммы: доски и дерево вариантов меняются каждые 2 кадра
function sceneFlick(f) {
  const k = Math.floor(f / 2) % 6, sq = 12, bx = LW / 2 - sq * 4, by = 92;
  if (k === 2 || k === 5) drawTree(LW / 2 - 52, by - 6, 104);
  else drawBoard(POSITIONS[[0, 1, 0, 2, 3, 0][k]], bx, by, sq);
}

// S1 — пешка в брызгах, плывущие доски, жёлтый трекинг, в конце whip
function scenePawn(f) {
  const t = f - T.pawn, n = T.wall - T.pawn, tb = t - (t % 2); // фон двигается через кадр
  drawBoardAffine(170 + tb * 0.9, 70 - tb * 0.2, 150, rad(-28 + tb * 0.35), 0.3, 0.55);
  drawBoardAffine(690 - tb * 0.6, 150 + tb * 0.3, 140, rad(18 - tb * 0.3), -0.25, 0.5);
  drawSplash(392, 158, 128 * (0.35 + 0.65 * easeOutBack(t / 6)), Math.min(t, 6));
  const px = 478, base = 262;
  placePiece(PAWN_M, px, base, { sx: Math.max(0.04, easeOut(t / 4)) });
  for (let k = 0; k < 26; k++) { // искры у края пешки
    if (hash2(k, f) < 0.45) continue;
    const yy = 150 + hash2(k, 11) * 100, xx = px - 44 - hash2(k, 12) * 34;
    ctx.fillStyle = hash2(k, f + 1) < 0.5 ? rgb(GOLD) : '#fff8e0';
    ctx.fillRect(xx, yy, 1.5 + hash2(k, 13) * 4, 1 + hash2(k, 14) * 2.5);
  }
  ctx.save(); ctx.setLineDash([1.5, 3]); ctx.lineDashOffset = -t * 2; ctx.strokeStyle = rgb(GOLD); ctx.globalAlpha = 0.7; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(px, 190, 120, 70, rad(-8), 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(px, 190, 168, 98, rad(6), 0, Math.PI * 1.4); ctx.stroke(); ctx.restore();
  [[px - 60, 120], [px + 48, 168], [px - 30, 238], [px + 120, 96]].forEach(([x, y], i) => {
    if (hash2(i, Math.floor(f / 2)) < 0.25) return;
    ctx.fillStyle = rgb(GOLD); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    txt(coord(x, y, f, i), x + 5, y - 3, { size: 7, color: rgb(GOLD) });
  });
  placePiece(KNIGHT_BIG, 770 - tb * 0.6, 420 - tb * 0.9, { blur: 3.5, alpha: 0.9 });
  const w = t - (n - 2);
  return w >= 0 ? { post: d => whip(d, Math.round([0.22, 0.55][w] * WP), Math.round(26 * S)) } : null;
}

// S2 — стена текста кусками, сквозь неё медленно ползёт датамош-пешка; в конце флеш-кадр
function sceneWall(f) {
  const t = f - T.wall, n = T.flash - T.wall;
  const lines = 19, lh = 15.6, shown = t < 5 ? 0 : Math.min(lines, (t - 4) * 2);
  const rep = WALL.repeat(4);
  for (let i = 0; i < shown; i++) {
    const start = (i * 173) % WALL.length;
    txt(rep.slice(start, start + 230), 6, 15 + i * lh, { size: 13.5, face: COND, color: '#f2f2f2' });
  }
  return {
    pre: d => {
      const p = t / n, gx = lerp(70, 600, p), base = lerp(110, 200, p);
      const X = Math.round(gx * S - GHOST.cx), Y = Math.round(base * S - GHOST.by);
      smear(d, GHOST, X, Y, -1, 170 + 50 * Math.sin(t * 0.4), f, 1.3);
      moshBlocks(d, X, Y, GHOST.w, GHOST.h, f, 0.95, 7, (x, y) => {
        const lx = x - X, ly = y - Y; if (lx < 0 || ly < 0 || lx >= GHOST.w || ly >= GHOST.h) return false;
        return GHOST.alpha[ly * GHOST.w + lx] > 128;
      });
    },
  };
}
function sceneFlash(f) { // гигантский крупный план ферзя, 2 кадра
  const k = f - T.flash, sc = [4.2, 3.4][k];
  drawImg(QUEEN.can, LW / 2 + 40, LH / 2, QUEEN.lw * sc, QUEEN.lh * sc, { ax: 0.5, ay: 0.6 });
}

// S3 — ферзь-строб: заливка меняется каждые 3 кадра
const STROBE = ['ascii', 'dots', 'pixel', 'glyphs', 'boards', 'pink', 'photo', 'dots', 'ascii', 'glyphs', 'pixel2', 'boards', 'pink', 'photo', 'dots', 'glyphs', 'ascii', 'pixel'];
function sceneQueen(f) {
  const t = f - T.queen, mode = STROBE[Math.floor(t / 3) % STROBE.length];
  const qx = LW / 2, base = 290, qh = QUEEN.lh;
  const X = qx - QUEEN.lw / 2, Y = base - qh;
  if (QPIX[mode]) {
    drawImg(QPIX[mode], qx, base, QUEEN.lw, qh, { ax: 0.5, ay: 1, smooth: false });
  } else {
    const cell = { dots: 4.5, boards: 6, pink: 5, glyphs: 7.5, ascii: 5 }[mode];
    const sample = (lx, ly) => {
      const px = Math.round((lx - X) * S), py = Math.round((ly - Y) * S);
      if (px < 0 || py < 0 || px >= QUEEN.w || py >= QUEEN.h) return -1;
      const i = py * QUEEN.w + px; return QUEEN.alpha[i] > 140 ? QUEEN.lum[i] : -1;
    };
    const glyphs = ['♙', '♘', '♗', '♖', '♕', '♔', '♟', '♞', '♝', '♜', '♛', '♚'];
    if (mode === 'ascii') { ctx.font = `${cell * 1.25}px ${MONO}`; ctx.textAlign = 'center'; }
    for (let ly = Y + cell / 2; ly < base; ly += cell) for (let lx = X + cell / 2; lx < X + QUEEN.lw; lx += cell) {
      const l = sample(lx, ly); if (l < 0) continue;
      if (mode === 'dots') {
        ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(lx, ly, cell * 0.5 * (0.25 + 0.75 * Math.sqrt(l)), 0, Math.PI * 2); ctx.fill();
      } else if (mode === 'ascii') {
        ctx.fillStyle = rgb(mix(BG, [235, 235, 235], 0.3 + 0.7 * l));
        ctx.fillText(WALL[Math.floor(hash2(lx * 5, ly * 3) * WALL.length)], lx, ly + cell * 0.4);
      } else if (mode === 'boards' || mode === 'pink') {
        const nn = mode === 'boards' ? 4 : 2, q = (cell - 1) / nn;
        for (let a = 0; a < nn; a++) for (let b = 0; b < nn; b++) {
          const v = clamp(l * ((a + b) & 1 ? 0.35 : 1) + 0.08);
          ctx.fillStyle = rgb(mode === 'boards' ? mix(BG, [236, 236, 236], v) : mix(BG, PINK, clamp(v * 1.1)));
          ctx.fillRect(lx - cell / 2 + a * q, ly - cell / 2 + b * q, q, q);
        }
      } else {
        const g = glyphs[Math.min(11, Math.floor(l * 5.99) + (hash2(lx * 3, ly * 7) < 0.5 ? 6 : 0))];
        ctx.font = `${cell * 1.15}px ${SYM}`; ctx.textAlign = 'center'; ctx.fillStyle = rgb(mix(BG, YEL, 0.35 + 0.65 * l));
        ctx.fillText(g, lx, ly + cell * 0.4);
      }
    }
    ctx.textAlign = 'left';
  }
  const pts = [[0, 0.99], [0.16, 0.86], [-0.13, 0.62], [0.11, 0.4], [-0.28, 0.05]].map(([x, y]) => [qx + x * qh, base - y * qh]);
  dotted(pts, { alpha: 0.5, offset: -t });
  pts.forEach(([x, y], i) => {
    ctx.fillStyle = i % 2 ? rgb(YEL) : '#fff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    txt(coord(x, y, Math.floor(t / 3), i), x + 6, y - 4, { size: 7 });
  });
  txt('THE QUEEN', 40, 108, { size: 46, face: COND });
  ['MOVES ANY DISTANCE,', 'IN ANY DIRECTION.', 'AND STILL SOMEBODY', 'ELSE MOVES HER.'].forEach((s, i) =>
    txt(s, 41, 134 + i * 18, { size: 17, face: COND, color: '#8b949e' }));
  [['obj', '04 · queen'], ['fill', mode], ['src', 'global-metadata.dat']].forEach(([a, b], i) => {
    txt(a, 610, 120 + i * 15, { size: 9, color: '#6e7681' });
    txt(b, 650, 120 + i * 15, { size: 9, color: i === 1 ? rgb(YEL) : '#c9d1d9' });
  });
}

// S4 — король поднимается снизу с покачиванием и шлейфом вниз; рамки с руками въезжают и дрейфуют
function boxAt(H, t) {
  const e = easeOut((t - H.enter) / 7), dt = t - H.enter;
  return { x: lerp(H.from[0], H.to[0], e) + H.drift[0] * dt, y: lerp(H.from[1], H.to[1], e) + H.drift[1] * dt, s: 1 + 0.004 * dt };
}
function sceneKing(f) {
  const t = f - T.king;
  const rise = easeOut(t / 11);
  const kx = 452 + t * 0.6, base = lerp(300 + 230, 290, rise);
  const ang = rad((1 - rise) * -14 + 4 * Math.sin(t * 0.33));
  KCTX.setTransform(1, 0, 0, 1, 0, 0); KCTX.clearRect(0, 0, KDIAG, KDIAG);
  KCTX.translate(KDIAG / 2, KDIAG / 2); KCTX.rotate(ang); KCTX.drawImage(KING_B.can, -KING_B.w / 2, -KING_B.h / 2);
  const cy = base - KING_B.lh / 2;
  drawImg(KCAN, kx, cy, KDIAG / S, KDIAG / S);
  const X0 = Math.round(kx * S - KDIAG / 2), Y0 = Math.round(cy * S - KDIAG / 2);
  const trail = 40 + 200 * (1 - rise) + 20 * Math.sin(t * 0.6);
  return {
    pre: d => smearDown(d, KCTX.getImageData(0, 0, KDIAG, KDIAG).data, KDIAG, KDIAG, X0, Y0, trail, f),
    overlay: () => {
      const head = [kx + Math.sin(ang) * KING_B.lh * 0.45, cy - Math.cos(ang) * KING_B.lh * 0.45];
      txt(coord(head[0], head[1], f, 9), head[0] + 22, head[1] + 30, { size: 7.5 });
      for (const H of HANDS) {
        if (t < H.enter) continue;
        const b = boxAt(H, t), w = H.w * b.s, h = H.h * b.s;
        const near = [clamp(head[0], b.x, b.x + w), clamp(head[1] + 60, b.y, b.y + h)];
        dotted([near, [head[0], head[1] + 40]], { alpha: 0.55, offset: -f * 1.5 });
        ctx.fillStyle = BGS; ctx.fillRect(b.x, b.y, w, h);
        // рука: плавное покачивание и «тянется»
        const rot = rad(H.rot + 3 * Math.sin(t * 0.35 + H.phase));
        const reach = 6 * Math.sin(t * 0.5 + H.phase);
        const P = { top: [0, 1], bottom: [0, -1], right: [-1, 0] }[H.arm];
        const dx = P[0] * Math.cos(rot) - P[1] * Math.sin(rot), dy = P[0] * Math.sin(rot) + P[1] * Math.cos(rot);
        ctx.save();
        ctx.beginPath(); ctx.rect(b.x + 1, b.y + 1, w - 2, h - 2); ctx.clip();
        ctx.translate(b.x + H.tip[0] * w + dx * reach, b.y + H.tip[1] * h + dy * reach);
        ctx.rotate(rot); ctx.scale(b.s, b.s);
        ctx.drawImage(H.spr.can, -H.spr.tipX / S, -H.spr.tipY / S, H.spr.w / S, H.spr.h / S);
        ctx.restore();
        ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 0.75; ctx.strokeRect(b.x + 0.5, b.y + 0.5, w - 1, h - 1);
        txt(coord(b.x, b.y, f, H.phase * 10), b.x + 1, b.y - 3, { size: 7.5 });
      }
    },
  };
}

// S5 — перевод фокуса: сначала резкий король, размытый тайтл → наоборот
function sceneTitle(f) {
  const t = f - T.title, tk = Math.min(t, 12); // после перевода фокуса кадр замирает
  const focus = smoothstep(4, 11, t);
  ctx.font = `200px ${COND}`; ctx.textAlign = 'left';
  const word = '2MD55.ARCH', tw = ctx.measureText(word).width;
  const tb = lerp(9, 0, focus);
  if (tb > 0.05) ctx.filter = `blur(${(tb * S).toFixed(2)}px)`;
  ctx.fillStyle = '#fff'; ctx.fillText(word, (LW - tw) / 2 + 20, 236);
  ctx.filter = 'none';
  if (focus > 0.97) txt('reverse engineering  ·  unity il2cpp  ·  luau  ·  c++', LW / 2, 272, { size: 10.5, align: 'center', color: '#8b949e' });
  placePiece(KING_BIG, 150 + tk * 0.9, 452 - tk * 0.3, { blur: lerp(0, 4.5, focus), ang: rad(-13 + tk * 0.15) });
}

// S6 — фигуры появляются строго в бит
function sceneLineup(f) {
  const t = f - T.lineup, base = 250, gap = 14;
  const total = LINEUP.reduce((s, P) => s + P.lw, 0) + gap * (LINEUP.length - 1);
  let cx = (LW - total) / 2;
  const shown = Math.floor((t - 2) / BEAT) + 1;
  LINEUP.forEach((P, i) => {
    const x = cx + P.lw / 2; cx += P.lw + gap;
    if (i >= shown) return;
    ctx.save(); ctx.translate(0, base * 2); ctx.scale(1, -1);
    placePiece(P, x, base, { alpha: 0.12 }); ctx.restore(); resetCtx();
    placePiece(P, x, base);
  });
  if (shown >= LINEUP.length) {
    txt('EVERY PIECE WAS A PAWN ONCE.', 40, 58, { size: 26, face: COND });
    txt('2md55.arch', LW - 40, 52, { size: 11, align: 'right', color: '#c9d1d9' });
    txt('he/him · smth maybe', LW - 40, 67, { size: 9, align: 'right', color: '#6e7681' });
  }
}

// ───────────────────────── render loop ─────────────────────────
function renderFrame(f) {
  resetCtx();
  ctx.fillStyle = BGS; ctx.fillRect(0, 0, LW, LH);
  let fx = null;
  if (f < T.pawn) sceneFlick(f);
  else if (f < T.wall) fx = scenePawn(f);
  else if (f < T.flash) fx = sceneWall(f);
  else if (f < T.queen) sceneFlash(f);
  else if (f < T.black) sceneQueen(f);
  else if (f < T.king) { /* чёрные кадры перед королём */ }
  else if (f < T.title) fx = sceneKing(f);
  else if (f < T.lineup) sceneTitle(f);
  else sceneLineup(f);
  if (fx?.pre) withPixels(fx.pre);
  resetCtx();
  if (fx?.overlay) fx.overlay();
  const img = ctx.getImageData(0, 0, WP, HP);
  if (fx?.post) fx.post(img.data);
  finishFrame(img.data);
  return img;
}

const gif = GIFEncoder();
const idx = new Uint8Array(WP * HP), prev = new Uint8Array(WP * HP), out = new Uint8Array(WP * HP);
const SHEET_FRAMES = [3, 7, 16, 36, 50, 66, 71, 80, 84, 100, 134, 150, 160, 176, 200, 239];
const sheet = [], sceneSizes = [];
const STATIC_FRAME = FRAMES - 1;
const BOUNDS = [T.pawn, T.wall, T.queen, T.king, T.title, T.lineup, T.end];
let staticImg = null;
for (let f = 0; f < FRAMES; f++) {
  const img = renderFrame(f), d = img.data;
  for (let i = 0, j = 0; i < idx.length; i++, j += 4) idx[i] = LUT[((d[j] >> 3) << 10) | ((d[j + 1] >> 3) << 5) | (d[j + 2] >> 3)];
  const delay = HOLD[f] ?? DELAY;
  if (f === 0) gif.writeFrame(idx, WP, HP, { palette: PALETTE, delay, repeat: 0 });
  else {
    for (let i = 0; i < idx.length; i++) out[i] = idx[i] === prev[i] ? TRANSPARENT : idx[i];
    gif.writeFrame(out, WP, HP, { delay, transparent: true, transparentIndex: TRANSPARENT, dispose: 1 });
  }
  prev.set(idx);
  if (process.env.SIZES && BOUNDS.includes(f + 1)) sceneSizes.push(gif.bytes().length);
  if (process.env.SHEET && SHEET_FRAMES.includes(f)) sheet.push(Uint8Array.from(idx));
  if (f === STATIC_FRAME) staticImg = img;
}
gif.finish();

fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
const gifPath = path.join(ROOT, 'assets', 'header.gif');
fs.writeFileSync(gifPath, gif.bytes());
console.log(`header.gif  ${WP}x${HP}  ${FRAMES}f @${1000 / DELAY}fps  ${(fs.statSync(gifPath).size / 1024 / 1024).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (sceneSizes.length) console.log('per scene KB (flick/pawn/wall/queen/king/title/lineup):', sceneSizes.map((v, i) => Math.round((v - (sceneSizes[i - 1] ?? 0)) / 1024)).join(' / '));

{ // статичный кадр для prefers-reduced-motion
  const c = createCanvas(WP, HP); c.getContext('2d').putImageData(staticImg, 0, 0);
  fs.writeFileSync(path.join(ROOT, 'assets', 'header-static.png'), c.toBuffer('image/png'));
}
if (process.env.SHEET) {
  const cols = 2, sw = WP / 2, sh = HP / 2, rows = Math.ceil(sheet.length / cols);
  const full = createCanvas(WP, HP), fc = full.getContext('2d'), fimg = fc.createImageData(WP, HP);
  const c = createCanvas(sw * cols, sh * rows), x = c.getContext('2d');
  sheet.forEach((fr, n) => {
    for (let i = 0; i < fr.length; i++) { const p = PALETTE[fr[i]]; fimg.data[i * 4] = p[0]; fimg.data[i * 4 + 1] = p[1]; fimg.data[i * 4 + 2] = p[2]; fimg.data[i * 4 + 3] = 255; }
    fc.putImageData(fimg, 0, 0);
    x.drawImage(full, (n % cols) * sw, Math.floor(n / cols) * sh, sw, sh);
  });
  fs.writeFileSync(process.env.SHEET, c.toBuffer('image/png'));
  console.log('sheet ->', process.env.SHEET);
}
