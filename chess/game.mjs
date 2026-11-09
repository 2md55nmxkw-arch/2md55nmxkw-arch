// Открытая партия в README: любой гость делает ход через issue «chess|move|e2e4».
//   node chess/game.mjs            — обработать ход (env: ISSUE_TITLE, ISSUE_USER), запускается из GitHub Actions
//   node chess/game.mjs --reset    — начать всё с нуля
// Результат: chess/state.json, chess/board-*.webp, секция README между <!-- chess:start/end -->,
// текст ответа в chess/.comment.md и outputs result=ok|rejected, move=<SAN> для workflow.
import { Chess } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBoard } from './board.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'chess');
const STATE_FILE = path.join(DIR, 'state.json');
const README = path.join(ROOT, 'README.md');
const COMMENT = path.join(DIR, '.comment.md');
const REPO = process.env.GITHUB_REPOSITORY || '2md55nmxkw-arch/2md55nmxkw-arch';
const OWNER = REPO.split('/')[0];
const PROFILE = `https://github.com/${OWNER}`;
const PREFIX = 'chess|move|';

const GLYPH = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const glyph = (c, t) => GLYPH[c][t] + '︎'; // текстовое начертание, а не эмодзи
const side = c => (c === 'w' ? 'white' : 'black');
const userLink = u => `[@${u}](https://github.com/${u})`;

const output = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const reply = md => fs.writeFileSync(COMMENT, md);
const load = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const save = s => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
const fresh = (game = 1, games = [], players = {}, notice = null) => ({ game, fen: new Chess().fen(), moves: [], last: null, players, games, notice });

const moveUrl = uci => `https://github.com/${REPO}/issues/new?` + new URLSearchParams({
  title: PREFIX + uci,
  body: 'Just press **Create**, the board on the profile updates in about a minute.\n\nPlease don\'t change the title.',
});

function kingInCheck(chess) {
  if (!chess.inCheck()) return null;
  return chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn()).square;
}

// ───────── README ─────────
function section(state, chess, img) {
  const turn = chess.turn(), last = state.moves.at(-1);
  const a = (href, text) => `<a href="${href}">${text}</a>`;

  // правая колонка: статус и ходы — одна строка на тип фигуры, ссылки в нотации (Nf6, exd5, O-O)
  const R = [`<h3>YOUR MOVE.</h3>`, `<b>${side(turn)}</b> to move · move ${chess.moveNumber()}${chess.inCheck() ? ' · <b>check!</b>' : ''}<br>`];
  if (last) R.push(`<sub>last <code>${last.san}</code> by ${a(`https://github.com/${last.by}`, '@' + last.by)}</sub><br>`);
  if (state.notice) R.push(`<sub>${state.notice}</sub><br>`);
  R.push('<br>');
  const order = 'kqrbnp', byType = new Map();
  for (const m of chess.moves({ verbose: true })) {
    if (!byType.has(m.piece)) byType.set(m.piece, []);
    byType.get(m.piece).push(m);
  }
  for (const [t, ms] of [...byType.entries()].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]))) {
    ms.sort((p, q) => p.to.localeCompare(q.to) || p.from.localeCompare(q.from));
    R.push(`${glyph(turn, t)}&nbsp; ${ms.map(m => a(moveUrl(m.from + m.to + (m.promotion ?? '')), m.san)).join(' ')}<br>`);
  }
  R.push('<br><sub>click a move, press <b>Create</b> on the issue that opens, the board updates in about a minute. anyone can play.</sub>');

  const L = ['<!-- chess:start -->', '<table align="center"><tr>',
    `<td><img src="chess/${img}" width="380" alt="Chess board, game ${state.game}. Position (FEN): ${state.fen}"></td>`,
    `<td valign="top" width="320">\n${R.join('\n')}\n</td>`, '</tr></table>', ''];
  L.push('<details><summary>moves · players · past games</summary>', '');
  if (state.moves.length) {
    L.push('| # | move | by |', '| --: | :-- | :-- |');
    for (const m of state.moves.slice(-10).reverse()) L.push(`| ${Math.ceil(m.n / 2)}${m.n % 2 ? '.' : '…'} | \`${m.san}\` | ${userLink(m.by)} |`);
    L.push('');
  }
  const top = Object.entries(state.players).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) {
    L.push('| player | moves made |', '| :-- | --: |');
    for (const [u, c] of top) L.push(`| ${userLink(u)} | ${c} |`);
    L.push('');
  }
  if (state.games.length) {
    if (state.finalImg) L.push(`<p align="center"><img src="chess/${state.finalImg}" width="320" alt="Final position of game ${state.games[0].game}"></p>`, '');
    L.push('| game | result | plies | final move |', '| :-: | :-- | --: | :-- |');
    for (const g of state.games.slice(0, 5)) L.push(`| ${g.game} | ${g.result} · ${g.reason} | ${g.plies} | \`${g.final}\` by ${userLink(g.by)} |`);
    L.push('');
  }
  if (!state.moves.length && !top.length && !state.games.length) L.push('<sub>no moves yet, be the first.</sub>', '');
  L.push('</details>', '<!-- chess:end -->');
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
  fs.writeFileSync(path.join(DIR, img), await renderBoard({
    board: chess.board(), last: state.last, check: kingInCheck(chess), mate: false,
    label: `game ${state.game} · move ${chess.moveNumber()} · ${side(chess.turn())} to move`,
  }));
  save(state);
  updateReadme(section(state, chess, img));
}

