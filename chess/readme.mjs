// Сборка секции README между <!-- chess:start --> и <!-- chess:end --> — компактно и в стиле самого GitHub:
//   пара строк о себе и ссылки
//   [доска с партией][панель: счёт · проекты · коммиты · языки] — две картинки вплотную, одной высоты
//   «Your move» и ходы обычным текстом, проекты ссылками, свёрнутая история
// Обе картинки — в двух темах: <picture> отдаёт файл с суффиксом -light при светлой теме.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGE } from './badges.mjs';
import { lightName } from './theme.mjs';
import { scoreSummary } from './panel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README = path.join(ROOT, 'README.md');
const read = f => { const p = path.join(ROOT, 'chess', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
export const REPO = process.env.GITHUB_REPOSITORY || '2md55nmxkw-arch/2md55nmxkw-arch';
export const ENGINE = 'stockfish';
// вторая страница: архив партий, лучшие партии и блестящие ходы (её пишет chess/archive.mjs)
export const GAMES_URL = `https://github.com/${REPO}/blob/main/games/README.md`;

const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const glyph = t => GLYPH[t] + '︎'; // текстовое начертание, а не эмодзи
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const a = (href, t, title) => `<a href="${href}"${title ? ` title="${title}"` : ''}>${t}</a>`;
export const who = u => (u === ENGINE ? ENGINE : a(`https://github.com/${u}`, '@' + u));
const whoMd = u => (u === ENGINE ? ENGINE : `[@${u}](https://github.com/${u})`);
const icon = (cls, size = 14) => (BADGE[cls] ? `<img src="chess/icons/${cls}.png" width="${size}" height="${size}" alt="${cls}" title="${BADGE[cls].text}">` : '');
// картинка в двух темах, как в документации GitHub: источник на каждую тему и <img> по умолчанию (тёмный);
// светлый файл лежит рядом с суффиксом -light
const pic = (src, attrs) => `<picture><source media="(prefers-color-scheme: dark)" srcset="${src}"><source media="(prefers-color-scheme: light)" srcset="${lightName(src)}"><img src="${src}" ${attrs}></picture>`;

export const moveUrl = uci => `https://github.com/${REPO}/issues/new?` + new URLSearchParams({
  title: 'chess|move|' + uci,
  body: 'Just press **Create**, stockfish answers and the board on the profile updates in about a minute.\n\nPlease don\'t change the title.',
});

// пара строк о себе и ссылки (chess/about.json, правится руками)
function aboutBlock() {
  const A = read('about.json');
  if (!A?.about?.length) return [];
  const L = [A.about.join('<br>\n'), ''];
  if (A.links?.length) L.push(`${glyph('p')}&nbsp; ${A.links.map(l => a(l.url, l.label)).join(' · ')}`, '');
  return L;
}

// доска и панель одной высоты: ширины подобраны по пропорциям картинок (816×772 и 378×404), между тегами нет пробела
function boardRow(state, prof, act) {
  const panel = read('panel.json'), s = scoreSummary(state);
  const board = pic(`chess/${state.img}`, `width="${panel ? '53%' : '400'}" alt="Chess board, game ${state.game}. Position (FEN): ${state.fen}"`);
  if (!panel) return [board, ''];
  const alt = [`Score vs stockfish: ${s.won} won, ${s.drawn} drawn, ${s.lost} lost; ${s.moves} moves by ${s.players} ${s.players === 1 ? 'player' : 'players'}.`,
    prof?.projects?.length ? `Pieces on the board: ${prof.projects.map(p => `${p.name} (${p.stars} stars)`).join(', ')}.` : '',
    act ? `Every commit is a move: ${act.total} contributions in the last ${act.days.length} days.` : '',
    prof?.material?.length ? `Material by code size: ${prof.material.map(m => `${m.name} ${m.pct}%`).join(', ')}.` : ''].filter(Boolean).join(' ');
  return [board + pic(`chess/${panel.img}`, `width="46.9%" alt="${attr(alt)}"`), ''];
}

function moves(state, chess) {
  const R = ['**Your move.** You play white vs stockfish: click a move, then press Create.', ''];
  const [mine, theirs] = state.moves.slice(-2);
  const tag = m => `<code>${m.san}</code> ${icon(m.cls)} ${m.cls ?? ''}`;
  if (theirs?.by === ENGINE && mine) R.push(`<sub>${who(mine.by)} ${tag(mine)} · stockfish ${tag(theirs)}${chess.inCheck() ? ' · check' : ''}</sub>`, '');
  else if (state.notice) R.push(`<sub>${state.notice}</sub>`, '');
  const order = 'kqrbnp', byType = new Map();
  for (const m of chess.moves({ verbose: true })) {
    if (!byType.has(m.piece)) byType.set(m.piece, []);
    byType.get(m.piece).push(m);
  }
  const lines = [...byType.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0])).map(([t, ms]) => {
    ms.sort((p, q) => p.to.localeCompare(q.to) || p.from.localeCompare(q.from));
    return `${glyph(t)}&nbsp; ${ms.map(m => a(moveUrl(m.from + m.to + (m.promotion ?? '')), m.san)).join(' ')}`;
  });
  R.push(lines.join('<br>\n'), '');
  const avatar = (u, size = 26) => a(`https://github.com/${u}`, `<img src="https://github.com/${u}.png?size=64" width="${size}" height="${size}" alt="@${u}">`, `@${u}`);
  if (state.recent?.length) R.push(state.recent.slice(0, 10).map(u => avatar(u)).join(' '), '');
  // зал славы — те, кто поставил мат движку: обычные аватарки и ссылки
  if (state.hall?.length) R.push(`<sub>Hall of mate: ${state.hall.slice(0, 5).map(h => `${avatar(h.user, 16)} ${who(h.user)} (game ${h.game})`).join(' · ')}</sub>`, '');
  // ссылка на вторую страницу — как только есть хоть одна законченная партия
  if (fs.existsSync(path.join(ROOT, 'games', 'games.json'))) R.push(`<sub>${glyph('q')} ${a(GAMES_URL, 'Hall of games')} · every finished game, best first, with all the brilliant moves</sub>`, '');
  return R;
}

