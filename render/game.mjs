// 2md55.arch — "every piece was a pawn once"
// Шапка профиля, собранная на canvas из фото-ассетов:
//   • фигуры — рендер CC0-набора Poly Haven «Chess Set» (render/sprites.html → source/sprites/)
//   • руки   — source/gen/hand_{top,bottom}.png на зелёном фоне (ключуются здесь, в кадре — плоские силуэты со «снегом»)
// Кадр 16:9 на чистом чёрном, монтаж и тайминги — по референсу, 20 fps.
// Рендер в два прохода: сначала гистограмма цветов → общая палитра, потом запись GIF с дизерингом.
//
//   node render/game.mjs                -> assets/chess-header.gif + assets/chess-header-static.png
//   SCALE=1.5 node render/game.mjs      -> чётче на retina, но GIF тяжелее
//   SHEET=path.png node render/game.mjs -> ещё и лист ключевых кадров (SHEET_FRAMES=3,16,50 — свои кадры)

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
const LW = 840, LH = 472;         // логический кадр 16:9
const S = Number(process.env.SCALE ?? 1.25);
const WP = Math.round(LW * S), HP = Math.round(LH * S);
const DELAY = 50;                 // 20 fps
const BG = [0, 0, 0];             // как в рефе — чистый чёрный
const BGS = `rgb(${BG})`;
const DITHER = Number(process.env.DITHER ?? 14); // амплитуда упорядоченного дизеринга, 0 — выключить

// таймлайн (кадры) — длительности сцен сняты с референса
const T = { flick: 0, pawn: 14, push: 35, wall: 40, flash: 70, queen: 72, black: 124, king: 128, title: 156, lineup: 185, end: 240 };
const FRAMES = T.end;
const HOLD = { [T.end - 1]: 2400 }; // задержка на отдельных кадрах, мс

// ── Движение фигур со шлейфом снято с референса покадрово (20 fps; px в кадре рефа 734×576) ──
const ECHOES = 14;                 // шлейф — это 14 прошлых кадров самой фигуры, по одному силуэту на кадр
// цвет копии по возрасту (1-я — самая свежая): розовый → малиновый → синий → циан → зелёный → красный
const AGE_U = [0.14, 0.2, 0.27, 0.38, 0.5, 0.58, 0.65, 0.71, 0.8, 0.86, 0.9, 0.94, 0.98, 0.03];
// Пешка, правый край фигуры: влетает слева по прямой на ~520 px/с и тормозит до полной остановки.
const PAWN_XR = [157, 183, 203, 223, 239, 257, 273, 285, 297, 309, 319, 328, 339, 345, 352, 359, 365, 372, 375, 381, 383, 387, 388, 391, 393, 397, 397, 399, 399, 399];
const PAWN_H = 147, PAWN_SC = 1, PAWN_X0 = 44;      // рост пешки в рефе; масштаб 1:1 (те же px за кадр) и сдвиг в наш кадр
// Король, верх фигуры: поднимается из-под кадра и тоже тормозит.
const KING_TOP = [560, 520, 482, 450, 416, 400, 376, 365, 346, 338, 322, 316, 304, 298, 290, 286, 278, 274, 268, 266, 262, 260, 256, 254, 253, 252, 250, 250];

const WALL =
  'A PAWN MOVES ONE SQUARE AT A TIME AND NEVER GOES BACK. NOBODY GUARDS IT, NOBODY FEARS IT. ' +
  'IT IS SPENT FIRST AND REMEMBERED LAST. BUT THE PAWN THAT REACHES THE FAR SIDE OF THE BOARD ' +
  'BECOMES ANY PIECE IT CHOOSES. EVERY BINARY IS A BOARD. EVERY FUNCTION IS A MOVE. READ THE ' +
  'METADATA, LEARN THE RULES, THEN REWRITE THEM. GAMEASSEMBLY.DLL · GLOBAL-METADATA.DAT · IL2CPP · ' +
  'LUAU · LUNE · 2MD55.ARCH · ';
const STACK = ['c++', 'luau', 'lua', 'typescript', 'python'];

