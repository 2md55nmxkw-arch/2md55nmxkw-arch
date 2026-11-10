// Партия в README: гости играют белыми через issue «chess|move|e2e4», Stockfish сразу отвечает за чёрных.
// Каждый ход разбирается движком и получает оценку как на chess.com (brilliant … blunder).
//   node chess/game.mjs            — обработать ход (env: ISSUE_TITLE, ISSUE_USER), запускается из GitHub Actions
//   node chess/game.mjs --render   — перерисовать доску и README из текущего состояния
//   node chess/game.mjs --reset    — начать всё с нуля
// Результат: chess/state.json, chess/board-*.webp и chess/panel-*.svg (в тёмной и светлой теме), секция README,
// в конце партии — запись в games/ (архив и страница «зал партий», см. chess/archive.mjs),
// текст ответа в chess/.comment.md и outputs result=ok|rejected, move=… для workflow.
import { Chess } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderBoard } from './board.mjs';
import { engineMove, analyse } from './engine.mjs';
import { classify } from './analysis.mjs';
import { BADGE } from './badges.mjs';
import { writePanel } from './panel.mjs';
import { lightName } from './theme.mjs';
import { writeReadme, who, ENGINE, REPO, GAMES_URL } from './readme.mjs';
import { archiveGame } from './archive.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'chess');
const STATE_FILE = path.join(DIR, 'state.json');
const COMMENT = path.join(DIR, '.comment.md');
const PROFILE = `https://github.com/${REPO.split('/')[0]}`;

const output = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const reply = md => fs.writeFileSync(COMMENT, md);
const load = () => ({ recent: [], hall: [], ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) });
const save = s => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
const fresh = (game = 1, keep = {}) => ({
  game, fen: new Chess().fen(), moves: [], last: null, eval: { cp: 20 }, img: null,
  players: keep.players ?? {}, recent: keep.recent ?? [], games: keep.games ?? [], hall: keep.hall ?? [],
  notice: keep.notice ?? null, finalImg: keep.finalImg ?? null,
});
const kingInCheck = chess => (chess.inCheck() ? chess.board().flat().find(p => p && p.type === 'k' && p.color === chess.turn()).square : null);
const clean = re => { for (const f of fs.readdirSync(DIR)) if (re.test(f)) fs.unlinkSync(path.join(DIR, f)); };
const label = cls => BADGE[cls]?.text ?? cls;

// значки на доске: последний ход и предыдущий, если фигура ещё стоит на своей клетке
function marks(state) {
  const [prev, last] = state.moves.slice(-2);
  const out = [];
  if (last?.cls) out.push({ square: last.to, cls: last.cls });
  if (prev?.cls && prev.to !== last?.to) out.push({ square: prev.to, cls: prev.cls });
  return out;
}

async function publish(state) {
  const chess = new Chess(state.fen);
  clean(/^board-.*\.webp$/);
  const view = { board: chess.board(), last: state.last, check: kingInCheck(chess), score: state.eval, marks: marks(state) };
  const buf = await renderBoard(view);
  // имя меняется вместе с содержимым картинки — мимо кеша GitHub и браузеров
  state.img = `board-${state.game}-${state.moves.length}-${createHash('sha1').update(buf).digest('hex').slice(0, 6)}.webp`;
  fs.writeFileSync(path.join(DIR, state.img), buf);
  fs.writeFileSync(path.join(DIR, lightName(state.img)), await renderBoard({ ...view, theme: 'light' }));
  writePanel(state); // счёт в панели меняется с каждым ходом
  save(state);
  writeReadme(state, chess);
}