function history(state) {
  const D = [];
  if (state.moves.length) {
    D.push('| # | move | | by |', '| --: | :-- | :-: | :-- |');
    for (const m of state.moves.slice(-12).reverse()) D.push(`| ${Math.ceil(m.n / 2)}${m.n % 2 ? '.' : '…'} | \`${m.san}\` | ${icon(m.cls)} | ${whoMd(m.by)} |`);
    D.push('');
  }
  const top = Object.entries(state.players).sort((x, y) => y[1] - x[1]).slice(0, 8);
  if (top.length) {
    D.push('| player | moves |', '| :-- | --: |');
    for (const [u, c] of top) D.push(`| ${whoMd(u)} | ${c} |`);
    D.push('');
  }
  if (state.games.length) {
    if (state.finalImg) D.push(pic(`chess/${state.finalImg}`, `width="300" alt="Final position of game ${state.games[0].game}"`), '');
    D.push('| game | result | final move |', '| :-: | :-- | :-- |');
    for (const g of state.games.slice(0, 5)) D.push(`| ${g.game} | ${g.result} · ${g.reason} | \`${g.final}\` by ${whoMd(g.by)} |`);
    D.push('');
  }
  return D.length ? ['<div align="center"><details><summary><sub>history</sub></summary>', '', ...D, '</details></div>'] : [];
}

export function writeReadme(state, chess) {
  const prof = read('profile.json'), act = read('activity.json');
  const L = ['<!-- chess:start -->', ...aboutBlock(), ...boardRow(state, prof, act), ...moves(state, chess)];
  // те же проекты ссылками — на картинке панели по ним не кликнуть
  if (prof?.projects?.length) L.push(`<sub>${prof.projects.map(p => `${glyph(p.piece)} ${a(p.url, attr(p.name))}`).join(' · ')}</sub>`, '');
  L.push(...history(state), '<!-- chess:end -->');
  const block = L.join('\n');
  let md = fs.readFileSync(README, 'utf8');
  const re = /<!-- chess:start -->[\s\S]*?<!-- chess:end -->/;
  md = re.test(md) ? md.replace(re, () => block) : md.replace('</picture>', () => `</picture>\n\n${block}\n`);
  fs.writeFileSync(README, md);
}
