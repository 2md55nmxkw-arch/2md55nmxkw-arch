// Заголовки секций тем же шрифтом, что в шапке (DIN Condensed Bold + Menlo), прозрачные PNG.
// Статичные: рендерятся локально на macOS и коммитятся, в CI шрифты не нужны.
//   node chess/titles.mjs  -> chess/titles/*.png
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'titles');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf', 'Cond');
GlobalFonts.registerFromPath('/System/Library/Fonts/Menlo.ttc', 'Mono');

const S = 2;
// подписи в две строки, чтобы заголовок помещался справа от доски (≈ 330 px)
const TITLES = {
  'your-move': ['YOUR MOVE.', ['you play white vs stockfish', 'click a move, then Create']],
  'hall-of-mate': ['HALL OF MATE.', ['checkmate stockfish', 'to get your card here']],
  'every-commit': ['EVERY COMMIT IS A MOVE.', ['last 64 days · a1 → h8', 'pawn → king by activity']],
};

fs.mkdirSync(DIR, { recursive: true });
const meta = {};
for (const [name, [title, sub]] of Object.entries(TITLES)) {
  // размеры в CSS-пикселях: в README картинка показывается 1:1, рендер ×2 для retina
  const probe = createCanvas(10, 10).getContext('2d');
  probe.font = '32px Cond'; const tw = probe.measureText(title).width;
  probe.font = '12px Mono'; const sw = Math.max(...sub.map(s => probe.measureText(s).width));
  const w = Math.ceil(Math.max(tw, sw) + 4), h = 34 + sub.length * 16 + 2;
  const c = createCanvas(w * S, h * S), x = c.getContext('2d');
  x.scale(S, S);
  x.fillStyle = '#ffffff'; x.font = '32px Cond'; x.fillText(title, 0, 29);
  x.fillStyle = '#8b949e'; x.font = '12px Mono';
  sub.forEach((s, i) => x.fillText(s, 1, 47 + i * 16));
  fs.writeFileSync(path.join(DIR, `${name}.png`), c.toBuffer('image/png'));
  meta[name] = { w, h };
  console.log(name, `${w}x${h}`);
}
fs.writeFileSync(path.join(DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