// ───────── ходы ─────────
function apply(state, mv, by, cls) {
  state.moves.push({ n: state.moves.length + 1, san: mv.san, uci: mv.from + mv.to + (mv.promotion ?? ''), to: mv.to, by, cls, at: new Date().toISOString() });
  state.last = { from: mv.from, to: mv.to };
}
async function finish(state, chess, mv, by) {
  const result = chess.isCheckmate() ? (mv.color === 'w' ? '1-0' : '0-1') : '½-½';
  const reason = chess.isCheckmate() ? 'checkmate' : chess.isStalemate() ? 'stalemate'
    : chess.isThreefoldRepetition() ? 'threefold repetition' : chess.isInsufficientMaterial() ? 'insufficient material' : '50-move rule';
  clean(/^final-.*\.webp$/);
  const finalImg = `final-${state.game}.webp`;
  const view = {
    board: chess.board(), last: state.last, check: kingInCheck(chess), marks: marks(state),
    score: chess.isCheckmate() ? { mate: mv.color === 'w' ? 1 : -1 } : { cp: 0 },
  };
  const dark = await renderBoard(view), light = await renderBoard({ ...view, theme: 'light' });
  fs.writeFileSync(path.join(DIR, finalImg), dark);
  fs.writeFileSync(path.join(DIR, lightName(finalImg)), light);
  const summary = { game: state.game, result, reason, plies: state.moves.length, final: mv.san, by, at: new Date().toISOString() };
  // партия целиком — в архив: по нему строится страница с лучшими партиями и блестящими ходами
  archiveGame({ ...summary, moves: state.moves.map(m => ({ san: m.san, by: m.by, cls: m.cls })) }, { dark, light });
  const games = [summary, ...state.games];
  let hall = state.hall, extra = '';
  if (result === '1-0' && by !== ENGINE) { // мат движку — в зал славы
    hall = [{ user: by, game: state.game, plies: state.moves.length, at: new Date().toISOString() }, ...hall];
    extra = '\n\n👑 You checkmated stockfish. You are now in the Hall of Mate on the profile.';
  }
  const notice = result === '1-0' ? `game ${state.game}: ${who(by)} checkmated stockfish 👑` : result === '0-1' ? `game ${state.game}: stockfish won · new game` : `game ${state.game}: draw by ${reason}`;
  Object.assign(state, fresh(state.game + 1, { players: state.players, recent: state.recent, games, hall, notice, finalImg }));
  return `🏁 Game ${games[0].game} is over: **${result}** by ${reason}. A new game has started, and this one is now in the [Hall of games](${GAMES_URL}).${extra}`;
}
// ответ движка с разбором: pre — анализ позиции до его хода (если уже есть)
async function engineTurn(state, chess, pre) {
  const fen = chess.fen();
  pre ??= await analyse(fen);
  const { move } = await engineMove(fen);
  const mv = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
  const post = chess.isGameOver() ? null : await analyse(chess.fen());
  apply(state, mv, ENGINE, classify(fen, move, pre, post, [...state.moves.map(m => m.san), mv.san]));
  if (post?.lines?.[0]) state.eval = post.lines[0].score; // теперь ход белых — оценка уже за белых
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
  if (chess.turn() === 'b') { await engineTurn(state, chess); state.fen = chess.fen(); } // движок почему-то не ответил раньше — догоняем

  const fen0 = chess.fen();
  let mv;
  try { mv = new Chess(fen0).move({ from, to, promotion: promo }); } catch { mv = null; }
  if (!mv) return reject(`\`${from}${to}${promo ?? ''}\` isn't a legal move in the current position. Someone may have moved right before you.`);

  const pre = await analyse(fen0);
  chess.move({ from, to, promotion: promo });
  const post = chess.isGameOver() ? null : await analyse(chess.fen());
  const cls = classify(fen0, from + to + (promo ?? ''), pre, post, [...state.moves.map(m => m.san), mv.san]);
  apply(state, mv, user, cls);
  state.players[user] = (state.players[user] ?? 0) + 1;
  state.recent = [user, ...state.recent.filter(u => u !== user)].slice(0, 12);
  state.notice = null;

  let text = `♟ You played \`${mv.san}\` · **${label(cls)}**.`, summary = mv.san, over = false;
  if (chess.isGameOver()) { text += `\n\n${await finish(state, chess, mv, user)}`; over = true; }
  else {
    const r = await engineTurn(state, chess, post);
    const rc = state.moves.at(-1).cls;
    text += `\nstockfish answered \`${r.san}\` · ${label(rc)}.`;
    summary += `, stockfish ${r.san}`;
    if (chess.isGameOver()) { text += `\n\n${await finish(state, chess, r, ENGINE)}`; over = true; }
  }

  if (!over) state.fen = chess.fen(); // после конца партии finish() уже поставил новую
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
  if (chess.turn() === 'b' && !chess.isGameOver()) {
    const r = await engineTurn(state, chess);
    if (chess.isGameOver()) await finish(state, chess, r, ENGINE); else state.fen = chess.fen();
  }
  else if (!chess.isGameOver()) state.eval = (await analyse(chess.fen(), { multipv: 1 })).lines[0]?.score ?? state.eval;
  await publish(state);
  console.log('re-rendered');
} else if (arg === '--reanalyze') { // переразобрать уже сыгранные ходы текущей партии (после правок классификатора)
  const state = load(), c = new Chess();
  let pre = await analyse(c.fen());
  for (const m of state.moves) {
    const fen = c.fen(), history = [...c.history(), m.san];
    c.move(m.san);
    const post = c.isGameOver() ? null : await analyse(c.fen());
    m.cls = classify(fen, m.uci, pre, post, history);
    pre = post;
  }
  if (pre?.lines?.[0] && c.turn() === 'w') state.eval = pre.lines[0].score;
  await publish(state);
  console.log('re-analysed', state.moves.map(m => `${m.san}:${m.cls}`).join(' '));
} else {
  await play();
}
