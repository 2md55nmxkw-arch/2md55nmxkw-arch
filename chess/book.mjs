// Мини-книга дебютов: популярные линии в SAN. Ход «книжный», если вся партия до него включительно — начало одной из линий.
const LINES = [
  // 1.e4 e5
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6',
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7',
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5', 'e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4', 'e4 e5 Nf3 Nc6 c3 Nf6 d4',
  'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5', 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6', 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7',
  'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4', 'e4 e5 Nc3 Nc6 Bc4 Nf6', 'e4 e5 f4 exf4 Nf3 g5 h4 g4', 'e4 e5 f4 Bc5 Nf3 d6', 'e4 e5 Bc4 Nf6 d3 c6',
  'e4 e5 d4 exd4 Qxd4 Nc6 Qe3', 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6',
  // сицилианская
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7', 'e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7',
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6', 'e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7',
  'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Nf6', 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6', 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4', 'e4 c5 c3 d5 exd5 Qxd5',
  'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6',
  // остальное на 1.e4
  'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+', 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7',
  'e4 e6 d4 d5 exd5 exd5', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6', 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6',
  'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6', 'e4 d5 exd5 Qxd5 Nc3 Qd6', 'e4 d5 exd5 Nf6 d4 Nxd5', 'e4 d6 d4 Nf6 Nc3 g6 f4 Bg7',
  'e4 g6 d4 Bg7 Nc3 d6', 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4', 'e4 Nc6 d4 d5',
  // 1.d4
  'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O', 'd4 d5 c4 e6 Nf3 Nf6 g3 Be7', 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5',
  'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5', 'd4 d5 c4 e6 Nc3 c6 Nf3 Nf6 e3 Nbd7', 'd4 d5 c4 Nc6 Nc3 dxc4', 'd4 d5 c4 e5 dxe5 d4',
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5', 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O', 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6',
  'd4 Nf6 c4 e6 Nf3 d5 Nc3 Be7', 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3', 'd4 Nf6 c4 c5 d5 b5 cxb5 a6',
  'd4 Nf6 c4 c5 d5 e6 Nc3 exd5', 'd4 Nf6 c4 e5 dxe5 Ng4', 'd4 Nf6 Nf3 d5 Bf4 e6 e3 c5', 'd4 Nf6 Bf4 d5 e3 e6', 'd4 Nf6 Bg5 Ne4',
  'd4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5', 'd4 d5 Nf3 Nf6 Bf4 c5', 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5', 'd4 d5 e3 Nf6 Bd3 e6',
  'd4 d5 Nc3 Nf6 Bg5 Bf5', 'd4 f5 c4 Nf6 g3 e6 Bg2 Be7', 'd4 f5 g3 Nf6 Bg2 g6', 'd4 e6 c4 Bb4+', 'd4 d6 e4 Nf6 Nc3 g6', 'd4 g6 c4 Bg7 Nc3 d6',
  // фланговые
  'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5', 'c4 e5 Nc3 Nc6 g3 g6 Bg2 Bg7', 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7', 'c4 Nf6 Nc3 e6 e4 d5', 'c4 Nf6 Nc3 g6 e4 d6',
  'c4 e6 Nc3 d5 d4 Nf6', 'c4 c6 e4 d5', 'Nf3 d5 g3 Nf6 Bg2 c6 O-O Bg4', 'Nf3 d5 c4 d4', 'Nf3 Nf6 c4 g6 Nc3 Bg7', 'Nf3 c5 c4 Nc6',
  'g3 d5 Bg2 Nf6 Nf3', 'b3 e5 Bb2 Nc6 e3 d5', 'f4 d5 Nf3 Nf6 e3 g6', 'Nc3 d5 e4 d4', 'e3 e5 d4 exd4',
];
const BOOK = LINES.map(l => l.split(' '));

/** history — SAN всех ходов партии до этого хода включительно */
export function isBook(history) {
  return history.length > 0 && BOOK.some(line => line.length >= history.length && history.every((m, i) => line[i] === m));
}