// ───────── main ─────────
function reject(msg) {
  reply(`❌ ${msg}\n\nPick a move on the [board](${PROFILE}) and try again.`);
  output('result', 'rejected');
  console.log('rejected:', msg);
}

async function play() {
  const title = (process.env.ISSUE_TITLE ?? '').trim();
  const user = (process.env.ISSUE_USER ?? '').trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(user)) return reject('Unknown player.');
  const m = /^chess\|move\|([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(title);
  if (!m) return reject('Couldn\'t read a move from the issue title. It should look like `chess|move|e2e4`.');
  const [, from, to, promo] = m.map(v => v?.toLowerCase());

  const state = load();
  const chess = new Chess(state.fen);
  let mv;
  try { mv = chess.move({ from, to, promotion: promo }); } catch { mv = null; }
  if (!mv) return reject(`\`${from}${to}${promo ?? ''}\` isn't a legal move in the current position. Someone may have moved right before you.`);

  const n = state.moves.length + 1;
  state.fen = chess.fen();
  state.moves.push({ n, san: mv.san, uci: from + to + (promo ?? ''), by: user, at: new Date().toISOString() });
  state.last = { from, to };
  state.players[user] = (state.players[user] ?? 0) + 1;
  state.notice = null;
  let text = `♟ \`${mv.san}\` is on the board.` + (chess.isGameOver() ? '' : ` ${side(chess.turn())} to move next.`);

  if (chess.isGameOver()) {
    const result = chess.isCheckmate() ? (mv.color === 'w' ? '1-0' : '0-1') : '½-½';
    const reason = chess.isCheckmate() ? 'checkmate' : chess.isStalemate() ? 'stalemate'
      : chess.isThreefoldRepetition() ? 'threefold repetition' : chess.isInsufficientMaterial() ? 'insufficient material' : '50-move rule';
    // финальная позиция остаётся в истории
    for (const f of fs.readdirSync(DIR)) if (/^final-.*\.webp$/.test(f)) fs.unlinkSync(path.join(DIR, f));
    const finalImg = `final-${state.game}.webp`;
    fs.writeFileSync(path.join(DIR, finalImg), await renderBoard({
      board: chess.board(), last: state.last, check: kingInCheck(chess), mate: chess.isCheckmate(),
      label: `game ${state.game} · ${result} · ${reason}`,
    }));
    const games = [{ game: state.game, result, reason, plies: n, final: mv.san, by: user, at: new Date().toISOString() }, ...state.games];
    const next = fresh(state.game + 1, games, state.players,
      `game ${state.game} ended ${result} by ${reason}, final move <code>${mv.san}</code> by <a href="https://github.com/${user}">@${user}</a>. new game started.`);
    next.finalImg = finalImg;
    Object.assign(state, next);
    text += `\n\n🏁 That ends game ${games[0].game}: **${result}** by ${reason}. A new game has started.`;
  } else if (chess.inCheck()) text += ' Check!';

  await publish(state);
  reply(`${text}\n\nSee the [board](${PROFILE}). The image may take a minute to refresh.`);
  output('result', 'ok');
  output('move', mv.san);
  console.log('played', mv.san, 'by', user);
}

if (process.argv[2] === '--reset') {
  const state = fresh();
  await publish(state);
  console.log('new game, state reset');
} else if (process.argv[2] === '--render') { // перерисовать доску и README из текущего состояния
  await publish(load());
  console.log('re-rendered');
} else {
  await play();
}
