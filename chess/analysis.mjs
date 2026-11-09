// Классификация ходов в духе chess.com: по потере «ожидаемых очков» (вероятности выигрыша)
// относительно лучшего хода движка, плюс great (единственный хороший ход) и brilliant (работающая жертва).
import { Chess } from 'chess.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
// вероятность выигрыша по кривой lichess — мягче к шуму оценки на малой глубине
export const wp = s => (s.mate !== undefined ? (s.mate > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.00368208 * s.cp)));
const neg = s => (s.mate !== undefined ? { mate: -s.mate } : { cp: -s.cp });
const play = (c, u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

function material(c, color) {
  let s = 0;
  for (const row of c.board()) for (const p of row) if (p) s += (p.color === color ? 1 : -1) * VAL[p.type];
  return s;
}
// после хода и лучшего ответа соперника (и нашего ответа) мы всё ещё минимум на 2 пешки беднее — значит, жертва
function sacrifice(fen, uci, pvAfter = []) {
  const c = new Chess(fen), me = c.turn(), before = material(c, me);
  play(c, uci);
  for (const u of pvAfter.slice(0, 2)) { try { play(c, u); } catch { break; } }
  return material(c, me) - before <= -2;
}

/**
 * fen  — позиция до хода; uci — сыгранный ход
 * pre  — analyse(fen) (MultiPV 2), post — analyse(позиции после хода) или null, если партия закончилась
 */
export function classify(fen, uci, pre, post) {
  const c = new Chess(fen);
  if (c.moves().length === 1) return 'forced';
  const ply = (Number(fen.split(' ')[5]) - 1) * 2 + (c.turn() === 'b' ? 1 : 0);
  play(c, uci);
  const best = pre?.lines?.[0], second = pre?.lines?.[1];
  if (!best) return 'good';
  const after = c.isCheckmate() ? { mate: 1 } : c.isGameOver() ? { cp: 0 } : post?.lines?.[0] ? neg(post.lines[0].score) : best.score;
  const wBest = wp(best.score), wAfter = wp(after), loss = Math.max(0, wBest - wAfter);
  let cls = uci === best.pv[0] || loss <= 0.005 ? 'best'
    : loss < 0.02 ? 'excellent' : loss < 0.06 ? 'good' : loss < 0.12 ? 'inaccuracy' : loss < 0.22 ? 'mistake' : 'blunder';
  if (ply < 8 && loss < 0.12 && !c.isCheckmate()) return 'book'; // дебют: нормальные ходы — «книжные», как на chess.com
  if (cls === 'best' && second && wBest - wp(second.score) >= 0.15 && wAfter >= 0.3) cls = 'great';
  if (['best', 'great', 'excellent'].includes(cls) && wAfter >= 0.5 && !c.isGameOver() && sacrifice(fen, uci, post?.lines?.[0]?.pv)) cls = 'brilliant';
  return cls;
}
