// Партия в README: гости играют белыми через issue «chess|move|e2e4», Stockfish сразу отвечает за чёрных.
//   node chess/game.mjs            — обработать ход (env: ISSUE_TITLE, ISSUE_USER), запускается из GitHub Actions
//   node chess/game.mjs --render   — перерисовать доску и README из текущего состояния
//   node chess/game.mjs --reset    — начать всё с нуля
// Результат: chess/state.json, chess/board-*.webp, секция README между <!-- chess:start/end -->,
// текст ответа в chess/.comment.md и outputs result=ok|rejected, move=… для workflow.
import { Chess } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBoard } from './board.mjs';
import { engineMove, evaluate } from './engine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'chess');
const STATE_FILE = path.join(DIR, 'state.json');
const README = path.join(ROOT, 'README.md');
const COMMENT = path.join(DIR, '.comment.md');
const REPO = process.env.GITHUB_REPOSITORY || '2md55nmxkw-arch/2md55nmxkw-arch';
const PROFILE = `https://github.com/${REPO.split('/')[0]}`;
const PREFIX = 'chess|move|';
const ENGINE = 'stockfish';

const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const glyph = t => GLYPH[t] + '︎'; // текстовое начертание, а не эмодзи
const who = u => (u === ENGINE ? ENGINE : `<a href="https://github.com/${u}">@${u}</a>`);
const whoMd = u => (u === ENGINE ? ENGINE : `[@${u}](https://github.com/${u})`);

const output = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const reply = md => fs.writeFileSync(COMMENT, md);
const load = () => ({ recent: [], ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) });
const save = s => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
const fresh = (game = 1, keep = {}) => ({
  game, fen: new Chess().fen(), moves: [], last: null, eval: { cp: 20 },
  players: keep.players ?? {}, recent: keep.recent ?? [], games: keep.games ?? [], notice: keep.notice ?? null, finalImg: keep.finalImg ?? null,
});

const moveUrl = uci => `https://github.com/${REPO}/issues/new?` + new URLSearchParams({
  title: PREFIX + uci,
  body: 'Just press **Create**, stockfish answers and the board on the profile updates in about a minute.\n\nPlease don\'t change the title.',
});
const kingInCheck = chess => (chess.inCheck() ? chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn()).square : null);
const toWhite = (score, turn) => (score ? (turn === 'w' ? score : { cp: score.cp !== undefined ? -score.cp : undefined, mate: score.mate !== undefined ? -score.mate : undefined }) : null);

// ───────── README ─────────
function section(state, chess, img) {
  const a = (href, t, title) => `<a href="${href}"${title ? ` title="${title}"` : ''}>${t}</a>`;
  const R = ['<h3>YOUR MOVE.</h3>', '<sub>you play white vs stockfish · click a move, then <b>Create</b></sub><br>'];

  // последний обмен ходами (или итог прошлой партии)
  const [mine, theirs] = state.moves.slice(-2);
  if (theirs?.by === ENGINE) R.push(`<sub>${who(mine.by)} <code>${mine.san}</code> → stockfish <code>${theirs.san}</code>${chess.inCheck() ? ' · check' : ''}</sub><br>`);
  else if (state.notice) R.push(`<sub>${state.notice}</sub><br>`);
  R.push('<br>');

  // ходы — одна строка на тип фигуры, в нотации (Nf6, exd5, O-O)
  const order = 'kqrbnp', byType = new Map();
  for (const m of chess.moves({ verbose: true })) {
    if (!byType.has(m.piece)) byType.set(m.piece, []);
    byType.get(m.piece).push(m);
  }
  for (const [t, ms] of [...byType.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]))) {
    ms.sort((p, q) => p.to.localeCompare(q.to) || p.from.localeCompare(q.from));
    R.push(`${glyph(t)}&nbsp; ${ms.map(m => a(moveUrl(m.from + m.to + (m.promotion ?? '')), m.san)).join(' ')}<br>`);
  }
  // аватарки тех, кто играл (последние сверху)
  if (state.recent.length) {
    R.push('<br>' + state.recent.slice(0, 10).map(u =>
      a(`https://github.com/${u}`, `<img src="https://github.com/${u}.png?size=64" width="26" height="26" alt="@${u}">`, `@${u}`)).join(' '));
  }

  const L = ['<!-- chess:start -->', '<table align="center"><tr>',
    `<td><img src="chess/${img}" width="400" alt="Chess board, game ${state.game}. Position (FEN): ${state.fen}"></td>`,
    `<td valign="top" width="300">\n${R.join('\n')}\n</td>`, '</tr></table>', ''];

  // история — свёрнута, чтобы не шуметь
  const D = [];
  if (state.moves.length) {
    D.push('| # | move | by |', '| --: | :-- | :-- |');
    for (const m of state.moves.slice(-10).reverse()) D.push(`| ${Math.ceil(m.n / 2)}${m.n % 2 ? '.' : '…'} | \`${m.san}\` | ${whoMd(m.by)} |`);
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
  if (D.length) L.push('<div align="center"><details><summary><sub>history</sub></summary>', '', ...D, '</details></div>');
  L.push('<!-- chess:end -->');
  return L.join('\n');
}

