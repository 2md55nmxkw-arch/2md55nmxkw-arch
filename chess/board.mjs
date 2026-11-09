// Минималистичная доска для README: плоские фигуры Cburnett (CC BY-SA 3.0, source/pieces/),
// светлые/тёмно-серые клетки, координаты в углах клеток, подсветка последнего хода и шаха,
// значки оценки хода (как на chess.com) и шкала оценки слева.
// Без системных шрифтов — подписи рисуются встроенным пиксельным шрифтом (одинаково в GitHub Actions).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawBadge } from './badges.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQ = 90;                          // клетка, физ. px; доска 720×720
const BOARD = SQ * 8, R = 10;           // скругление углов
const BAR = 46, GAP = 12;               // шкала оценки слева
const BG = '#0d1117';
const LIGHT = '#e3e5e8', DARK = '#6b727d', BAR_DARK = '#30353c';
const LAST = 'rgba(214,232,96,0.5)';    // акцент из шапки
const CHECK = [235, 64, 52];

// пиксельный шрифт 3×5 для координат и шкалы
const G = {
  a: '...|.##|#.#|#.#|.##', b: '#..|##.|#.#|#.#|##.', c: '...|.##|#..|#..|.##', d: '..#|.##|#.#|#.#|.##',
  e: '...|.#.|###|#..|.##', f: '.##|#..|##.|#..|#..', g: '.##|#.#|.##|..#|##.', h: '#..|##.|#.#|#.#|#.#',
  0: '.#.|#.#|#.#|#.#|.#.', 1: '.#.|##.|.#.|.#.|###', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.',
  4: '#.#|#.#|###|..#|..#', 5: '###|#..|##.|..#|##.', 6: '.##|#..|##.|#.#|.#.', 7: '###|..#|.#.|.#.|.#.',
  8: '.#.|#.#|.#.|#.#|.#.', 9: '.#.|#.#|.##|..#|##.', '.': '...|...|...|...|.#.', M: '#.#|###|###|#.#|#.#',
};
function text(ctx, str, x, y, px, color, align = 'left') {
  const w = str.length * 4 * px - px;
  let X = align === 'center' ? Math.round(x - w / 2) : x;
  ctx.fillStyle = color;
  for (const ch of str) {
    G[ch]?.split('|').forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') ctx.fillRect(X + k * px, y + r * px, px, px); }));
    X += 4 * px;
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// SVG растрируем сразу в размер клетки: задаём width/height и viewBox
let PIECES = null;
async function pieces() {
  if (PIECES) return PIECES;
  PIECES = {};
  for (const c of 'wb') for (const t of 'kqrbnp') {
    let svg = fs.readFileSync(path.join(ROOT, 'source', 'pieces', `Chess_${t}${c === 'w' ? 'l' : 'd'}t45.svg`), 'utf8');
    svg = svg.replace(/<svg\b([^>]*)>/, (m, attrs) => {
      let a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
      if (!/viewBox=/.test(a)) a += ' viewBox="0 0 45 45"';
      return `<svg${a} width="${SQ}" height="${SQ}">`;
    });
    PIECES[c + t] = await loadImage(Buffer.from(svg));
  }
  return PIECES;
}

// доля белых на шкале и подпись: score — с точки зрения белых, { cp } | { mate }
function evalBar(score) {
  if (!score) return { share: 0.5, label: '0.0', white: true };
  if (score.mate !== undefined) return { share: score.mate > 0 ? 1 : 0, label: `M${Math.abs(score.mate)}`, white: score.mate > 0 };
  const cp = score.cp;
  // знак не пишем: сторону и так видно по тому, сверху или снизу подпись
  return { share: Math.min(0.95, Math.max(0.05, 1 / (1 + Math.exp(-cp / 260)))), label: (Math.abs(cp) / 100).toFixed(1), white: cp >= 0 };
}

/**
 * board: chess.board() (ряды от 8-й горизонтали к 1-й) или такой же массив из своих «фигур»
 * last:  { from, to } | null;  check: поле короля под шахом | null;  score: оценка за белых
 * marks: [{ square, cls }] — значки оценки хода;  bar: рисовать шкалу оценки
 */
export async function renderBoard({ board, last, check, score, marks = [], bar = true, highlight = [] }) {
  const P = await pieces();
  const X0 = bar ? BAR + GAP : 0, W = X0 + BOARD, H = BOARD;
  const sqXY = sq => ({ x: X0 + (sq.charCodeAt(0) - 97) * SQ, y: (8 - Number(sq[1])) * SQ });
  const can = createCanvas(W, H), ctx = can.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

  if (bar) {
    const ev = evalBar(score), split = Math.round(H * (1 - ev.share));
    ctx.save(); roundRect(ctx, 0, 0, BAR, H, 6); ctx.clip();
    ctx.fillStyle = BAR_DARK; ctx.fillRect(0, 0, BAR, H);
    ctx.fillStyle = LIGHT; ctx.fillRect(0, split, BAR, H - split);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, H / 2 - 1, BAR, 2); // середина
    ctx.restore();
    if (ev.white) text(ctx, ev.label, BAR / 2, H - 15 - 8, 3, BAR_DARK, 'center');
    else text(ctx, ev.label, BAR / 2, 8, 3, LIGHT, 'center');
  }

  ctx.save(); roundRect(ctx, X0, 0, BOARD, BOARD, R); ctx.clip();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    ctx.fillStyle = (r + f) & 1 ? DARK : LIGHT;
    ctx.fillRect(X0 + f * SQ, r * SQ, SQ, SQ);
  }
  for (const s of [...(last ? [last.from, last.to] : []), ...highlight]) { const p = sqXY(s); ctx.fillStyle = LAST; ctx.fillRect(p.x, p.y, SQ, SQ); }
  if (check) {
    const p = sqXY(check), cx = p.x + SQ / 2, cy = p.y + SQ / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SQ * 0.62);
    g.addColorStop(0, `rgba(${CHECK},1)`); g.addColorStop(0.45, `rgba(${CHECK},0.85)`); g.addColorStop(1, `rgba(${CHECK},0)`);
    ctx.fillStyle = g; ctx.fillRect(p.x, p.y, SQ, SQ);
  }
  // координаты в углах клеток, цветом соседней клетки — как на chess.com / lichess
  for (let i = 0; i < 8; i++) {
    text(ctx, String(8 - i), X0 + 6, i * SQ + 6, 4, i & 1 ? LIGHT : DARK);
    text(ctx, 'abcdefgh'[i], X0 + i * SQ + SQ - 12 - 6, BOARD - 20 - 6, 4, i & 1 ? DARK : LIGHT);
  }
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = board[r][f];
    if (p) ctx.drawImage(P[p.color + p.type], X0 + f * SQ, r * SQ, SQ, SQ);
  }
  for (const m of marks) { const p = sqXY(m.square); drawBadge(ctx, p.x + SQ - 19, p.y + 19, 16, m.cls); }
  ctx.restore();
  try { return await can.encode('webp', 90); } catch { return can.toBuffer('image/png'); }
}
