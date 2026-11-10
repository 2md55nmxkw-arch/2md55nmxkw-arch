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
I take games and runtimes apart, then write the tools I wanted to have: an offline IL2CPP dumper, a mod loader, a Luau emulator.<br>
Mostly C++ and Luau, with TypeScript around the edges.

♙︎&nbsp; <a href="https://2md55nmxkw-arch.github.io">site</a>

<picture><source media="(prefers-color-scheme: dark)" srcset="chess/board-2-20-29b96e.webp"><source media="(prefers-color-scheme: light)" srcset="chess/board-2-20-29b96e-light.webp"><img src="chess/board-2-20-29b96e.webp" width="53%" alt="Chess board, game 2. Position (FEN): r3k1nr/pb1p1pp1/1pp2q2/2bPN2p/2P1PP2/2NBB3/PPn3PP/R2QK2R w KQkq - 3 11"></picture><picture><source media="(prefers-color-scheme: dark)" srcset="chess/panel-42dfb2.svg"><source media="(prefers-color-scheme: light)" srcset="chess/panel-42dfb2-light.svg"><img src="chess/panel-42dfb2.svg" width="46.9%" alt="Score vs stockfish: 1 won, 0 drawn, 0 lost; 36 moves by 2 players. Pieces on the board: endfield-il2dump (3 stars), Loliland-ModLoader (2 stars), LuauEmu (1 stars), WindUI (1 stars), 2md55nmxkw-arch.github.io (1 stars). Every commit is a move: 90 contributions in the last 64 days. Material by code size: C++ 50%, Luau 31%, JavaScript 19%."></picture>

**Your move.** You play white vs stockfish: click a move, then press Create.

<sub><a href="https://github.com/2md55nmxkw-arch">@2md55nmxkw-arch</a> <code>Be3</code> <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> best · stockfish <code>Nc2+</code> <img src="chess/icons/good.png" width="14" height="14" alt="good" title="✓ good"> good · check</sub>

♔︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce1d2&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Kd2</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce1e2&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Ke2</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce1f1&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Kf1</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce1f2&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Kf2</a><br>
♕︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cd1c2&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Qxc2</a><br>
♗︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cd3c2&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Bxc2</a>

<a href="https://github.com/2md55nmxkw-arch" title="@2md55nmxkw-arch"><img src="https://github.com/2md55nmxkw-arch.png?size=64" width="26" height="26" alt="@2md55nmxkw-arch"></a> <a href="https://github.com/MedakhmetAsylmurat" title="@MedakhmetAsylmurat"><img src="https://github.com/MedakhmetAsylmurat.png?size=64" width="26" height="26" alt="@MedakhmetAsylmurat"></a>

<sub>Hall of mate: <a href="https://github.com/2md55nmxkw-arch" title="@2md55nmxkw-arch"><img src="https://github.com/2md55nmxkw-arch.png?size=64" width="16" height="16" alt="@2md55nmxkw-arch"></a> <a href="https://github.com/2md55nmxkw-arch">@2md55nmxkw-arch</a> (game 1)</sub>

<sub>♔︎ <a href="https://github.com/2md55nmxkw-arch/endfield-il2dump">endfield-il2dump</a> · ♕︎ <a href="https://github.com/2md55nmxkw-arch/Loliland-ModLoader">Loliland-ModLoader</a> · ♖︎ <a href="https://github.com/2md55nmxkw-arch/LuauEmu">LuauEmu</a> · ♗︎ <a href="https://github.com/2md55nmxkw-arch/WindUI">WindUI</a> · ♘︎ <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch.github.io">2md55nmxkw-arch.github.io</a></sub>

<div align="center"><details><summary><sub>history</sub></summary>

| # | move | | by |
| --: | :-- | :-: | :-- |
| 10… | `Nc2+` | <img src="chess/icons/good.png" width="14" height="14" alt="good" title="✓ good"> | stockfish |
| 10. | `Be3` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 9… | `Bc5` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | stockfish |
| 9. | `f4` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 8… | `Qf6` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | stockfish |
| 8. | `Nxe5` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 7… | `c6` | <img src="chess/icons/inaccuracy.png" width="14" height="14" alt="inaccuracy" title="?! inaccuracy"> | stockfish |
| 7. | `Nf3` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 6… | `Bb7` | <img src="chess/icons/good.png" width="14" height="14" alt="good" title="✓ good"> | stockfish |
| 6. | `Bd3` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 5… | `h5` | <img src="chess/icons/inaccuracy.png" width="14" height="14" alt="inaccuracy" title="?! inaccuracy"> | stockfish |
| 5. | `Nc3` | <img src="chess/icons/best.png" width="14" height="14" alt="best" title="★ best move"> | [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |

| player | moves |
| :-- | --: |
| [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) | 34 |
| [@MedakhmetAsylmurat](https://github.com/MedakhmetAsylmurat) | 2 |

<picture><source media="(prefers-color-scheme: dark)" srcset="chess/final-1.webp"><source media="(prefers-color-scheme: light)" srcset="chess/final-1-light.webp"><img src="chess/final-1.webp" width="300" alt="Final position of game 1"></picture>

| game | result | final move |
| :-: | :-- | :-- |
| 1 | 1-0 · checkmate | `Qc7#` by [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |

</details></div>
<!-- chess:end -->

<p align="center"><sub>
  header rendered with canvas&nbsp;·&nbsp;chess set 3D model by Riley Queen (<a href="https://polyhaven.com/a/chess_set">Poly Haven</a>, CC0)&nbsp;·&nbsp;board pieces by Cburnett (<a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Wikimedia Commons</a>, CC BY-SA 3.0)
</sub></p>
