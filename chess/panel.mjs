// Панель справа от доски — в стиле самого GitHub: один скруглённый бокс, четыре квадратные ячейки вплотную
//   счёт против Stockfish · проекты-фигуры · коммиты за 64 дня · языки
// Это SVG, а не растр: текст рисует браузер тем же системным шрифтом, что и интерфейс GitHub, цвета — из палитры
// GitHub (Primer), точки языков и клеточки активности — как на страницах репозитория и профиля.
// Шрифтов и canvas не нужно, поэтому одинаково собирается локально и в GitHub Actions. Два файла: тёмный и светлый.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { lightName } from './theme.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = f => (fs.existsSync(path.join(DIR, f)) ? JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) : null);

const FONT = '-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Noto Sans\',Helvetica,Arial,sans-serif';
const UI = {
  dark: { fg: '#e6edf3', muted: '#8d96a0', border: '#30363d', accent: '#4493f8', success: '#3fb950', ring: 'rgba(240,246,252,0.2)',
    cal: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
  light: { fg: '#1f2328', muted: '#656d76', border: '#d0d7de', accent: '#0969da', success: '#1a7f37', ring: 'rgba(31,35,40,0.2)',
    cal: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] },
};
// Геометрия. Панель той же высоты, что картинка доски, а бокс совпадает по высоте с её клетками:
// у доски 26 px поля при высоте 772, здесь 13.5 при 404 — поэтому ячейка равна четырём клеткам доски.
const C = 188.5, PAD = 14, TOP = 13.5, W = C * 2 + 1, H = C * 2 + TOP * 2;
const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const n1 = v => Number(v.toFixed(1));

export function scoreSummary(state) {
  const games = state.games ?? [], players = Object.entries(state.players ?? {});
  return {
    won: games.filter(g => g.result === '1-0').length,   // гости играют белыми
    lost: games.filter(g => g.result === '0-1').length,
    drawn: games.filter(g => g.result !== '1-0' && g.result !== '0-1').length,
    moves: players.reduce((s, [, n]) => s + n, 0), players: players.length,
    game: state.game, hall: (state.hall ?? []).map(h => h.user),
  };
}
// уровень клеточки активности, как в календаре контрибуций
const level = n => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : 4);