function updateReadme(block) {
  let md = fs.readFileSync(README, 'utf8');
  const re = /<!-- chess:start -->[\s\S]*?<!-- chess:end -->/;
  if (re.test(md)) md = md.replace(re, block);
  else md = md.includes('</picture>') ? md.replace('</picture>', `</picture>\n\n${block}\n`) : `${md.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(README, md);
}

async function publish(state) {
  const chess = new Chess(state.fen);
  for (const f of fs.readdirSync(DIR)) if (/^board-.*\.webp$/.test(f)) fs.unlinkSync(path.join(DIR, f));
  const img = `board-${state.game}-${state.moves.length}.webp`; // новое имя на каждый ход — мимо кеша картинок
  fs.writeFileSync(path.join(DIR, img), await renderBoard({ board: chess.board(), last: state.last, check: kingInCheck(chess), score: state.eval }));
  save(state);
  updateReadme(section(state, chess, img));
}

// ───────── ходы ─────────
function apply(state, chess, mv, by) {
  state.fen = chess.fen();
  state.moves.push({ n: state.moves.length + 1, san: mv.san, uci: mv.from + mv.to + (mv.promotion ?? ''), by, at: new Date().toISOString() });
  state.last = { from: mv.from, to: mv.to };
}
async function finish(state, chess, mv, by) {
  const result = chess.isCheckmate() ? (mv.color === 'w' ? '1-0' : '0-1') : '½-½';
  const reason = chess.isCheckmate() ? 'checkmate' : chess.isStalemate() ? 'stalemate'
    : chess.isThreefoldRepetition() ? 'threefold repetition' : chess.isInsufficientMaterial() ? 'insufficient material' : '50-move rule';
  for (const f of fs.readdirSync(DIR)) if (/^final-.*\.webp$/.test(f)) fs.unlinkSync(path.join(DIR, f));
  const finalImg = `final-${state.game}.webp`;
  const mateScore = chess.isCheckmate() ? { mate: mv.color === 'w' ? 1 : -1 } : { cp: 0 };
  fs.writeFileSync(path.join(DIR, finalImg), await renderBoard({ board: chess.board(), last: state.last, check: kingInCheck(chess), score: mateScore }));
  const games = [{ game: state.game, result, reason, plies: state.moves.length, final: mv.san, by, at: new Date().toISOString() }, ...state.games];
  const notice = result === '1-0' ? `game ${state.game}: ${who(by)} checkmated stockfish 👑` : result === '0-1' ? `game ${state.game}: stockfish won · new game` : `game ${state.game}: draw by ${reason}`;
  Object.assign(state, fresh(state.game + 1, { players: state.players, recent: state.recent, games, notice, finalImg }));
  return `🏁 Game ${games[0].game} is over: **${result}** by ${reason}. A new game has started.`;
}
async function engineReply(state, chess) {
  const { move } = await engineMove(chess.fen());
  const mv = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
  apply(state, chess, mv, ENGINE);
  return mv;
}

function reject(msg) {
  reply(`❌ ${msg}\n\nPick a move on the [board](${PROFILE}) and try again.`);
  output('result', 'rejected');
  console.log('rejected:', msg);
}

async function play() {
  const title = (process.env.ISSUE_TITLE ?? '').trim();
  const user = (process.env.ISSUE_USER ?? '').trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(user) || user === ENGINE) return reject('Unknown player.');
  const m = /^chess\|move\|([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(title);
  if (!m) return reject('Couldn\'t read a move from the issue title. It should look like `chess|move|e2e4`.');
  const [, from, to, promo] = m.map(v => v?.toLowerCase());

  const state = load();
  const chess = new Chess(state.fen);
  if (chess.turn() === 'b') await engineReply(state, chess); // на всякий случай: движок не успел ответить раньше

  let mv;
  try { mv = chess.move({ from, to, promotion: promo }); } catch { mv = null; }
  if (!mv) return reject(`\`${from}${to}${promo ?? ''}\` isn't a legal move in the current position. Someone may have moved right before you.`);

  apply(state, chess, mv, user);
  state.players[user] = (state.players[user] ?? 0) + 1;
  state.recent = [user, ...state.recent.filter(u => u !== user)].slice(0, 12);
  state.notice = null;

  let text = `♟ You played \`${mv.san}\`.`, summary = mv.san;
  if (chess.isGameOver()) text += `\n\n${await finish(state, chess, mv, user)}`;
  else {
    const r = await engineReply(state, chess);
    text += ` stockfish answered \`${r.san}\`.`;
    summary += `, stockfish ${r.san}`;
    if (chess.isGameOver()) text += `\n\n${await finish(state, chess, r, ENGINE)}`;
    else state.eval = toWhite(await evaluate(chess.fen()), chess.turn());
  }

  await publish(state);
  reply(`${text}\n\nYour move again on the [board](${PROFILE}). The image may take a minute to refresh.`);
  output('result', 'ok');
  output('move', summary);
  console.log('played', summary, 'by', user);
}

const arg = process.argv[2];
if (arg === '--reset') {
  await publish(fresh());
  console.log('new game, state reset');
} else if (arg === '--render') {
  const state = load(), chess = new Chess(state.fen);
  if (chess.turn() === 'b' && !chess.isGameOver()) await engineReply(state, chess); // догнать позицию после смены режима
  state.eval = toWhite(await evaluate(chess.fen()), chess.turn());
  await publish(state);
  console.log('re-rendered');
} else {
  await play();
}