// ───────────────────────── fonts ─────────────────────────
function font(name, ...paths) {
  for (const p of paths) if (fs.existsSync(p) && GlobalFonts.registerFromPath(p, name)) return `"${name}"`;
  return 'sans-serif';
}
// широкий жирный гротеск, как в рефе (регистрируется жирное начертание)
const WIDE = font('Wide', '/System/Library/Fonts/Avenir Next.ttc', '/System/Library/Fonts/Supplemental/Arial Black.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
const SYM = font('Sym', '/System/Library/Fonts/Apple Symbols.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
const MONO = font('Mono', '/System/Library/Fonts/Menlo.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf');

// ───────────────────────── math ─────────────────────────
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
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
function vnoise(x, y) { // value noise 0..1
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; }
  return s / n;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = c => `rgb(${c.map(v => Math.round(clamp(v, 0, 255)))})`;

// ───────────────────────── colours ─────────────────────────
const PINK = [224, 86, 150], YEL = [186, 196, 98], GOLD = [240, 196, 70];
const IVORY_TINT = [1.03, 0.965, 0.93];   // тёплая слоновая кость вместо холодного белого
// Шлейф: почти весь розово-малиновый, остальной спектр — узкими полосами, без жёлтого.
const RAMP_STOPS = [
  [0.00, [255, 0, 60]], [0.10, [255, 0, 130]], [0.30, [255, 20, 200]], [0.42, [235, 40, 255]],
  [0.52, [130, 50, 255]], [0.60, [40, 90, 255]], [0.69, [0, 200, 255]], [0.77, [0, 235, 150]],
  [0.84, [60, 230, 40]], [0.89, [255, 60, 40]], [1.00, [255, 0, 60]],
];
function rampAt(u) {
  u = ((u % 1) + 1) % 1;
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    const [p1, c1] = RAMP_STOPS[i], [p0, c0] = RAMP_STOPS[i - 1];
    if (u <= p1) return mix(c0, c1, (u - p0) / (p1 - p0));
  }
  return RAMP_STOPS[0][1];
}
const NB = 24;                                         // постеризация шлейфа в полосы
const RAMP = Array.from({ length: NB }, (_, i) => rampAt((i + 0.5) / NB));
const rampIdx = u => ((Math.floor(u * NB) % NB) + NB) % NB;

// ───────────────────────── canvas ─────────────────────────
const cvs = createCanvas(WP, HP);
const ctx = cvs.getContext('2d');
const resetCtx = () => {
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.setLineDash([]);
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.imageSmoothingEnabled = true;
};
function withPixels(fn) {
  const img = ctx.getImageData(0, 0, WP, HP);
  fn(img.data);
  ctx.putImageData(img, 0, 0);
}
// нарисовать картинку с якорем, поворотом, масштабом и размытием (логические координаты)
function drawImg(can, x, y, w, h, { ang = 0, blur = 0, alpha = 1, ax = 0.5, ay = 0.5, smooth = true } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0.05) ctx.filter = `blur(${(blur * S).toFixed(2)}px)`;
  ctx.imageSmoothingEnabled = smooth;
  ctx.translate(x, y); if (ang) ctx.rotate(ang);
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
// цветокоррекция спрайта: гамма → усиление → оттенок
function grade(c, { tint = [1, 1, 1], gamma = 1, gain = 1 } = {}) {
  const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++)
    d[i + k] = clamp(Math.pow(d[i + k] / 255, gamma) * gain * tint[k]) * 255;
  x.putImageData(id, 0, 0);
  return c;
}
// масштабировать до высоты hp (физ. px) и посчитать маску/яркость силуэта
function sprite(src, hp, { normalize = false } = {}) {
  const h = Math.round(hp), w = Math.round((src.width * hp) / src.height);
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
  return { can, w, h, cx: w / 2, by: h, lum, alpha, lw: w / S, lh: h / S };
}
// жёсткий белый силуэт (без полутонов — меньше цветов в GIF)
function maskOf(can) {
  const c = createCanvas(can.width, can.height), x = c.getContext('2d');
  x.drawImage(can, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = d[i + 3] > 128 ? 255 : 0; }
  x.putImageData(id, 0, 0);
  return c;
}
const TINTS = new Map();
function tinted(mask, i) { // силуэт, залитый цветом RAMP[i] (кэш)
  let arr = TINTS.get(mask); if (!arr) TINTS.set(mask, arr = []);
  if (!arr[i]) {
    const c = createCanvas(mask.width, mask.height), x = c.getContext('2d');
    x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-in';
    x.fillStyle = rgb(RAMP[i]); x.fillRect(0, 0, c.width, c.height);
    arr[i] = c;
  }
  return arr[i];
}
// поставить фигуру: (x, base) — центр основания
function placePiece(P, x, base, { alpha = 1, blur = 0, ang = 0 } = {}) {
  drawImg(P.can, x, base, P.lw, P.lh, { alpha, blur, ang, ax: 0.5, ay: 1 });
}
const PASTEL = [[255, 226, 236], [226, 255, 236], [230, 234, 255], [255, 248, 218], [255, 255, 255]];
function pixelate(P, cell) { // крупные пиксели с пастельным шумом, как в рефе
  const sw = Math.max(1, Math.round(P.w / (cell * S))), sh = Math.max(1, Math.round(P.h / (cell * S)));
  const c = createCanvas(sw, sh), x = c.getContext('2d');
  x.drawImage(P.can, 0, 0, sw, sh);
  const id = x.getImageData(0, 0, sw, sh), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = d[i + 3] > 110 ? 255 : 0;
    const p = PASTEL[Math.floor(hash2(i, cell * 10) * PASTEL.length)];
    for (let k = 0; k < 3; k++) d[i + k] = clamp(lerp(d[i + k] * 1.06, p[k], 0.3), 0, 255);
  }
  x.putImageData(id, 0, 0);
  return c;
}

// ───────────────────────── effects ─────────────────────────
// Датамош-шлейф как в рефе — покадровое «эхо»: k-я копия стоит там и так, где и как фигура была k кадров назад.
// pose(i) → [x, y, наклон] якоря (центр основания) в кадре i; цвет копии — по её возрасту (AGE_U).
function echoes(mask, lw, lh, pose, i, olderOnTop = false) {
  ctx.save(); ctx.imageSmoothingEnabled = false;
  for (let n = 0; n < ECHOES; n++) {
    const k = olderOnTop ? n + 1 : ECHOES - n, [x, y, a] = pose(i - k);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.drawImage(tinted(mask, rampIdx(AGE_U[k - 1])), -lw / 2, -lh, lw, lh);
    ctx.restore();
  }
  ctx.restore();
}
// «телевизионный снег» по маске (обновляется через кадр)
function staticNoise(d, m, f) {
  const q = Math.max(2, Math.round(1.7 * S)), ff = f >> 1;
  for (let y = 0, o = 0; y < HP; y++) {
    const yq = ((y / q) | 0) + ff * 104729;
    for (let x = 0; x < WP; x++, o += 4) {
      if (m[o + 3] < 128) continue;
      const h = hash2(((x / q) | 0) + ff * 7919, yq);
      d[o] = d[o + 1] = d[o + 2] = h < 0.3 ? 250 : h < 0.6 ? 215 : h < 0.85 ? 180 : 140;
    }
  }
}

