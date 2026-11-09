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

async function session(fn) {
  const e = open();
  try {
    e.send('uci'); await e.until(l => l === 'uciok');
    e.send('setoption name Contempt value 0'); // иначе SF10 завышает оценку в пользу стороны на ходу
    return await fn(e);
  } finally { e.close(); }
}

/** ход движка, ослабленный Skill Level, чтобы его можно было обыграть */
export const engineMove = (fen, skill = 5) => session(async e => {
  e.send(`setoption name Skill Level value ${skill}`);
  e.send('isready'); await e.until(l => l === 'readyok');
  e.send('ucinewgame'); e.send(`position fen ${fen}`);
  e.send('go movetime 800');
  const best = await e.until(l => l.startsWith('bestmove'));
  return { move: best.split(/\s+/)[1] };
});

/**
 * честный анализ на полной силе: лучшие линии с оценкой с точки зрения стороны на ходу
 * → { best, lines: [{ score: { cp } | { mate }, pv: ['e2e4', …] }, …] }
 */
export const analyse = (fen, { depth = 14, multipv = 2 } = {}) => session(async e => {
  e.send(`setoption name MultiPV value ${multipv}`);
  e.send('isready'); await e.until(l => l === 'readyok');
  e.send('ucinewgame'); e.send(`position fen ${fen}`);
  const lines = [];
  e.listen(l => {
    if (!l.startsWith('info') || / (upper|lower)bound/.test(l)) return;
    const mp = /\bmultipv (\d+)/.exec(l), sc = /\bscore (cp|mate) (-?\d+)/.exec(l), pv = /\bpv (.+)$/.exec(l);
    if (sc && pv) lines[(mp ? +mp[1] : 1) - 1] = { score: { [sc[1]]: +sc[2] }, pv: pv[1].trim().split(/\s+/) };
  });
  e.send(`go depth ${depth}`);
  const best = await e.until(l => l.startsWith('bestmove'));
  return { best: best.split(/\s+/)[1], lines: lines.filter(Boolean) };
});
