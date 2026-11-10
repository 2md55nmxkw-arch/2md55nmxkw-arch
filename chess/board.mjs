// Доска для README в стиле шапки: тёмные клетки в палитре GitHub dark, плоские фигуры Cburnett
// (CC BY-SA 3.0, source/pieces/, перекрашены под тёмную тему), HUD как в шапке — уголки-скобки,
// засечки по краям, трекинг-рамка с координатами на последнем ходе, розовый шах.
// Плюс значки оценки хода (как на chess.com) и шкала оценки слева.
// Без системных шрифтов — подписи рисуются пиксельными шрифтами (одинаково в GitHub Actions).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawBadge } from './badges.mjs';
import { drawText } from './pixfont.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQ = 90, BOARD = SQ * 8;          // доска 720×720
const M = 26;                           // поле вокруг доски под HUD
const BAR = 30, GAP = 14;               // шкала оценки слева
const BG = '#0d1117';
const LIGHT = '#2d333b', DARK = '#1c2128';
const HUD = '#e6e6e6', DIM = '#6e7681';
const YEL = [214, 232, 96], PINK = [255, 70, 170];
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

// SVG → растр размером в клетку; перекраска под тёмную доску
const RECOLOR = {
  l: [['fill:#ffffff', 'fill:#eef0f3'], ['fill="#fff', 'fill="#eef0f3'], ['stroke:#000000', 'stroke:#0d1117'], ['stroke="#000', 'stroke="#0d1117'], ['fill:#000000', 'fill:#0d1117']],
  d: [['fill:#000000', 'fill:#161b22'], ['stroke:#000000', 'stroke:#c9d1d9'], ['stroke:#ffffff', 'stroke:#c9d1d9'], ['fill:#ffffff', 'fill:#c9d1d9']],
};
let PIECES = null;
async function pieces() {
  if (PIECES) return PIECES;
  PIECES = {};
  for (const c of 'wb') for (const t of 'kqrbnp') {
    const tone = c === 'w' ? 'l' : 'd';
    let svg = fs.readFileSync(path.join(ROOT, 'source', 'pieces', `Chess_${t}${tone}t45.svg`), 'utf8');
    for (const [a, b] of RECOLOR[tone]) svg = svg.split(a).join(b);
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
 * board: chess.board() (ряды от 8-й горизонтали к 1-й) или такой же массив своих «фигур»
 * last:  { from, to } | null;  check: поле короля под шахом | null;  score: оценка за белых
 * marks: [{ square, cls }] — значки оценки хода;  bar: шкала оценки;  highlight: доп. подсвеченные поля
 * footer: строка HUD под доской
 */
export async function renderBoard({ board, last, check, score, marks = [], bar = true, barSpace = bar, highlight = [], footer }) {
  const P = await pieces();
  const X0 = (barSpace ? BAR + GAP : 0) + M, Y0 = M; // barSpace — оставить место под шкалу, чтобы доски выравнивались
  const W = X0 + BOARD + M, H = Y0 + BOARD + M + (footer ? 34 : 0);
  const sqXY = sq => ({ x: X0 + (sq.charCodeAt(0) - 97) * SQ, y: Y0 + (8 - Number(sq[1])) * SQ });
  const can = createCanvas(W, H), ctx = can.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

  // шкала оценки
  if (bar) {
    const ev = evalBar(score), split = Math.round(BOARD * (1 - ev.share));
    ctx.save(); roundRect(ctx, 0, Y0, BAR, BOARD, 4); ctx.clip();
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, Y0, BAR, BOARD);
    ctx.fillStyle = '#e6edf3'; ctx.fillRect(0, Y0 + split, BAR, BOARD - split);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, Y0 + BOARD / 2 - 1, BAR, 2);
    ctx.restore();
    ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1; roundRect(ctx, 0.5, Y0 + 0.5, BAR - 1, BOARD - 1, 4); ctx.stroke();
    if (ev.white) small(ctx, ev.label, BAR / 2, Y0 + BOARD - 16, 2, '#161b22', 'center');
    else small(ctx, ev.label, BAR / 2, Y0 + 6, 2, '#e6edf3', 'center');
  }

  // клетки, подсветка, шах
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    ctx.fillStyle = (r + f) & 1 ? DARK : LIGHT;
    ctx.fillRect(X0 + f * SQ, Y0 + r * SQ, SQ, SQ);
  }
  for (const s of [...(last ? [last.from, last.to] : []), ...highlight]) { const p = sqXY(s); ctx.fillStyle = rgba(YEL, 0.2); ctx.fillRect(p.x, p.y, SQ, SQ); }
  if (check) {
    const p = sqXY(check), cx = p.x + SQ / 2, cy = p.y + SQ / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SQ * 0.62);
    g.addColorStop(0, rgba(PINK, 0.95)); g.addColorStop(0.5, rgba(PINK, 0.55)); g.addColorStop(1, rgba(PINK, 0));
    ctx.fillStyle = g; ctx.fillRect(p.x, p.y, SQ, SQ);
  }
  ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1; ctx.strokeRect(X0 - 0.5, Y0 - 0.5, BOARD + 1, BOARD + 1);

  // HUD: уголки-скобки и засечки, как у вьюпорта в шапке
  ctx.strokeStyle = HUD; ctx.lineWidth = 2;
  const o = 10, L = 22;
  for (const [cx, cy, dx, dy] of [[X0 - o, Y0 - o, 1, 1], [X0 + BOARD + o, Y0 - o, -1, 1], [X0 - o, Y0 + BOARD + o, 1, -1], [X0 + BOARD + o, Y0 + BOARD + o, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L); ctx.stroke();
  }
  ctx.fillStyle = '#30363d';
  for (let i = 1; i < 8; i++) { ctx.fillRect(X0 + i * SQ - 1, Y0 - 7, 2, 5); ctx.fillRect(X0 + i * SQ - 1, Y0 + BOARD + 2, 2, 5); }
  // координаты снаружи, мелким пиксельным шрифтом
  for (let i = 0; i < 8; i++) {
    small(ctx, 'abcdefgh'[i], X0 + i * SQ + SQ / 2, Y0 + BOARD + 9, 2, DIM, 'center');
    small(ctx, String(8 - i), X0 - 13, Y0 + i * SQ + SQ / 2 - 5, 2, DIM, 'center');
  }

  // фигуры и значки
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = board[r][f];
    if (p) ctx.drawImage(P[p.color + p.type], X0 + f * SQ, Y0 + r * SQ, SQ, SQ);
  }
  // трекинг-рамка с координатами на пришедшей фигуре
  if (last) {
    const p = sqXY(last.to);
    ctx.strokeStyle = HUD; ctx.lineWidth = 2; ctx.strokeRect(p.x + 3, p.y + 3, SQ - 6, SQ - 6);
    const tag = `X: ${Math.round((p.x + SQ / 2) * 1.74)} Y: ${Math.round((p.y + SQ / 2) * 1.27)}`;
    const ty = p.y > Y0 ? p.y - 16 : p.y + SQ + 6, tx = p.x + SQ / 2 > W / 2 ? p.x + SQ - 3 : p.x + 3;
    ctx.fillStyle = 'rgba(13,17,23,0.85)';
    const tw = tag.length * 12 - 2;
    ctx.fillRect(tx - (tx === p.x + 3 ? 4 : tw + 4), ty - 4, tw + 8, 22);
    drawText(ctx, tag, tx, ty, { px: 2, color: HUD, align: tx === p.x + 3 ? 'left' : 'right' });
  }
  for (const m of marks) { const p = sqXY(m.square); drawBadge(ctx, p.x + SQ - 18, p.y + 18, 15, m.cls); }
  if (check) { const p = sqXY(check); ctx.fillStyle = 'rgba(13,17,23,0.85)'; ctx.fillRect(p.x + SQ / 2 - 34, p.y + SQ - 20, 68, 18); drawText(ctx, 'CHECK', p.x + SQ / 2, p.y + SQ - 17, { px: 2, color: rgba(PINK, 1), align: 'center' }); }

  if (footer) drawText(ctx, footer, X0, Y0 + BOARD + M + 8, { px: 2, color: DIM });
  try { return await can.encode('webp', 90); } catch { return can.toBuffer('image/png'); }
}
