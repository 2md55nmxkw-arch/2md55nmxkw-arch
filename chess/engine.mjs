// Stockfish 10 (npm «stockfish», GPL-3.0) отдельным процессом, общение по UCI.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'node_modules', 'stockfish', 'src', 'stockfish.js');

function open() {
  const p = spawn(process.execPath, [BIN], { stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  const listeners = new Set();
  p.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      for (const fn of [...listeners]) fn(line);
    }
  });
  const send = s => p.stdin.write(s + '\n');
  const until = pred => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { listeners.delete(fn); reject(new Error('engine timeout')); }, 60000);
    const fn = line => { if (pred(line)) { clearTimeout(timer); listeners.delete(fn); resolve(line); } };
    listeners.add(fn);
  });
  return { send, until, listen: fn => listeners.add(fn), close: () => { try { send('quit'); } catch {} p.kill(); } };
}

// оценка с точки зрения стороны, которая ходит: { cp } или { mate }
async function search(fen, { skill = 20, go }) {
  const e = open();
  try {
    e.send('uci'); await e.until(l => l === 'uciok');
    e.send(`setoption name Skill Level value ${skill}`);
    e.send('setoption name Contempt value 0'); // иначе SF10 завышает оценку в пользу стороны на ходу
    e.send('isready'); await e.until(l => l === 'readyok');
    e.send('ucinewgame'); e.send(`position fen ${fen}`);
    let score = null;
    e.listen(l => { const m = /score (cp|mate) (-?\d+)/.exec(l); if (m) score = { [m[1]]: Number(m[2]) }; });
    e.send(`go ${go}`);
    const best = await e.until(l => l.startsWith('bestmove'));
    return { move: best.split(/\s+/)[1], score };
  } finally { e.close(); }
}

/** ход движка (ослабленный Skill Level, чтобы его можно было обыграть) */
export const engineMove = (fen, skill = 5) => search(fen, { skill, go: 'movetime 800' });
/** честная оценка позиции на полной силе */
export const evaluate = fen => search(fen, { skill: 20, go: 'depth 12' }).then(r => r.score);
