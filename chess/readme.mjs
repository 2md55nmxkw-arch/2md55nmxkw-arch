// Сборка секции README между <!-- chess:start --> и <!-- chess:end -->: одна ровная сетка 2×2
//   [доска + шкала]      | YOUR MOVE · последний обмен · ходы · аватарки
//   [доска из коммитов]  | зал славы
// и свёрнутая история под ней.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGE } from './badges.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README = path.join(ROOT, 'README.md');
const ACTIVITY = path.join(ROOT, 'chess', 'activity.json');
export const REPO = process.env.GITHUB_REPOSITORY || '2md55nmxkw-arch/2md55nmxkw-arch';
export const ENGINE = 'stockfish';

const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const glyph = t => GLYPH[t] + '︎'; // текстовое начертание, а не эмодзи
const a = (href, t, title) => `<a href="${href}"${title ? ` title="${title}"` : ''}>${t}</a>`;
export const who = u => (u === ENGINE ? ENGINE : a(`https://github.com/${u}`, '@' + u));
const whoMd = u => (u === ENGINE ? ENGINE : `[@${u}](https://github.com/${u})`);
const icon = (cls, size = 14) => (BADGE[cls] ? `<img src="chess/icons/${cls}.png" width="${size}" height="${size}" alt="${cls}" title="${BADGE[cls].text}">` : '');

export const moveUrl = uci => `https://github.com/${REPO}/issues/new?` + new URLSearchParams({
  title: 'chess|move|' + uci,
  body: 'Just press **Create**, stockfish answers and the board on the profile updates in about a minute.\n\nPlease don\'t change the title.',
});

function playCell(state, chess) {
  const R = ['<h3>YOUR MOVE.</h3>', '<sub>you play white vs stockfish · click a move, then <b>Create</b></sub><br>'];
  const [mine, theirs] = state.moves.slice(-2);
  const tag = m => `<code>${m.san}</code> ${icon(m.cls)} ${m.cls ?? ''}`;
  if (theirs?.by === ENGINE && mine) R.push(`<sub>${who(mine.by)} ${tag(mine)} · stockfish ${tag(theirs)}${chess.inCheck() ? ' · check' : ''}</sub><br>`);
  else if (state.notice) R.push(`<sub>${state.notice}</sub><br>`);
  R.push('<br>');
  const order = 'kqrbnp', byType = new Map();
  for (const m of chess.moves({ verbose: true })) {
    if (!byType.has(m.piece)) byType.set(m.piece, []);
    byType.get(m.piece).push(m);
  }
  for (const [t, ms] of [...byType.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]))) {
    ms.sort((p, q) => p.to.localeCompare(q.to) || p.from.localeCompare(q.from));
    R.push(`${glyph(t)}&nbsp; ${ms.map(m => a(moveUrl(m.from + m.to + (m.promotion ?? '')), m.san)).join(' ')}<br>`);
  }
  if (state.recent?.length) {
    R.push('<br>' + state.recent.slice(0, 10).map(u =>
      a(`https://github.com/${u}`, `<img src="https://github.com/${u}.png?size=64" width="26" height="26" alt="@${u}">`, `@${u}`)).join(' '));
  }
  return R.join('\n');
}

function hallCell(state) {
  const hall = state.hall ?? [];
  if (!hall.length) return '<img src="chess/hall/empty.webp" width="300" alt="Hall of mate: nobody has checkmated stockfish yet">';
  return hall.slice(0, 2).map(h => a(`https://github.com/${h.user}`,
    `<img src="chess/hall/${h.img}" width="300" alt="@${h.user} checkmated stockfish in game ${h.game}">`, `@${h.user}`)).join('<br>\n');
}

function activityCell() {
  if (!fs.existsSync(ACTIVITY)) return '';
  const act = JSON.parse(fs.readFileSync(ACTIVITY, 'utf8'));
  return `<img src="chess/${act.img}" width="300" alt="Last 64 days of GitHub activity as a chessboard: ${act.total} contributions"><br>\n<sub>last 64 days · every commit is a move</sub>`;
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
    if (state.finalImg) D.push(`<img src="chess/${state.finalImg}" width="300" alt="Final position of game ${state.games[0].game}">`, '');
    D.push('| game | result | final move |', '| :-: | :-- | :-- |');
    for (const g of state.games.slice(0, 5)) D.push(`| ${g.game} | ${g.result} · ${g.reason} | \`${g.final}\` by ${whoMd(g.by)} |`);
    D.push('');
  }
  return D.length ? ['<div align="center"><details><summary><sub>history</sub></summary>', '', ...D, '</details></div>'] : [];
}

export function writeReadme(state, chess) {
  const act = activityCell();
  const L = ['<!-- chess:start -->', '<table align="center">',
    '<tr>',
    `<td align="center"><img src="chess/${state.img}" width="400" alt="Chess board, game ${state.game}. Position (FEN): ${state.fen}"></td>`,
    `<td valign="top" width="300">\n${playCell(state, chess)}\n</td>`,
    '</tr>',
    '<tr>',
    `<td align="center" valign="top">\n${act}\n</td>`,
    `<td align="center" valign="top">\n${hallCell(state)}\n</td>`,
    '</tr>',
    '</table>', '', ...history(state), '<!-- chess:end -->'];
  const block = L.join('\n');
  let md = fs.readFileSync(README, 'utf8');
  const re = /<!-- chess:start -->[\s\S]*?<!-- chess:end -->/;
  md = re.test(md) ? md.replace(re, block) : md.replace('</picture>', `</picture>\n\n${block}\n`);
  fs.writeFileSync(README, md);
}
