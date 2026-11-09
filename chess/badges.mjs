// Значки оценки хода в духе chess.com: цветной кружок с символом.
//   node chess/badges.mjs  — перегенерировать иконки для README в chess/icons/*.png
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BADGE = {
  brilliant: { color: '#26c2a3', sym: '!!', text: '!! brilliant' },
  great: { color: '#749bbf', sym: '!', text: '! great move' },
  best: { color: '#81b64c', sym: 'star', text: '★ best move' },
  excellent: { color: '#81b64c', sym: 'check', text: '✓ excellent' },
  good: { color: '#95af8a', sym: 'check', text: '✓ good' },
  book: { color: '#a88865', sym: 'book', text: 'book move' },
  inaccuracy: { color: '#f7c631', sym: '?!', text: '?! inaccuracy' },
  mistake: { color: '#ffa459', sym: '?', text: '? mistake' },
  blunder: { color: '#fa412d', sym: '??', text: '?? blunder' },
  forced: { color: '#96af8b', sym: 'arrow', text: 'forced' },
};
const F = { '!': '.#.|.#.|.#.|...|.#.', '?': '##.|..#|.#.|...|.#.' };

export function drawBadge(ctx, cx, cy, r, cls) {
  const b = BADGE[cls];
  if (!b) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(cx + r * 0.06, cy + r * 0.12, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (b.sym === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.27 : r * 0.62;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  } else if (b.sym === 'check') {
    ctx.lineWidth = r * 0.26; ctx.beginPath();
    ctx.moveTo(cx - r * 0.42, cy + r * 0.02); ctx.lineTo(cx - r * 0.1, cy + r * 0.34); ctx.lineTo(cx + r * 0.45, cy - r * 0.3); ctx.stroke();
  } else if (b.sym === 'arrow') {
    ctx.lineWidth = r * 0.24; ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx + r * 0.4, cy); ctx.moveTo(cx + r * 0.1, cy - r * 0.3); ctx.lineTo(cx + r * 0.42, cy); ctx.lineTo(cx + r * 0.1, cy + r * 0.3); ctx.stroke();
  } else if (b.sym === 'book') { // раскрытая книга
    ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.32); ctx.lineTo(cx, cy + r * 0.4);
    ctx.moveTo(cx, cy - r * 0.32); ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.48, cx - r * 0.52, cy - r * 0.32); ctx.lineTo(cx - r * 0.52, cy + r * 0.36); ctx.quadraticCurveTo(cx - r * 0.3, cy + r * 0.24, cx, cy + r * 0.4);
    ctx.moveTo(cx, cy - r * 0.32); ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 0.48, cx + r * 0.52, cy - r * 0.32); ctx.lineTo(cx + r * 0.52, cy + r * 0.36); ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 0.24, cx, cy + r * 0.4);
    ctx.stroke();
  } else {
    const px = Math.max(1, Math.round(r * 0.19)), n = b.sym.length, w = n * 3 * px + (n - 1) * px;
    let x = Math.round(cx - w / 2);
    const y = Math.round(cy - 2.5 * px);
    for (const ch of b.sym) {
      F[ch].split('|').forEach((row, ri) => [...row].forEach((c, k) => { if (c === '#') ctx.fillRect(x + k * px, y + ri * px, px, px); }));
      x += 4 * px;
    }
  }
  ctx.restore();
}

// CLI: иконки для README (64×64, в README показываются 16px)
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'icons');
  fs.mkdirSync(dir, { recursive: true });
  for (const cls of Object.keys(BADGE)) {
    const c = createCanvas(64, 64), x = c.getContext('2d');
    drawBadge(x, 31, 30, 27, cls);
    fs.writeFileSync(path.join(dir, `${cls}.png`), c.toBuffer('image/png'));
  }
  console.log('icons ->', dir);
}