export function renderPanel({ state, activity, profile }, theme = 'dark') {
  const T = UI[theme], out = [];
  const text = (x, y, s, { size = 12, fill = T.fg, weight = 400, anchor = 'start' } = {}) =>
    out.push(`<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" fill="${fill}"${weight !== 400 ? ` font-weight="${weight}"` : ''}${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`);
  const head = (x, y, title, meta) => { text(x + PAD, y + 26, title, { weight: 600 }); if (meta) text(x + C - PAD, y + 26, meta, { size: 11, fill: T.muted, anchor: 'end' }); };
  const row = (x, y, k, v, fill = T.fg) => { text(x + PAD, y, k, { size: 11.5, fill: T.muted }); text(x + C - PAD, y, v, { size: 11.5, fill, anchor: 'end' }); };

  { // ── счёт ──
    const x = 0.5, y = TOP, s = scoreSummary(state);
    head(x, y, 'Score vs stockfish', `game ${s.game}`);
    [['won', s.won, s.won ? T.success : T.fg], ['drawn', s.drawn, T.fg], ['lost', s.lost, T.fg]].forEach(([label, n, fill], i) => {
      const cx = x + (C * (i * 2 + 1)) / 6;
      text(cx, y + 74, n, { size: 26, weight: 600, fill, anchor: 'middle' });
      text(cx, y + 92, label, { size: 11, fill: T.muted, anchor: 'middle' });
    });
    out.push(`<path d="M${x + PAD} ${y + 108.5}H${x + C - PAD}" stroke="${T.border}"/>`);
    row(x, y + 130, 'moves', s.moves);
    row(x, y + 150, 'players', s.players);
    row(x, y + 170, 'hall of mate', s.hall.length ? clip('@' + s.hall[0], 14) + (s.hall.length > 1 ? ` +${s.hall.length - 1}` : '') : 'nobody yet', s.hall.length ? T.fg : T.muted);
  }
  { // ── проекты как фигуры ──
    const x = 0.5 + C, y = TOP, list = (profile?.projects ?? []).slice(0, 6);
    head(x, y, 'Pieces on the board', list.length ? `★ ${list.reduce((s, p) => s + p.stars, 0)}` : '');
    const step = list.length > 5 ? 24 : 26;
    list.forEach((p, i) => {
      const ry = y + 54 + i * step;
      text(x + PAD, ry, GLYPH[p.piece], { size: 13, fill: T.muted });
      text(x + PAD + 19, ry, clip(p.name, 16), { size: 11.5, fill: T.accent });
      text(x + C - PAD, ry, `★ ${p.stars}`, { size: 11, fill: T.muted, anchor: 'end' });
    });
    if (!list.length) text(x + PAD, y + 54, 'no public repositories yet', { size: 11.5, fill: T.muted });
  }
  { // ── коммиты: 64 дня, a1 — самый старый, h8 — сегодня ──
    const x = 0.5, y = TOP + C, days = activity?.days ?? [];
    head(x, y, 'Every commit is a move');
    text(x + PAD, y + 43, `${activity?.total ?? 0} contributions · last ${days.length || 64} days`, { size: 11, fill: T.muted });
    const s = 13, gap = 3, ox = x + (C - (s * 8 + gap * 7)) / 2, oy = y + 55;
    for (let i = 0; i < 64; i++) {
      const cx = ox + (i % 8) * (s + gap), cy = oy + (7 - Math.floor(i / 8)) * (s + gap), today = i === days.length - 1;
      out.push(`<rect x="${n1(cx)}" y="${n1(cy)}" width="${s}" height="${s}" rx="2.5" fill="${T.cal[level(days[i] ?? 0)]}"${today ? ` stroke="${T.fg}" stroke-width="1.2"` : ''}/>`);
    }
  }
  { // ── языки ──
    const x = 0.5 + C, y = TOP + C, list = (profile?.material ?? []).slice(0, 6), full = C - PAD * 2, gap = 2;
    head(x, y, 'Material', 'by code size');
    out.push(`<clipPath id="bar"><rect x="${x + PAD}" y="${y + 40}" width="${full}" height="8" rx="4"/></clipPath><g clip-path="url(#bar)">`);
    let bx = x + PAD;
    list.forEach((it, i) => {
      const w = i === list.length - 1 ? x + C - PAD - bx : Math.max(3, ((full - gap * (list.length - 1)) * it.pct) / 100);
      out.push(`<rect x="${n1(bx)}" y="${y + 40}" width="${n1(w)}" height="8" fill="${it.color}"/>`);
      bx += w + gap;
    });
    out.push('</g>');
    list.forEach((it, i) => {
      const ry = y + 74 + i * 20;
      out.push(`<circle cx="${x + PAD + 4.5}" cy="${ry - 4}" r="4.5" fill="${it.color}" stroke="${T.ring}"/>`);
      text(x + PAD + 16, ry, clip(it.name, 16));
      text(x + C - PAD, ry, `${it.pct}%`, { size: 11.5, fill: T.muted, anchor: 'end' });
    });
  }
  const mid = TOP + C;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
<rect x="0.5" y="${TOP}" width="${C * 2}" height="${C * 2}" rx="6" fill="none" stroke="${T.border}"/>
<path d="M${0.5 + C} ${TOP}V${TOP + C * 2}M0.5 ${mid}H${0.5 + C * 2}" stroke="${T.border}"/>
${out.join('\n')}
</svg>
`;
}

// Записать панель в обеих темах; имя меняется вместе с содержимым — мимо кеша GitHub и браузеров.
export function writePanel(state) {
  const data = { state, activity: read('activity.json'), profile: read('profile.json') };
  for (const f of fs.readdirSync(DIR)) if (/^panel-.*\.svg$/.test(f)) fs.unlinkSync(path.join(DIR, f));
  const dark = renderPanel(data, 'dark'), img = `panel-${createHash('sha1').update(dark).digest('hex').slice(0, 6)}.svg`;
  fs.writeFileSync(path.join(DIR, img), dark);
  fs.writeFileSync(path.join(DIR, lightName(img)), renderPanel(data, 'light'));
  fs.writeFileSync(path.join(DIR, 'panel.json'), JSON.stringify({ img }, null, 2) + '\n');
  return img;
}
