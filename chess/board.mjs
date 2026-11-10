// Доска для README: клетки в палитре GitHub (тёмной или светлой — см. theme.mjs), плоские фигуры
// Cburnett (CC BY-SA 3.0, source/pieces/, перекрашены под тему), уголки-скобки и засечки по краям,
// рамка на последнем ходе, розовая подсветка шаха, значки оценки хода (как на chess.com) и шкала оценки слева.
// Без системных шрифтов: из текста только координаты и число на шкале — мелкими точечными цифрами,
// поэтому доска одинаково рендерится локально и в GitHub Actions.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawBadge } from './badges.mjs';
import { THEMES } from './theme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQ = 90, BOARD = SQ * 8;          // доска 720×720
const M = 26;                           // поле вокруг доски под HUD
const BAR = 30, GAP = 14;               // шкала оценки слева
const rgba = (c, a) => `rgba(${c.join(',')},${a})`;

// цифры/буквы 3×5 для координат и шкалы
const G = {
  a: '...|.##|#.#|#.#|.##', b: '#..|##.|#.#|#.#|##.', c: '...|.##|#..|#..|.##', d: '..#|.##|#.#|#.#|.##',
  e: '...|.#.|###|#..|.##', f: '.##|#..|##.|#..|#..', g: '.##|#.#|.##|..#|##.', h: '#..|##.|#.#|#.#|#.#',
  0: '.#.|#.#|#.#|#.#|.#.', 1: '.#.|##.|.#.|.#.|###', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.',
  4: '#.#|#.#|###|..#|..#', 5: '###|#..|##.|..#|##.', 6: '.##|#..|##.|#.#|.#.', 7: '###|..#|.#.|.#.|.#.',
  8: '.#.|#.#|.#.|#.#|.#.', 9: '.#.|#.#|.##|..#|##.', '.': '...|...|...|...|.#.', M: '#.#|###|###|#.#|#.#',
};
function small(ctx, str, x, y, px, color, align = 'left') {
  const w = str.length * 4 * px - px;
  let X = Math.round(align === 'center' ? x - w / 2 : x);
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

// SVG → растр размером в клетку; перекраска под тему
const PIECES = {};
async function pieces(theme) {
  if (PIECES[theme]) return PIECES[theme];
  const out = {}, recolor = THEMES[theme].piece;
  for (const c of 'wb') for (const t of 'kqrbnp') {
    const tone = c === 'w' ? 'l' : 'd';
    let svg = fs.readFileSync(path.join(ROOT, 'source', 'pieces', `Chess_${t}${tone}t45.svg`), 'utf8');
    for (const [a, b] of recolor[tone]) svg = svg.split(a).join(b);
    svg = svg.replace(/<svg\b([^>]*)>/, (m, attrs) => {
      let a = attrs.replace(/\s(width|height)="[^"]*"/g, '');
      if (!/viewBox=/.test(a)) a += ' viewBox="0 0 45 45"';
      return `<svg${a} width="${SQ}" height="${SQ}">`;
    });
    out[c + t] = await loadImage(Buffer.from(svg));
  }
  return (PIECES[theme] = out);
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
 * board: chess.board() (ряды от 8-й горизонтали к 1-й) или такой же массив своих «фигур»
 * last:  { from, to } | null;  check: поле короля под шахом | null;  score: оценка за белых
 * marks: [{ square, cls }] — значки оценки хода;  bar: шкала оценки;  highlight: доп. подсвеченные поля
 * theme: 'dark' | 'light'
 */
export async function renderBoard({ board, last, check, score, marks = [], bar = true, barSpace = bar, highlight = [], theme = 'dark' }) {
  const T = THEMES[theme], P = await pieces(theme);
  const X0 = (barSpace ? BAR + GAP : 0) + M, Y0 = M; // barSpace — оставить место под шкалу, чтобы доски выравнивались
  const W = X0 + BOARD + M, H = Y0 + BOARD + M;
  const sqXY = sq => ({ x: X0 + (sq.charCodeAt(0) - 97) * SQ, y: Y0 + (8 - Number(sq[1])) * SQ });
  const can = createCanvas(W, H), ctx = can.getContext('2d');
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);

  // шкала оценки
  if (bar) {
    const ev = evalBar(score), split = Math.round(BOARD * (1 - ev.share));
    ctx.save(); roundRect(ctx, 0, Y0, BAR, BOARD, 4); ctx.clip();
    ctx.fillStyle = T.barBlack; ctx.fillRect(0, Y0, BAR, BOARD);
    ctx.fillStyle = T.barWhite; ctx.fillRect(0, Y0 + split, BAR, BOARD - split);
    ctx.fillStyle = 'rgba(128,128,128,0.35)'; ctx.fillRect(0, Y0 + BOARD / 2 - 1, BAR, 2);
    ctx.restore();
    ctx.strokeStyle = T.line; ctx.lineWidth = 1; roundRect(ctx, 0.5, Y0 + 0.5, BAR - 1, BOARD - 1, 4); ctx.stroke();
    if (ev.white) small(ctx, ev.label, BAR / 2, Y0 + BOARD - 16, 2, T.barBlack, 'center');
    else small(ctx, ev.label, BAR / 2, Y0 + 6, 2, T.barWhite, 'center');
  }

  // клетки, подсветка, шах
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    ctx.fillStyle = (r + f) & 1 ? T.sqDark : T.sqLight;
    ctx.fillRect(X0 + f * SQ, Y0 + r * SQ, SQ, SQ);
  }
  for (const s of [...(last ? [last.from, last.to] : []), ...highlight]) { const p = sqXY(s); ctx.fillStyle = rgba(T.mark, T.markAlpha); ctx.fillRect(p.x, p.y, SQ, SQ); }
  if (check) {
    const p = sqXY(check), cx = p.x + SQ / 2, cy = p.y + SQ / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SQ * 0.62);
    g.addColorStop(0, rgba(T.pink, 0.95)); g.addColorStop(0.5, rgba(T.pink, 0.55)); g.addColorStop(1, rgba(T.pink, 0));
    ctx.fillStyle = g; ctx.fillRect(p.x, p.y, SQ, SQ);
  }
  ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.strokeRect(X0 - 0.5, Y0 - 0.5, BOARD + 1, BOARD + 1);

  // HUD: уголки-скобки и засечки, как у вьюпорта в шапке
  ctx.strokeStyle = T.hud; ctx.lineWidth = 2;
  const o = 10, L = 22;
  for (const [cx, cy, dx, dy] of [[X0 - o, Y0 - o, 1, 1], [X0 + BOARD + o, Y0 - o, -1, 1], [X0 - o, Y0 + BOARD + o, 1, -1], [X0 + BOARD + o, Y0 + BOARD + o, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L); ctx.stroke();
  }
  ctx.fillStyle = T.line;
  for (let i = 1; i < 8; i++) { ctx.fillRect(X0 + i * SQ - 1, Y0 - 7, 2, 5); ctx.fillRect(X0 + i * SQ - 1, Y0 + BOARD + 2, 2, 5); }
  // координаты снаружи, мелкими точечными цифрами
  for (let i = 0; i < 8; i++) {
    small(ctx, 'abcdefgh'[i], X0 + i * SQ + SQ / 2, Y0 + BOARD + 9, 2, T.dim, 'center');
    small(ctx, String(8 - i), X0 - 13, Y0 + i * SQ + SQ / 2 - 5, 2, T.dim, 'center');
  }

  // фигуры и значки
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = board[r][f];
    if (p) ctx.drawImage(P[p.color + p.type], X0 + f * SQ, Y0 + r * SQ, SQ, SQ);
  }
  // рамка на фигуре, которая только что сходила
  if (last) { const p = sqXY(last.to); ctx.strokeStyle = T.hud; ctx.lineWidth = 2; ctx.strokeRect(p.x + 3, p.y + 3, SQ - 6, SQ - 6); }
  for (const m of marks) { const p = sqXY(m.square); drawBadge(ctx, p.x + SQ - 18, p.y + 18, 15, m.cls); }
  try { return await can.encode('webp', 90); } catch { return can.toBuffer('image/png'); }
}
