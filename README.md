<!--
  Шапка рендерится canvas'ом офлайн (GitHub не исполняет JS в README):
    npm i
    npm run build        # render/game.mjs -> assets/chess-header.gif + assets/chess-header-static.png
  Спрайты фигур уже лежат в source/sprites/. Перерендерить их из 3D-модели
  (source/chess_set/, «Chess Set» с polyhaven.com/a/chess_set, CC0):
    npm run sprites      # и открыть http://localhost:5178
  Руки: source/gen/hand_{top,bottom,right}.png на зелёном фоне.
-->

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="./assets/chess-header-static.png">
  <img src="./assets/chess-header.gif" width="100%" alt="2md55.arch — every piece was a pawn once. Reverse engineering, Unity IL2CPP, Luau. Stack: C++, Luau, Lua, TypeScript, Python.">
</picture>

<!-- chess:start -->
<img src="chess/board-1-8-f70e19.webp" width="400" align="left" alt="Chess board, game 1. Position (FEN): 1nbqkbnr/rpp2ppp/8/4p3/3p4/8/PPPPPPPP/1RBQKBNR w Kk - 0 5">

<img src="chess/titles/your-move.png" width="200" height="68" alt="YOUR MOVE. You play white vs stockfish: click a move, then Create">

<sub><a href="https://github.com/2md55nmxkw-arch">@2md55nmxkw-arch</a> <code>Nxa7</code> <img src="chess/icons/mistake.png" width="14" height="14" alt="mistake" title="? mistake"> mistake · stockfish <code>Rxa7</code> <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> best</sub>

♖︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb1a1&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Ra1</a><br>
♘︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg1f3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Nf3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg1h3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Nh3</a><br>
♙︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ca2a3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">a3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ca2a4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">a4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb2b3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">b3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb2b4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">b4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cc2c3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">c3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cc2c4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">c4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cd2d3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">d3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce2e3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">e3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce2e4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">e4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cf2f3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">f3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cf2f4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">f4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg2g3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">g3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg2g4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">g4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ch2h3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">h3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ch2h4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">h4</a>

<a href="https://github.com/2md55nmxkw-arch" title="@2md55nmxkw-arch"><img src="https://github.com/2md55nmxkw-arch.png?size=64" width="26" height="26" alt="@2md55nmxkw-arch"></a>

<br clear="left">

<img src="chess/activity-2026-11-10.webp" width="400" align="left" alt="Last 64 days of GitHub activity as a chessboard: 52 contributions">

<img src="chess/titles/every-commit.png" width="264" height="68" alt="EVERY COMMIT IS A MOVE.">

<sub>52 contributions · today is the highlighted square</sub>

<img src="chess/titles/hall-of-mate.png" width="156" height="68" alt="HALL OF MATE. Checkmate stockfish to get your card here">

<img src="chess/hall/empty.webp" width="340" alt="Nobody has checkmated stockfish yet">

<br clear="left">

<div align="center"><details><summary><sub>history</sub></summary>

| # | move | | by |
| --: | :-- | :-: | :-- |
| 4… | `Rxa7` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | stockfish |
| 4. | `Nxa7` | <img src="chess/icons/mistake.png" width="14" height="14" alt="mistake" title="? mistake"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 3… | `d4` | <img src="chess/icons/good.png" width="14" height="14" alt="good" title="✓ good"> | stockfish |
| 3. | `Nb5` | <img src="chess/icons/inaccuracy.png" width="14" height="14" alt="inaccuracy" title="?! inaccuracy"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 2… | `e5` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | stockfish |
| 2. | `Rb1` | <img src="chess/icons/mistake.png" width="14" height="14" alt="mistake" title="? mistake"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 1… | `d5` | <img src="chess/icons/book.png" width="14" height="14" alt="book" title="book move"> | stockfish |
| 1. | `Na3` | <img src="chess/icons/book.png" width="14" height="14" alt="book" title="book move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |

| player | moves |
| :-- | --: |
| [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) | 4 |

</details></div>
<!-- chess:end -->

<p align="center"><sub>
  header rendered with canvas&nbsp;·&nbsp;chess set 3D model by Riley Queen (<a href="https://polyhaven.com/a/chess_set">Poly Haven</a>, CC0)&nbsp;·&nbsp;board pieces by Cburnett (<a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Wikimedia Commons</a>, CC BY-SA 3.0)
</sub></p>
