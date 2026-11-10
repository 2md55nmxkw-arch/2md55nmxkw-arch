// Архив законченных партий и вторая страница — «зал партий»:
//   games/games.json   все партии с ходами и оценками (дописывается в конце каждой партии)
//   games/game-N.webp  финальная позиция в тёмной и светлой теме
//   games/README.md    лучшие партии сверху, блестящие ходы, рекорды, таблица всех партий
// Страница — обычный Markdown в стиле GitHub; на неё ведёт ссылка из README профиля.
//   node chess/archive.mjs  — перегенерировать страницу из games.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGE } from './badges.mjs';
import { lightName } from './theme.mjs';
import { REPO, ENGINE } from './readme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = path.join(ROOT, 'games');
const FILE = path.join(GAMES_DIR, 'games.json');
const CARDS = 10; // столько партий показывается целиком, остальные — только строкой в таблице

const GLYPH = { brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', blunder: '??' }; // как в шахматной нотации
const ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder', 'forced'];
const who = u => (u === ENGINE ? ENGINE : `[@${u}](https://github.com/${u})`);
const icon = cls => `<img src="../chess/icons/${cls}.png" width="14" height="14" alt="${BADGE[cls]?.text ?? cls}" title="${BADGE[cls]?.text ?? cls}">`;
const pic = (src, attrs) => `<picture><source media="(prefers-color-scheme: dark)" srcset="${src}"><source media="(prefers-color-scheme: light)" srcset="${lightName(src)}"><img src="${src}" ${attrs}></picture>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const loadGames = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : []);

// сводка по партии: ходы людей (белые), их оценки и кто сколько сыграл
function stats(g) {
  const mine = g.moves.map((m, i) => ({ ...m, no: Math.floor(i / 2) + 1 })).filter(m => m.by !== ENGINE);
  const tally = {}, players = {};
  for (const m of mine) { tally[m.cls] = (tally[m.cls] ?? 0) + 1; players[m.by] = (players[m.by] ?? 0) + 1; }
  return { mine, tally, players, brilliant: tally.brilliant ?? 0, great: tally.great ?? 0, moves: Math.ceil(g.moves.length / 2), won: g.result === '1-0' };
}
// лучшие сверху: победа над движком, больше блестящих и сильных ходов, короче, новее
const rank = (a, b) => Number(b.s.won) - Number(a.s.won) || b.s.brilliant - a.s.brilliant || b.s.great - a.s.great || a.g.plies - b.g.plies || b.g.game - a.g.game;

function movetext(g) {
  const text = g.moves.map((m, i) => {
    const t = `${i % 2 ? '' : `${i / 2 + 1}. `}${m.san}${GLYPH[m.cls] ?? ''}`;
    return m.cls === 'brilliant' && m.by !== ENGINE ? `**${t}**` : t;
  }).join(' ');
  return `${text.replace(/^(\d+)\./, '$1\\.')} ${g.result}`; // «1.» в начале строки Markdown принял бы за список
}
const outcome = (g, s) => (g.reason === 'checkmate' ? `checkmate on move ${s.moves}` : `${g.reason} after ${plural(s.moves, 'move')}`);

function card({ g, s }) {
  const white = Object.entries(s.players).sort((x, y) => y[1] - x[1]).map(([u, n]) => `${who(u)} (${n})`).join(', ');
  const tally = ORDER.filter(c => s.tally[c]).map(c => `${icon(c)} ${s.tally[c]}`).join(' · ');
  return [
    `### Game ${g.game}`, '',
    `**${g.result}** · ${outcome(g, s)} · White: ${white} · Black: ${ENGINE} · ${g.at.slice(0, 10)}`, '',
    tally, '',
    pic(`game-${g.game}.webp`, `width="340" alt="Final position of game ${g.game}"`), '',
    movetext(g), '',
  ];
}

export function writeGamesPage() {
  const all = loadGames().map(g => ({ g, s: stats(g) }));
  if (!all.length) return;
  const ranked = [...all].sort(rank), shown = new Set(ranked.slice(0, CARDS).map(x => x.g.game));
  const link = n => (shown.has(n) ? `[${n}](#game-${n})` : String(n));
  const owner = REPO.split('/')[0];
  const L = [
    '# Hall of games', '',
    `Finished games of the open chess game on [@${owner}'s profile](https://github.com/${owner}): visitors play White by opening an issue, ${ENGINE} answers for Black, and every move is graded the way chess.com does it. Best games first.`, '',
  ];

  // рекорды
  const wins = all.filter(x => x.s.won);
  const top = (list, f) => list.reduce((a, b) => (f(b) > f(a) ? b : a));
  const R = [];
  if (all.some(x => x.s.brilliant)) { const x = top(all, y => y.s.brilliant); R.push(`| most brilliant moves | ${link(x.g.game)} | ${icon('brilliant')} ${x.s.brilliant} |`); }
  if (wins.length) { const x = top(wins, y => -y.g.plies); R.push(`| fastest mate | ${link(x.g.game)} | ${plural(x.s.moves, 'move')} |`); }
  if (all.length > 1) { const x = top(all, y => y.g.plies); R.push(`| longest game | ${link(x.g.game)} | ${plural(x.s.moves, 'move')} |`); }
  if (R.length) L.push('| record | game | |', '| :-- | :-: | :-- |', ...R, '');

  // блестящие ходы людей по партиям
  const brill = ranked.filter(x => x.s.brilliant);
  if (brill.length) {
    L.push('## Brilliant moves', '', '| game | moves | by |', '| :-: | :-- | :-- |');
    for (const { g, s } of brill) {
      const ms = s.mine.filter(m => m.cls === 'brilliant');
      L.push(`| ${link(g.game)} | ${ms.map(m => `\`${m.no}. ${m.san}\``).join(' ')} | ${[...new Set(ms.map(m => m.by))].map(who).join(', ')} |`);
    }
    L.push('');
  }

  L.push('## Best games', '');
  for (const x of ranked.slice(0, CARDS)) L.push(...card(x));

  L.push('## All games', '', '| game | result | moves | !! | white | date |', '| :-: | :-- | --: | --: | :-- | :-- |');
  for (const { g, s } of [...all].sort((a, b) => b.g.game - a.g.game)) {
    L.push(`| ${link(g.game)} | ${g.result} · ${g.reason} | ${s.moves} | ${s.brilliant || ''} | ${Object.keys(s.players).map(who).join(', ')} | ${g.at.slice(0, 10)} |`);
  }
  L.push('');
  fs.writeFileSync(path.join(GAMES_DIR, 'README.md'), L.join('\n'));
}

/** entry: { game, result, reason, plies, final, by, at, moves: [{ san, by, cls }] }; images: { dark, light } — буферы картинок */
export function archiveGame(entry, images) {
  fs.mkdirSync(GAMES_DIR, { recursive: true });
  const file = `game-${entry.game}.webp`;
  fs.writeFileSync(path.join(GAMES_DIR, file), images.dark);
  fs.writeFileSync(path.join(GAMES_DIR, lightName(file)), images.light);
  const games = loadGames().filter(g => g.game !== entry.game);
  games.push(entry);
  games.sort((a, b) => a.game - b.game);
  fs.writeFileSync(FILE, JSON.stringify(games) + '\n');
  writeGamesPage();
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) { writeGamesPage(); console.log('games/README.md re-rendered'); }