// ───────────────────────── text helpers ─────────────────────────
function txt(s, x, y, { size = 10, face = MONO, color = '#fff', align = 'left', alpha = 1, weight = '' } = {}) {
  ctx.font = `${weight} ${size}px ${face}`.trim(); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  return ctx.measureText(s).width;
}
const coord = (x, y, f, k = 0) => {
  const j = n => Math.round(n + (hash2(f, k * 31 + n) - 0.5) * 6);
  return `x: ${j(x * 1.74)} y: ${j(y * 2.2)}`;
};
function dashed(draw, { color = '#ddd', dash = [2, 3.5], alpha = 0.7, offset = 0, width = 0.8 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.setLineDash(dash); ctx.lineDashOffset = offset;
  ctx.beginPath(); draw(); ctx.stroke(); ctx.restore();
}

// ───────────────────────── assets ─────────────────────────
const t0 = Date.now();
const src = {};
for (const n of ['w_pawn', 'w_rook', 'w_king', 'w_queen', 'w_bishop', 'w_knight_a', 'w_queen_big'])
  src[n] = grade(trim(await readImage(SPRITES(n))), { tint: IVORY_TINT });
// чёрный король — глянцевее: тёмное темнее, блики ярче
src.b_king = grade(trim(await readImage(SPRITES('b_king'))), { gamma: 1.3, gain: 1.55, tint: [1, 1, 1.03] });

const QUEEN = sprite(src.w_queen_big, 0.78 * LH * S, { normalize: true });
const KING_B = sprite(src.b_king, 0.375 * LH * S);
const KING_MASK = maskOf(KING_B.can);
const KING_BIG = sprite(src.b_king, 1.3 * LH * S);
const PAWN_M = sprite(src.w_pawn, 0.37 * LH * S);
const KNIGHT_BIG = sprite(grade(trim(await readImage(SPRITES('w_knight_a'))), { tint: IVORY_TINT, gain: 0.8 }), 0.8 * LH * S); // передний план, не в фокусе
const GHOST = sprite(src.w_pawn, PAWN_H * PAWN_SC * S, { normalize: true });
const GHOST_MASK = maskOf(GHOST.can);
// шеренга: пропорции как в рефе — король заметно выше остальных
const LINE_H = 286;
const LINE_R = { w_pawn: 0.53, w_rook: 0.6, w_king: 1, w_queen: 0.84, w_bishop: 0.76, w_knight_a: 0.62 };
const LINEUP = Object.keys(LINE_R).map(n => sprite(src[n], LINE_H * LINE_R[n] * S));
const LINE_POPS = [0, 7, 17, 25, 35, 42];          // неровный ритм появления, как в рефе
const QPIX = pixelate(QUEEN, 13);
// мини-картинки для «фото-мозаики» ферзя
const THUMBS = (() => {
  const names = ['w_pawn', 'w_rook', 'w_king', 'w_queen', 'w_bishop', 'w_knight_a', 'b_king'];
  const bgs = [[70, 70, 72], [120, 118, 112], [165, 160, 150], [96, 78, 62], [58, 74, 98], [140, 96, 110], [40, 40, 40], [190, 186, 178], [84, 100, 84], [110, 110, 130]];
  const px = Math.round(13 * S);
  return bgs.map((bg, i) => {
    const c = createCanvas(px, px), x = c.getContext('2d');
    x.fillStyle = rgb(bg); x.fillRect(0, 0, px, px);
    const sp = src[names[i % names.length]], h = px * 0.86, w = (sp.width * h) / sp.height;
    x.imageSmoothingQuality = 'high'; x.drawImage(sp, (px - w) / 2, px * 0.08, w, h);
    return c;
  });
})();

// руки: плоские силуэты, заполняются «снегом» отдельным проходом
const HAND = {};
for (const n of ['hand_top', 'hand_bottom']) HAND[n] = maskOf(trim(keyGreen(await readImage(GEN(n)))));
const HMASK = createCanvas(WP, HP), hm = HMASK.getContext('2d');
// Плитка для рамки: силуэт повёрнут и обрезан так, что кисть целиком в кадре, а за край уходит только рука.
// part — доля высоты спрайта, занятая самой кистью; grow — какую часть лишнего поля отдать влево/вверх
// при подгонке под пропорции рамки.
function handTile(mask, { rot, flip = false, part, aspect, pad = 0.1, grow = [0.5, 0.5] }) {
  const D = 2 * Math.ceil(Math.hypot(mask.width, mask.height));
  const place = (c, sy, sh) => {
    const x = c.getContext('2d'); x.translate(D / 2, D / 2); x.rotate(rad(rot)); if (flip) x.scale(-1, 1);
    x.drawImage(mask, 0, sy, mask.width, sh, -mask.width / 2, -mask.height / 2 + sy, mask.width, sh);
    return x;
  };
  const full = createCanvas(D, D); place(full, 0, mask.height);
  const d = place(createCanvas(D, D), part[0] * mask.height, (part[1] - part[0]) * mask.height).getImageData(0, 0, D, D).data;
  let x0 = D, y0 = D, x1 = 0, y1 = 0;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (d[(y * D + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const p = pad * Math.max(x1 - x0, y1 - y0); x0 -= p; y0 -= p;
  let w = x1 - x0 + p, h = y1 - y0 + p;
  if (w / h < aspect) { const nw = h * aspect; x0 -= (nw - w) * grow[0]; w = nw; } else { const nh = w / aspect; y0 -= (nh - h) * grow[1]; h = nh; }
  const tile = createCanvas(Math.round(w), Math.round(h));
  tile.getContext('2d').drawImage(full, x0, y0, w, h, 0, 0, tile.width, tile.height);
  return tile;
}
// Рамки растут от краёв кадра, сохраняя пропорции (размеры и места — как в рефе). at(w, h) → левый верхний угол.
const HANDS = [
  { from: 7, w: 247, h: 142, at: w => [LW - w, 0], label: false,
    tile: handTile(HAND.hand_top, { rot: 76, part: [0.36, 1], aspect: 247 / 142, grow: [0.3, 0.5] }) },
  { from: 10, w: 139, h: 170, at: (w, h) => [0, 0.81 * LH - h], label: true,
    tile: handTile(HAND.hand_bottom, { rot: 64, flip: true, part: [0, 0.6], aspect: 139 / 170, grow: [0.5, 0.35] }) },
  { from: 9, w: 190, h: 198, at: (w, h) => [LW - w, LH - h], label: true,
    tile: handTile(HAND.hand_bottom, { rot: -34, part: [0, 0.6], aspect: 190 / 198, grow: [0.4, 0.4] }) },
];

// ───────────────────────── boards ─────────────────────────
const POSITIONS = [
  ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'],
  ['rnbqkbnr', 'pppppppp', '........', '........', '....P...', '........', 'PPPP.PPP', 'RNBQKBNR'],
  ['r.bqkb.r', 'pppp.ppp', '..n..n..', '....p...', '..B.P...', '.....N..', 'PPPP.PPP', 'RNBQK..R'],
];
const GLY = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
function drawBoard(c, pos, x, y, sq, { light = '#ececec', dark = '#a9a9a9', frame = '#fff', glyphs = true } = {}) {
  c.fillStyle = frame; c.fillRect(x - sq * 0.18, y - sq * 0.18, sq * 8.36, sq * 8.36);
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
    c.fillStyle = (r + col) & 1 ? dark : light; c.fillRect(x + col * sq, y + r * sq, sq, sq);
    const ch = pos?.[r]?.[col]; if (!glyphs || !ch || ch === '.') continue;
    const g = GLY[ch.toLowerCase()], white = ch === ch.toUpperCase();
    c.font = `${sq * 0.95}px ${SYM}`; c.textAlign = 'center';
    const cx = x + col * sq + sq / 2, cy = y + r * sq + sq * 0.84;
    if (white) {
      c.fillStyle = '#fff'; c.fillText(g, cx, cy);
      c.fillStyle = '#000'; c.fillText(String.fromCodePoint(g.codePointAt(0) - 6), cx, cy);
    } else { c.fillStyle = '#000'; c.fillText(g, cx, cy); }
  }
  c.textAlign = 'left';
}
function drawTree(x, y, w) { // дерево вариантов на белом листе: ровная сетка 1 → 3 → 9
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x, y, w, w);
  const rows = [{ n: 1, s: w * 0.026, y: 0.1 }, { n: 3, s: w * 0.021, y: 0.39 }, { n: 9, s: w * 0.0105, y: 0.72 }];
  const pos = rows.map(r => Array.from({ length: r.n }, (_, i) => x + (w * (i + 0.5)) / r.n));
  ctx.strokeStyle = '#555'; ctx.lineWidth = 0.7;
  for (let li = 0; li < 2; li++) pos[li].forEach((px, i) => {
    for (let j = 0; j < 3; j++) {
      ctx.beginPath(); ctx.moveTo(px, y + rows[li].y * w + rows[li].s * 8.3);
      ctx.lineTo(pos[li + 1][i * 3 + j], y + rows[li + 1].y * w - rows[li + 1].s * 0.3); ctx.stroke();
    }
  });
  rows.forEach((r, li) => pos[li].forEach(px => drawBoard(ctx, null, px - r.s * 4, y + r.y * w, r.s, { frame: '#333', glyphs: false, light: '#fff', dark: '#999' })));
}
// плоская «карточка» с сеткой и значком в каждой клетке — такие доски висят на фоне сцены с пешкой
function boardCard(px, seed) {
  const c = createCanvas(px, px), x = c.getContext('2d'), sq = px / 8, R = rng(seed);
  const all = '♔♕♖♗♘♙♚♛♜♝♞♟';
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, px, px);
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
    x.fillStyle = (r + col) & 1 ? '#7d7d7d' : '#8f8f8f'; x.fillRect(col * sq + 1, r * sq + 1, sq - 2, sq - 2);
    if (R() < 0.82) {
      x.font = `${sq * 0.7}px ${SYM}`; x.textAlign = 'center'; x.fillStyle = R() < 0.5 ? '#dedede' : '#3c3c3c';
      x.fillText(all[Math.floor(R() * all.length)], col * sq + sq / 2, r * sq + sq * 0.76);
    }
  }
  x.strokeStyle = '#d6d6d6'; x.lineWidth = Math.max(1, px / 160); x.strokeRect(0.5, 0.5, px - 1, px - 1);
  return c;
}

