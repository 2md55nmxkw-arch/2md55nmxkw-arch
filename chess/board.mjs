// Минималистичная доска для README: плоские фигуры Cburnett (CC BY-SA 3.0, source/pieces/),
// светлые/тёмно-серые клетки, координаты в углах клеток, подсветка последнего хода и шаха.
// Без системных шрифтов — координаты рисуются встроенным пиксельным шрифтом (одинаково в GitHub Actions).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQ = 90;                          // клетка, физ. px; доска 720×720
const SIZE = SQ * 8, R = 10;            // скругление углов доски
const BG = '#0d1117';
const LIGHT = '#e3e5e8', DARK = '#6b727d';
const LAST = 'rgba(214,232,96,0.5)';    // акцент из шапки
const CHECK = [235, 64, 52];

// пиксельный шрифт 3×5 для координат
const G = {
  a: '...|.##|#.#|#.#|.##', b: '#..|##.|#.#|#.#|##.', c: '...|.##|#..|#..|.##', d: '..#|.##|#.#|#.#|.##',
  e: '...|.#.|###|#..|.##', f: '.##|#..|##.|#..|#..', g: '.##|#.#|.##|..#|##.', h: '#..|##.|#.#|#.#|#.#',
  1: '.#.|##.|.#.|.#.|###', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.', 4: '#.#|#.#|###|..#|..#',
  5: '###|#..|##.|..#|##.', 6: '.##|#..|##.|#.#|.#.', 7: '###|..#|.#.|.#.|.#.', 8: '.#.|#.#|.#.|#.#|.#.',
};
function glyph(ctx, ch, x, y, px, color) {
  ctx.fillStyle = color;
  G[ch].split('|').forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') ctx.fillRect(x + k * px, y + r * px, px, px); }));
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

const sqXY = sq => ({ x: (sq.charCodeAt(0) - 97) * SQ, y: (8 - Number(sq[1])) * SQ });

/**
 * board: chess.board() (ряды от 8-й горизонтали к 1-й)
 * last:  { from, to } | null;  check: поле короля под шахом | null
 */
export async function renderBoard({ board, last, check }) {
  const P = await pieces();
  const can = createCanvas(SIZE, SIZE), ctx = can.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, SIZE, SIZE, R) : ctx.rect(0, 0, SIZE, SIZE); ctx.clip();

  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    ctx.fillStyle = (r + f) & 1 ? DARK : LIGHT;
    ctx.fillRect(f * SQ, r * SQ, SQ, SQ);
  }
  if (last) for (const s of [last.from, last.to]) { const p = sqXY(s); ctx.fillStyle = LAST; ctx.fillRect(p.x, p.y, SQ, SQ); }
  if (check) {
    const p = sqXY(check), cx = p.x + SQ / 2, cy = p.y + SQ / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SQ * 0.62);
    g.addColorStop(0, `rgba(${CHECK},1)`); g.addColorStop(0.45, `rgba(${CHECK},0.85)`); g.addColorStop(1, `rgba(${CHECK},0)`);
    ctx.fillStyle = g; ctx.fillRect(p.x, p.y, SQ, SQ);
  }
  // координаты в углах клеток, цветом соседней клетки — как на chess.com / lichess
  const px = 4;
  for (let i = 0; i < 8; i++) {
    glyph(ctx, String(8 - i), 6, i * SQ + 6, px, i & 1 ? LIGHT : DARK);
    glyph(ctx, 'abcdefgh'[i], i * SQ + SQ - 3 * px - 6, SIZE - 5 * px - 6, px, i & 1 ? DARK : LIGHT);
  }
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = board[r][f];
    if (p) ctx.drawImage(P[p.color + p.type], f * SQ, r * SQ, SQ, SQ);
  }
  ctx.restore();
  try { return await can.encode('webp', 90); } catch { return can.toBuffer('image/png'); }
}
