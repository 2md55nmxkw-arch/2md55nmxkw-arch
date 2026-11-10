// Карточка «зала славы» для того, кто поставил мат Stockfish: зернистый аватар в стиле шапки + пиксельные подписи.
// Пустая карточка-приглашение, пока победителей нет.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { drawText, textWidth } from './pixfont.mjs';

const W = 480, H = 270;
const BG = '#0d1117', LINE = '#30363d', YEL = '#d6e860', GRAY = '#8b949e';

function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function frame(ctx) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  const r = 14; ctx.beginPath(); ctx.moveTo(r + 1, 1);
  ctx.arcTo(W - 1, 1, W - 1, H - 1, r); ctx.arcTo(W - 1, H - 1, 1, H - 1, r); ctx.arcTo(1, H - 1, 1, 1, r); ctx.arcTo(1, 1, W - 1, 1, r);
  ctx.closePath(); ctx.stroke();
}
function crown(ctx, x, y, s, color) { // пиксельная корона 9×6
  const rows = ['#...#...#', '##.###.##', '#########', '#########', '.#######.', '.#######.'];
  ctx.fillStyle = color;
  rows.forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') ctx.fillRect(x + k * s, y + r * s, s, s); }));
}
// аватар → круг с «песочным» чёрно-белым зерном
function grainAvatar(ctx, img, cx, cy, rad) {
  const d = rad * 2, tmp = createCanvas(d, d), t = tmp.getContext('2d');
  t.drawImage(img, 0, 0, d, d);
  const id = t.getImageData(0, 0, d, d), px = id.data;
  const lums = [];
  for (let i = 0; i < px.length; i += 4) lums.push(0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]);
  const sorted = [...lums].sort((a, b) => a - b), lo = sorted[Math.floor(sorted.length * 0.03)], hi = sorted[Math.floor(sorted.length * 0.97)];
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const i = y * d + x, o = i * 4, dx = x - rad + 0.5, dy = y - rad + 0.5;
    if (dx * dx + dy * dy > rad * rad) { px[o + 3] = 0; continue; }
    const v = Math.min(1, Math.max(0, (lums[i] - lo) / (hi - lo || 1))) ** 0.85, g = hash2(x >> 1, y >> 1);
    const c = g < v ? 236 : g < v + 0.2 ? 140 : 40;
    px[o] = px[o + 1] = c; px[o + 2] = c - 2; px[o + 3] = 255;
  }
  t.putImageData(id, 0, 0);
  ctx.drawImage(tmp, cx - rad, cy - rad);
  ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2); ctx.stroke();
}
async function avatar(user) {
  if (process.env.NO_AVATAR) return null;
  try {
    const res = await fetch(`https://github.com/${user}.png?size=200`);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch { return null; }
}
const fit = (s, max, px) => { let t = s; while (t.length > 1 && textWidth(t, px) > max) t = t.slice(0, -1); return t === s ? s : t.slice(0, -1) + '.'; };

export async function renderTrophy({ user, game, plies }) {
  const can = createCanvas(W, H), ctx = can.getContext('2d');
  frame(ctx);
  const img = await avatar(user);
  if (img) grainAvatar(ctx, img, 120, 135, 82);
  else { // нет аватара — инициал в круге
    ctx.fillStyle = '#1c2128'; ctx.beginPath(); ctx.arc(120, 135, 82, 0, Math.PI * 2); ctx.fill();
    drawText(ctx, user[0] ?? '?', 120, 114, { px: 6, color: '#e6e6e6', align: 'center' });
    ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(120, 135, 86, 0, Math.PI * 2); ctx.stroke();
  }
  const X = 226;
  crown(ctx, X, 40, 4, YEL);
  drawText(ctx, 'CHECKMATED', X, 76, { px: 4 });
  drawText(ctx, 'STOCKFISH', X, 112, { px: 4 });
  const name = '@' + user, npx = textWidth(name, 3) <= W - X - 18 ? 3 : 2; // длинные ники — мельче
  drawText(ctx, fit(name, W - X - 18, npx), X, npx === 3 ? 166 : 170, { px: npx, color: YEL });
  drawText(ctx, `GAME ${game} · ${Math.ceil(plies / 2)} MOVES`, X, 206, { px: 2, color: GRAY });
  try { return await can.encode('webp', 90); } catch { return can.toBuffer('image/png'); }
}

export async function renderEmptyTrophy() {
  const can = createCanvas(W, H), ctx = can.getContext('2d');
  frame(ctx);
  ctx.setLineDash([6, 6]); ctx.strokeStyle = '#484f58'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(120, 135, 82, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  drawText(ctx, '?', 120, 114, { px: 6, color: '#484f58', align: 'center' });
  const X = 232;
  crown(ctx, X, 52, 4, '#484f58');
  drawText(ctx, 'NOBODY HAS', X, 92, { px: 3 });
  drawText(ctx, 'BEATEN IT YET', X, 120, { px: 3 });
  drawText(ctx, 'YOUR CARD GOES HERE', X, 172, { px: 2, color: YEL });
  try { return await can.encode('webp', 90); } catch { return can.toBuffer('image/png'); }
}