// ───────────────────────── pawn scene backdrop ─────────────────────────
// Рваная «чернильная» клякса: радиальный профиль с отростками + фрактальный шум по краю.
function paintSplash(d, cx, cy, R, seed, bright) {
  const rnd = rng(seed * 977 + 5), tend = [];
  for (let i = 0; i < 40; i++) tend.push({ a: rnd() * TAU, w: 0.018 + rnd() * 0.05, l: 0.18 + rnd() * 1.0 });
  const x0 = Math.max(0, Math.floor(cx - R * 2.3)), x1 = Math.min(WP, Math.ceil(cx + R * 2.3));
  const y0 = Math.max(0, Math.floor(cy - R * 2.3)), y1 = Math.min(HP, Math.ceil(cy + R * 2.3));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const dx = (x - cx) / R, dy = (y - cy) / (R * 0.94), r = Math.hypot(dx, dy);
    if (r > 2.3) continue;
    const lx = x / S, ly = y / S;
    // отростки не прямые: угол «плывёт» по шуму, чем дальше от центра — тем сильнее
    const a = Math.atan2(dy, dx) + (fbm(lx * 0.008 + seed * 3, ly * 0.008 + 11, 2) - 0.5) * 0.7 * clamp(r);
    let edge = 0.6 + 0.09 * Math.sin(a * 2 + seed) + 0.05 * Math.sin(a * 5 + seed * 1.7);
    for (const t of tend) { let da = Math.abs(a - t.a); if (da > Math.PI) da = TAU - da; edge += t.l * Math.exp(-(da * da) / (t.w * t.w)); }
    const n = fbm(lx * 0.013 + seed * 10, ly * 0.013, 5), n2 = fbm(lx * 0.06 + 31, ly * 0.06 + seed * 7, 3);
    const v = edge + (n - 0.5) * 0.6 * (0.3 + r) + (n2 - 0.5) * 0.26 - r;
    if (v <= 0) continue;
    const k = clamp(v * 60 / S + 0.2), lum = 255 * bright * clamp(0.78 - 0.34 * clamp(r / 1.3) + 0.5 * (n - 0.5) - 0.25 * (n2 - 0.5));
    const o = (y * WP + x) * 4;
    d[o] = lerp(d[o], lum * 1.0, k); d[o + 1] = lerp(d[o + 1], lum * 0.985, k); d[o + 2] = lerp(d[o + 2], lum * 0.96, k);
  }
}
const PAWN = { x: 0.49 * LW, base: 0.69 * LH };
const CARDS = [boardCard(Math.round(210 * S), 3), boardCard(Math.round(200 * S), 8)];
const SPLASH_LUM = new Uint8Array(WP * HP); // яркость кляксы без досок — по ней ставятся «раскалённые» участки
const PAWN_BG = (() => {
  const c = createCanvas(WP, HP), x = c.getContext('2d');
  x.fillStyle = BGS; x.fillRect(0, 0, WP, HP);
  const id = x.getImageData(0, 0, WP, HP);
  paintSplash(id.data, 0.95 * WP, -0.02 * HP, 0.2 * WP, 4, 0.55);       // отростки в правом верхнем углу
  paintSplash(id.data, 0.27 * WP, 0.5 * HP, 0.215 * WP, 1, 0.82);
  const d = id.data, vx = 0.42 * WP, vy = 0.5 * HP;                      // виньетка: светло только вокруг пешки
  for (let y = 0, o = 0; y < HP; y++) for (let px = 0; px < WP; px++, o += 4) {
    const v = 1 - 0.86 * smoothstep(0.16, 0.6, Math.hypot(px - vx, (y - vy) * 1.25) / WP);
    d[o] *= v; d[o + 1] *= v; d[o + 2] *= v; SPLASH_LUM[o >> 2] = d[o];
  }
  x.putImageData(id, 0, 0);
  x.setTransform(S, 0, 0, S, 0, 0);
  const card = (cv, cx, cy, size, ang, alpha) => { x.save(); x.globalAlpha = alpha; x.translate(cx, cy); x.rotate(ang); x.drawImage(cv, -size / 2, -size / 2, size, size); x.restore(); };
  card(CARDS[0], 0.115 * LW, 0.1 * LH, 215, rad(-31), 0.34);
  card(CARDS[1], 0.85 * LW, 0.47 * LH, 200, rad(3), 0.5);
  return c;
})();
// «раскалённые» участки самой кляксы у пешки (только там, где клякса есть) — три варианта, мигают
const HOT_W = 150, HOT_H = Math.round(PAWN_M.lh + 30), HOT_X = PAWN.x - 8 - HOT_W, HOT_Y = PAWN.base - PAWN_M.lh - 16;
const HOT = [0, 1, 2].map(seed => {
  const w = Math.round(HOT_W * S), h = Math.round(HOT_H * S), X0 = Math.round(HOT_X * S), Y0 = Math.round(HOT_Y * S);
  const c = createCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) {
    if (SPLASH_LUM[(Y0 + y) * WP + X0 + px] < 30) continue;
    const n = fbm((px / S) * 0.03 + seed * 13.7, (y / S) * 0.03 + 5, 3);
    if (n < 0.36 + 0.3 * (1 - px / w)) continue;
    const o = (y * w + px) * 4; d[o] = 255; d[o + 1] = 252; d[o + 2] = 240; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return c;
});
console.log(`assets ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ───────────────────────── scenes ─────────────────────────
// S0 — стробящие диаграммы по центру кадра: доски и дерево вариантов
function sceneFlick(f) {
  const k = Math.floor(f / 2), size = 168, sq = size / 8, bx = (LW - size) / 2, by = (LH - size) / 2;
  const seq = [0, 1, -1, 0, 2, -1, 1][k]; // доска ↔ дерево вперемешку, как в рефе
  if (seq < 0) drawTree(bx - 3, by - 3, size + 6);
  else drawBoard(ctx, POSITIONS[seq], bx, by, sq);
}

// S1 — пешка у кляксы: композиция стоит с первого кадра, живут только край кляксы, метки и конь на переднем плане
function scenePawn(f) {
  const t = f - T.pawn, t3 = t - (t % 3);
  ctx.drawImage(PAWN_BG, 0, 0, LW, LH);
  const { x: px, base } = PAWN, ph = PAWN_M.lh;
  ctx.drawImage(HOT[(t >> 1) % 3], HOT_X, HOT_Y, HOT_W, HOT_H);
  // пунктирные орбиты и связи с доской
  dashed(() => ctx.ellipse(px - 40, base - ph * 0.45, 300, 205, rad(-4), Math.PI * 1.08, Math.PI * 1.92), { alpha: 0.45, offset: -t });
  dashed(() => ctx.ellipse(px + 10, base - ph * 0.4, 150, 96, rad(8), Math.PI * 0.1, Math.PI * 0.95), { alpha: 0.4, offset: t });
  [[-0.72, -0.5], [-0.56, 0], [-0.4, 0.42]].forEach(([dy, bend], i) => {
    const y0 = base + ph * dy, x1 = 0.725 * LW, y1 = 0.5 * LH + bend * 90;
    dashed(() => { ctx.moveTo(px + 26, y0); ctx.quadraticCurveTo(px + 120, y0 + bend * 30, x1, y1); }, { alpha: 0.6, offset: -t * 1.5 });
    ctx.fillStyle = '#e03c3c'; ctx.fillRect(x1 - 1.5, y1 - 1.5, 3, 3);
    if (i === 1) ctx.fillRect(px + 60, y0 + bend * 12 - 1.5, 3, 3);
  });
  // жёлтый трекинг: метки стоят по строкам слева от пешки — не налезают ни друг на друга, ни на фигуру
  const rows = 9, top = base - ph - 6, step = (ph + 14) / (rows - 1);
  for (let i = 0; i < rows; i++) {
    if (hash2(i, 40 + (t >> 1)) < 0.25) continue;
    const y = top + i * step, x = px - 188 + hash2(i, 21) * 62;
    ctx.fillStyle = rgb(GOLD); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    txt(coord(x, y, t >> 1, i), x + 5, y + 2.8, { size: 8, color: rgb(GOLD), alpha: 0.95 });
  }
  [[-196, 1, 104, 1], [-140, 5, 88, 2]].forEach(([dx, row, w, span], i) => { // рамки трекера вокруг строк
    if (hash2(i, 70 + (t >> 1)) < 0.3) return;
    ctx.strokeStyle = rgb(GOLD); ctx.lineWidth = 0.7; ctx.globalAlpha = 0.75;
    ctx.strokeRect(px + dx, top + row * step - 9, w, span * step + 18); ctx.globalAlpha = 1;
  });
  [[36, 96], [58, 262], [150, 334], [44, 398], [232, 424]].forEach(([x, y], i) => txt(coord(x, y, 0, i), x, y, { size: 7.5, color: rgb(GOLD), alpha: 0.26 }));
  placePiece(PAWN_M, px, base);
  placePiece(KNIGHT_BIG, 0.72 * LW + t3 * 1.3, 1.4 * LH - t3 * 0.3, { blur: 4.5 });
}

// S2 — стена текста печатается по буквам. Пешка влетает слева по прямой, тормозит и всё сильнее клонится вперёд;
// шлейф — её же силуэты из 14 прошлых кадров (движение снято с референса, см. PAWN_XR). Текст рядом гаснет.
const WALL_LINES = (() => { const rep = WALL.repeat(5); return Array.from({ length: 17 }, (_, i) => rep.slice((i * 97) % WALL.length, ((i * 97) % WALL.length) + 120)); })();
const WALL_BASE = 0.66 * LH;                       // шлейф по высоте — по центру кадра, как в рефе
const wallPose = i => { // [x, y, наклон] основания пешки в кадре i от начала сцены; до начала она летит с постоянной скоростью
  const a = rad(17 + 19 * clamp(i / 29)), xr = i < 0 ? PAWN_XR[0] + 26 * i : PAWN_XR[Math.min(i, PAWN_XR.length - 1)];
  return [PAWN_X0 + PAWN_SC * (xr - 22 - 0.9 * PAWN_H * Math.sin(a)), WALL_BASE, a];
};
// голова шлейфа — сама пешка: чёрно-белая, «битая» блоками (голова почти чёрная, тело белое в шашечку), с белым контуром
const MOSH = createCanvas(GHOST.w, GHOST.h);
function moshHead(seed) {
  const { w, h, alpha } = GHOST, x = MOSH.getContext('2d'), id = x.createImageData(w, h), d = id.data;
  const R = rng(seed * 131 + 7), B = Math.max(3, Math.round(6 * S)), E = Math.max(1, Math.round(1.2 * S));
  const out = (px, y) => px < 0 || y < 0 || px >= w || y >= h || alpha[y * w + px] <= 128;
  for (let by = 0; by < h; by += B) for (let bx = 0; bx < w; bx += B) {
    const r1 = R(), r2 = R(), mode = r1 < (by < h * 0.3 ? 0.88 : 0.3) ? 0 : r2 < 0.22 ? 2 : 1; // 0 — чёрный, 1 — белый, 2 — шашечка
    for (let y = by; y < Math.min(h, by + B); y++) for (let px = bx; px < Math.min(w, bx + B); px++) {
      if (out(px, y)) continue;
      const edge = out(px - E, y) || out(px + E, y) || out(px, y - E) || out(px, y + E);
      const v = edge ? 250 : mode === 2 ? ((((px / 3) | 0) + ((y / 3) | 0)) & 1 ? 250 : 0) : mode * 250, o = (y * w + px) * 4;
      d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
    }
  }
  x.putImageData(id, 0, 0);
}
function tag(s, x, y) { // метка трекера на чёрной плашке — читается поверх текста
  ctx.font = `7.5px ${MONO}`; const w = ctx.measureText(s).width;
  ctx.fillStyle = BGS; ctx.fillRect(x - 2, y - 8, w + 4, 10.5);
  txt(s, x, y, { size: 7.5 });
}
function sceneWall(f) {
  const t = f - T.wall, gh = GHOST.lh, gw = GHOST.lw, [hx, hy, ha] = wallPose(t);
  const top = hy - gh * Math.cos(ha) - 8, bot = hy + 16;                                   // полоса шлейфа по высоте
  const right = hx + gh * Math.sin(ha) + gw * 0.3, left = Math.max(0, wallPose(t - ECHOES)[0] - gw * 0.55); // и его концы
  const lh = 29.5, typed = clamp((t - 2) * 0.74, 0, 16.6), full = Math.floor(typed);
  for (let i = 0; i <= Math.min(full, 16); i++) {
    const s = i < full ? WALL_LINES[i] : WALL_LINES[i].slice(0, Math.round((typed - full) * 78));
    if (!s) continue;
    // Строки, которые пересекает шлейф, гаснут целиком по высоте буквы и плавно по длине — справа от пешки.
    const yb = 21 + i * lh, ov = clamp((Math.min(yb + 2, bot) - Math.max(yb - 15, top)) / 17);
    let color = '#fff';
    if (ov > 0.2) {
      const v = Math.round(lerp(255, 64, smoothstep(0.2, 0.9, ov))), dim = `rgb(${v},${v},${v})`, x0 = left - 40, L = right + 330 - x0;
      color = ctx.createLinearGradient(x0, 0, x0 + L, 0);
      color.addColorStop(0, '#fff'); color.addColorStop(clamp(40 / L), dim); color.addColorStop(clamp((right + 110 - x0) / L), dim); color.addColorStop(1, '#fff');
    }
    txt(s, -9, yb, { size: 19.5, face: WIDE, weight: 'bold', color });
  }
  echoes(GHOST_MASK, gw, gh, wallPose, t);
  moshHead(f >> 1);
  drawImg(MOSH, hx, hy, gw, gh, { ang: ha, ax: 0.5, ay: 1, smooth: false });
  return {
    overlay: () => { // трекер поверх: красная рамка вокруг шлейфа, две метки и пунктирная дуга поворота
      if (t < 0) return;
      ctx.strokeStyle = 'rgba(226,58,58,0.9)'; ctx.lineWidth = 0.7; ctx.strokeRect(left + 0.5, top + 3.5, right - left - 1, bot - top - 6);
      tag(coord(left, top, f >> 1, 1), left + 3, top - 1);
      if (right - left > 150) tag(coord(right, top, f >> 1, 2), right - 66, top - 1);
      dashed(() => ctx.arc(hx, hy - gh * 0.5, gh * 0.66, Math.PI * 0.72, Math.PI * 1.5), { color: '#fff', alpha: 0.8, dash: [3, 3], offset: -f });
    },
  };
}
function sceneFlash(f) { // гигантский крупный план основания ферзя, 2 кадра
  const sc = [4.6, 3.7][f - T.flash];
  drawImg(QUEEN.can, LW / 2 + 30, LH * 0.62, QUEEN.lw * sc, QUEEN.lh * sc, { ax: 0.5, ay: 0.86 });
}

// S3 — ферзь-строб: одна фигура по центру, заливка меняется каждые 4 кадра (0,2 с, как в рефе)
const STROBE = ['letters', 'dots', 'glyphs', 'mosaic', 'pixel', 'hatch', 'letters', 'dots', 'mosaic', 'pink', 'pixel', 'glyphs', 'hatch'];
const CELL = { letters: 9, dots: 7.2, glyphs: 11, mosaic: 13, hatch: 5.4, pink: 8.6 };
function sceneQueen(f) {
  const t = f - T.queen, mode = STROBE[Math.floor(t / 4) % STROBE.length];
  const qx = LW / 2, base = 0.9 * LH, qh = QUEEN.lh, X = qx - QUEEN.lw / 2, Y = base - qh;
  if (mode === 'pixel') { drawImg(QPIX, qx, base, QUEEN.lw, qh, { ax: 0.5, ay: 1, smooth: false }); return; }
  const cell = CELL[mode];
  const sample = (lx, ly) => {
    const px = Math.round((lx - X) * S), py = Math.round((ly - Y) * S);
    if (px < 0 || py < 0 || px >= QUEEN.w || py >= QUEEN.h) return -1;
    const i = py * QUEEN.w + px; return QUEEN.alpha[i] > 140 ? QUEEN.lum[i] : -1;
  };
  const glyphs = ['♙', '♘', '♗', '♖', '♕', '♔', '♟', '♞', '♝', '♜', '♛', '♚', '◎', '⊕'];
  ctx.textAlign = 'center';
  let row = 0;
  for (let ly = Y + cell / 2; ly < base; ly += cell, row++) for (let lx = X + cell / 2, col = 0; lx < X + QUEEN.lw; lx += cell, col++) {
    const l = sample(lx, ly); if (l < 0) continue;
    const h = hash2(col * 3 + 1, row * 7 + 2);
    if (mode === 'dots') {
      ctx.fillStyle = '#f6f6f6'; ctx.beginPath(); ctx.arc(lx, ly, cell * 0.47 * (0.35 + 0.65 * Math.sqrt(l)), 0, TAU); ctx.fill();
    } else if (mode === 'letters') {
      ctx.fillStyle = rgb(mix([96, 96, 96], [250, 250, 250], 0.25 + 0.75 * l)); ctx.fillRect(lx - cell / 2 + 0.4, ly - cell / 2 + 0.4, cell - 0.8, cell - 0.8);
      ctx.font = `bold ${cell * 0.92}px ${MONO}`; ctx.fillStyle = '#111';
      ctx.fillText('EAKNHWXYZT'[Math.floor(h * 10)], lx, ly + cell * 0.33);
    } else if (mode === 'hatch') {
      ctx.font = `${cell * 1.45}px ${MONO}`; ctx.fillStyle = rgb(mix(BG, [215, 215, 215], 0.22 + 0.78 * l));
      ctx.fillText('|/!|1l\\I:|'[Math.floor(h * 10)], lx, ly + cell * 0.5);
    } else if (mode === 'pink') {
      ctx.fillStyle = rgb(mix(BG, PINK, 0.5 + 0.5 * l)); ctx.fillRect(lx - cell / 2 + 0.5, ly - cell / 2 + 0.5, cell - 1, cell - 1);
      ctx.strokeStyle = rgb(mix(BG, PINK, 0.28)); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(lx, ly, cell * 0.22, 0, TAU); ctx.stroke();
    } else if (mode === 'mosaic') {
      ctx.globalAlpha = 0.4 + 0.6 * l; ctx.drawImage(THUMBS[Math.floor(h * THUMBS.length)], lx - cell / 2 + 0.5, ly - cell / 2 + 0.5, cell - 1, cell - 1); ctx.globalAlpha = 1;
    } else { // glyphs
      ctx.font = `${cell * 1.12}px ${SYM}`; ctx.fillStyle = rgb(mix(BG, YEL, 0.45 + 0.55 * l));
      ctx.fillText(glyphs[Math.floor(h * glyphs.length)], lx, ly + cell * 0.4);
    }
  }
  ctx.textAlign = 'left';
}

// S4 — чёрный король поднимается из-под кадра, тормозит и доворачивается по часовой стрелке; шлейф под ним —
// его же силуэты из 14 прошлых кадров (движение снято с референса, см. KING_TOP). Рамки с руками растут от краёв.
const kingPose = i => { // [x, y, наклон] основания короля в кадре i от начала сцены
  const p = clamp(i / 27), a = rad(-22 + 34 * (1 - Math.pow(1 - p, 2.5)));
  const top = (i < 0 ? KING_TOP[0] - 40 * i : KING_TOP[Math.min(i, KING_TOP.length - 1)]) * (LH / 576);
  return [0.505 * LW - 0.5 * KING_B.lh * Math.sin(a), top + KING_B.lh * Math.cos(a), a];
};
function sceneKing(f) {
  const t = f - T.king, n = T.title - T.king, [kx, base, ang] = kingPose(t);
  echoes(KING_MASK, KING_B.lw, KING_B.lh, kingPose, t);
  drawImg(KING_B.can, kx, base, KING_B.lw, KING_B.lh, { ang, ax: 0.5, ay: 1 });
  const mx = kx + Math.sin(ang) * KING_B.lh * 0.42, my = base - Math.cos(ang) * KING_B.lh * 0.42;
  txt(coord(mx, my, f, 9), mx + 16, my, { size: 7.5 });
  txt(coord(mx + 9, my + 4, f, 8), mx + 20, my + 5, { size: 7.5, alpha: 0.7 });

  hm.setTransform(1, 0, 0, 1, 0, 0); hm.clearRect(0, 0, WP, HP); hm.setTransform(S, 0, 0, S, 0, 0);
  for (const H of HANDS) {
    if (t < H.from) continue;
    const e = Math.pow(clamp((t - (t % 2) - H.from) / (n - 1 - H.from)), 0.85), sc = lerp(0.32, 1, e); // растёт через кадр, в такт «снегу»
    const w = H.w * sc, h = H.h * sc, [x, y] = H.at(w, h);
    ctx.fillStyle = BGS; ctx.fillRect(x, y, w, h);
    hm.drawImage(H.tile, x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = '#e2e2e2'; ctx.lineWidth = 0.8; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (H.label) txt(coord(x, y, f >> 1, H.from), x + 2, y - 3.5, { size: 7.5 });
  }
  return { pre: d => staticNoise(d, hm.getImageData(0, 0, WP, HP).data, f) };
}

// S5 — перевод фокуса: сначала резкий король и размытый тайтл, потом наоборот; король не останавливается
function sceneTitle(f) {
  const t = f - T.title, focus = smoothstep(8, 15, t), ts = t - (t % 2); // движение через кадр — GIF заметно легче
  const word = '2MD55.ARCH';
  ctx.save();
  ctx.font = `bold 100px ${WIDE}`;
  const tw = ctx.measureText(word).width, sx = (LW * 0.8) / tw;
  ctx.translate(LW * 0.165, LH * 0.43); ctx.scale(sx, sx * 1.9);
  const tb = lerp(9, 0, focus); if (tb > 0.05) ctx.filter = `blur(${(tb * S).toFixed(2)}px)`;
  ctx.fillStyle = '#fff'; ctx.fillText(word, 0, 0);
  ctx.restore();
  if (focus > 0.97) txt('reverse engineering  ·  unity il2cpp  ·  luau  ·  c++', LW * 0.565, LH * 0.52, { size: 11, align: 'center', color: '#9aa0a6' });
  placePiece(KING_BIG, 0.085 * LW + ts * 0.55, 1.5 * LH - ts * 0.25, { blur: lerp(0, 5.5, focus), ang: rad(21 - ts * 0.12) });
}

// S6 — фигуры выскакивают по одной, в конце подпись и стек
function drawChips(y) {
  ctx.font = `12.5px ${MONO}`;
  const padX = 8, h = 23, gap = 9, r = 6, ws = STACK.map(s => ctx.measureText(s).width + padX * 2);
  let cx = (LW - ws.reduce((a, b) => a + b, 0) - gap * (STACK.length - 1)) / 2;
  STACK.forEach((s, i) => {
    const w = ws[i];
    ctx.fillStyle = 'rgb(38,41,46)';
    ctx.beginPath(); ctx.moveTo(cx + r, y); ctx.arcTo(cx + w, y, cx + w, y + h, r); ctx.arcTo(cx + w, y + h, cx, y + h, r);
    ctx.arcTo(cx, y + h, cx, y, r); ctx.arcTo(cx, y, cx + w, y, r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e6edf3'; ctx.textAlign = 'left'; ctx.fillText(s, cx + padX, y + 16);
    cx += w + gap;
  });
}
function sceneLineup(f) {
  const t = f - T.lineup, base = 0.85 * LH, gap = 14;
  const total = LINEUP.reduce((s, P) => s + P.lw, 0) + gap * (LINEUP.length - 1);
  let cx = (LW - total) / 2;
  LINEUP.forEach((P, i) => {
    const x = cx + P.lw / 2; cx += P.lw + gap;
    if (t >= LINE_POPS[i]) placePiece(P, x, base);
  });
  if (t >= 47) {
    txt('EVERY PIECE WAS A PAWN ONCE.', 44, 60, { size: 21, face: WIDE, weight: 'bold' });
    txt('2md55.arch', LW - 44, 53, { size: 12, align: 'right', color: '#d0d4d9' });
    txt('he/him', LW - 44, 68, { size: 9.5, align: 'right', color: '#7d848c' });
    drawChips(LH - 41);
  }
}

// ───────────────────────── render loop ─────────────────────────
function renderFrame(f) {
  resetCtx();
  ctx.fillStyle = BGS; ctx.fillRect(0, 0, LW, LH);
  let fx = null;
  if (f < T.pawn) sceneFlick(f);
  else if (f < T.push) scenePawn(f);
  else if (f < T.wall) { // пуш-переход: сцена с пешкой уезжает вправо, из-под неё уже виден шлейф
    const sh = [0.07, 0.22, 0.45, 0.7, 0.9][f - T.push] * LW;
    fx = sceneWall(f);
    ctx.save(); ctx.beginPath(); ctx.rect(sh, 0, LW - sh, LH); ctx.clip(); ctx.translate(sh, 0);
    ctx.fillStyle = BGS; ctx.fillRect(0, 0, LW, LH); scenePawn(f);
    ctx.restore();
  }
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
  return ctx.getImageData(0, 0, WP, HP);
}

// ───────────────────────── palette (pass 1) ─────────────────────────
// Гистограмма по всем кадрам (6 бит на канал) → взвешенный median cut → общая палитра на весь GIF.
const key18 = (r, g, b) => ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
const hist = new Uint32Array(1 << 18);
for (let f = 0; f < FRAMES; f++) {
  const d = renderFrame(f).data;
  for (let j = (f % 11) * 4; j < d.length; j += 44) hist[key18(d[j], d[j + 1], d[j + 2])]++;
}
function buildPalette(n) {
  const pts = [];
  for (let k = 0; k < hist.length; k++) if (hist[k]) pts.push([((k >> 12) & 63) * 4 + 2, ((k >> 6) & 63) * 4 + 2, (k & 63) * 4 + 2, Math.pow(hist[k], 0.55)]);
  const CW = [2, 4, 3]; // вес каналов: зелёный заметнее
  const mk = p => { const lo = [255, 255, 255], hi = [0, 0, 0]; let w = 0; for (const q of p) { w += q[3]; for (let c = 0; c < 3; c++) { if (q[c] < lo[c]) lo[c] = q[c]; if (q[c] > hi[c]) hi[c] = q[c]; } } return { p, w, lo, hi }; };
  const boxes = [mk(pts)];
  while (boxes.length < n) {
    let bi = -1, bs = 0, bc = 0;
    boxes.forEach((B, i) => {
      if (B.p.length < 2) return;
      for (let c = 0; c < 3; c++) { const ext = (B.hi[c] - B.lo[c]) * CW[c], s = ext * ext * B.w; if (s > bs) { bs = s; bi = i; bc = c; } }
    });
    if (bi < 0) break;
    const B = boxes[bi]; B.p.sort((a, b) => a[bc] - b[bc]);
    let acc = 0, cut = 1;
    for (let i = 0; i < B.p.length; i++) { acc += B.p[i][3]; if (acc >= B.w / 2) { cut = clamp(i + 1, 1, B.p.length - 1); break; } }
    boxes.splice(bi, 1, mk(B.p.slice(0, cut)), mk(B.p.slice(cut)));
  }
  return boxes.map(B => { const m = [0, 0, 0]; for (const q of B.p) for (let c = 0; c < 3; c++) m[c] += q[c] * q[3]; return m.map(v => { const x = Math.round(v / B.w); return x < 5 ? 0 : x > 250 ? 255 : x; }); });
}
const TRANSPARENT = 255;
// Плоские цвета (полосы шлейфа, «снег» на руках, золото меток) идут в палитру как есть — иначе дизеринг их мутит.
const FIXED = [BG.slice(), [255, 255, 255], ...RAMP.map(c => c.map(Math.round)), GOLD, [250, 250, 250], [215, 215, 215], [180, 180, 180], [140, 140, 140]];
const PALETTE = [...FIXED, ...buildPalette(255 - FIXED.length)];
const USED = PALETTE.length;
while (PALETTE.length < 256) PALETTE.push(BG.slice());
const PALF = new Uint8Array(USED * 3); PALETTE.slice(0, USED).forEach((p, i) => PALF.set(p, i * 3));
const LUT = new Uint8Array(1 << 18);
for (let k = 0; k < LUT.length; k++) {
  const R = ((k >> 12) & 63) * 4 + 2, G = ((k >> 6) & 63) * 4 + 2, B = (k & 63) * 4 + 2;
  let best = 0, bd = Infinity;
  for (let i = 0, o = 0; i < USED; i++, o += 3) {
    const dr = R - PALF[o], dg = G - PALF[o + 1], db = B - PALF[o + 2], dd = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dd < bd) { bd = dd; best = i; }
  }
  LUT[k] = best;
}
const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
// ближайший цвет палитры; там, где точного цвета нет (градиенты, размытие), — упорядоченный дизеринг
function quantize(d, idx) {
  for (let y = 0, i = 0, j = 0; y < HP; y++) for (let x = 0; x < WP; x++, i++, j += 4) {
    const r = d[j], g = d[j + 1], b = d[j + 2];
    let q = LUT[key18(r, g, b)];
    if (DITHER) {
      const o = q * 3;
      if (Math.abs(r - PALF[o]) + Math.abs(g - PALF[o + 1]) + Math.abs(b - PALF[o + 2]) > 7) {
        const n = (BAYER[((y & 7) << 3) | (x & 7)] / 64 - 0.5) * DITHER;
        q = LUT[key18(clamp(r + n, 0, 255), clamp(g + n, 0, 255), clamp(b + n, 0, 255))];
      }
    }
    idx[i] = q;
  }
}

// ───────────────────────── encode (pass 2) ─────────────────────────
const gif = GIFEncoder();
const idx = new Uint8Array(WP * HP), prev = new Uint8Array(WP * HP), out = new Uint8Array(WP * HP);
const SHEET_FRAMES = (process.env.SHEET_FRAMES ?? '3,11,16,30,36,38,44,56,68,70,74,86,90,94,112,131,140,150,155,160,172,184,196,214,239').split(',').map(Number);
const sheet = [], sceneSizes = [];
const BOUNDS = [T.pawn, T.wall, T.queen, T.king, T.title, T.lineup, T.end];
let staticImg = null;
for (let f = 0; f < FRAMES; f++) {
  const img = renderFrame(f);
  quantize(img.data, idx);
  const delay = HOLD[f] ?? DELAY;
  if (f === 0) gif.writeFrame(idx, WP, HP, { palette: PALETTE, delay, repeat: 0 });
  else {
    for (let i = 0; i < idx.length; i++) out[i] = idx[i] === prev[i] ? TRANSPARENT : idx[i];
    gif.writeFrame(out, WP, HP, { delay, transparent: true, transparentIndex: TRANSPARENT, dispose: 1 });
  }
  prev.set(idx);
  if (process.env.SIZES && BOUNDS.includes(f + 1)) sceneSizes.push(gif.bytes().length);
  if (process.env.SHEET && SHEET_FRAMES.includes(f)) sheet.push(Uint8Array.from(idx));
  if (f === FRAMES - 1) staticImg = img;
}
gif.finish();

fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
const gifPath = path.join(ROOT, 'assets', 'chess-header.gif');
fs.writeFileSync(gifPath, gif.bytes());
console.log(`chess-header.gif  ${WP}x${HP}  ${FRAMES}f @${1000 / DELAY}fps  ${(fs.statSync(gifPath).size / 1024 / 1024).toFixed(2)} MB  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (sceneSizes.length) console.log('per scene KB (flick/pawn/wall/queen/king/title/lineup):', sceneSizes.map((v, i) => Math.round((v - (sceneSizes[i - 1] ?? 0)) / 1024)).join(' / '));

{ // статичный кадр для prefers-reduced-motion
  const c = createCanvas(WP, HP); c.getContext('2d').putImageData(staticImg, 0, 0);
  fs.writeFileSync(path.join(ROOT, 'assets', 'chess-header-static.png'), c.toBuffer('image/png'));
}
if (process.env.SHEET) {
  const cols = Number(process.env.SHEET_COLS ?? 3), k = Number(process.env.SHEET_SCALE ?? 0.6);
  const sw = Math.round(WP * k), sh = Math.round(HP * k), rows = Math.ceil(sheet.length / cols);
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
