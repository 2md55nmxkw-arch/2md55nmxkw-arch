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

<picture><source media="(prefers-color-scheme: dark)" srcset="chess/board-3-0-be1c69.webp"><source media="(prefers-color-scheme: light)" srcset="chess/board-3-0-be1c69-light.webp"><img src="chess/board-3-0-be1c69.webp" width="53%" alt="Chess board, game 3. Position (FEN): rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"></picture><picture><source media="(prefers-color-scheme: dark)" srcset="chess/panel-3141da.svg"><source media="(prefers-color-scheme: light)" srcset="chess/panel-3141da-light.svg"><img src="chess/panel-3141da.svg" width="46.9%" alt="Score vs stockfish: 2 won, 0 drawn, 0 lost; 54 moves by 2 players. Pieces on the board: endfield-il2dump (3 stars), Loliland-ModLoader (2 stars), LuauEmu (1 stars), WindUI (1 stars), 2md55nmxkw-arch.github.io (1 stars). Every commit is a move: 90 contributions in the last 64 days. Material by code size: C++ 50%, Luau 31%, JavaScript 19%."></picture>

**Your move.** You play white vs stockfish: click a move, then press Create.

<sub>game 2: <a href="https://github.com/2md55nmxkw-arch">@2md55nmxkw-arch</a> checkmated stockfish 👑</sub>

♘︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb1a3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Na3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb1c3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Nc3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg1f3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Nf3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg1h3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">Nh3</a><br>
♙︎&nbsp; <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ca2a3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">a3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ca2a4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">a4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb2b3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">b3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cb2b4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">b4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cc2c3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">c3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cc2c4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">c4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cd2d3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">d3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cd2d4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">d4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce2e3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">e3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ce2e4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">e4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cf2f3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">f3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cf2f4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">f4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg2g3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">g3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Cg2g4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">g4</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ch2h3&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">h3</a> <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch/issues/new?title=chess%7Cmove%7Ch2h4&body=Just+press+**Create**%2C+stockfish+answers+and+the+board+on+the+profile+updates+in+about+a+minute.%0A%0APlease+don%27t+change+the+title.">h4</a>

<a href="https://github.com/2md55nmxkw-arch" title="@2md55nmxkw-arch"><img src="https://github.com/2md55nmxkw-arch.png?size=64" width="26" height="26" alt="@2md55nmxkw-arch"></a> <a href="https://github.com/MedakhmetAsylmurat" title="@MedakhmetAsylmurat"><img src="https://github.com/MedakhmetAsylmurat.png?size=64" width="26" height="26" alt="@MedakhmetAsylmurat"></a>

<sub>Hall of mate: <a href="https://github.com/2md55nmxkw-arch" title="@2md55nmxkw-arch"><img src="https://github.com/2md55nmxkw-arch.png?size=64" width="16" height="16" alt="@2md55nmxkw-arch"></a> <a href="https://github.com/2md55nmxkw-arch">@2md55nmxkw-arch</a> (game 2) · <a href="https://github.com/2md55nmxkw-arch" title="@2md55nmxkw-arch"><img src="https://github.com/2md55nmxkw-arch.png?size=64" width="16" height="16" alt="@2md55nmxkw-arch"></a> <a href="https://github.com/2md55nmxkw-arch">@2md55nmxkw-arch</a> (game 1)</sub>

<sub>♔︎ <a href="https://github.com/2md55nmxkw-arch/endfield-il2dump">endfield-il2dump</a> · ♕︎ <a href="https://github.com/2md55nmxkw-arch/Loliland-ModLoader">Loliland-ModLoader</a> · ♖︎ <a href="https://github.com/2md55nmxkw-arch/LuauEmu">LuauEmu</a> · ♗︎ <a href="https://github.com/2md55nmxkw-arch/WindUI">WindUI</a> · ♘︎ <a href="https://github.com/2md55nmxkw-arch/2md55nmxkw-arch.github.io">2md55nmxkw-arch.github.io</a></sub>

<div align="center"><details><summary><sub>history</sub></summary>

| player | moves |
| :-- | --: |
| [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) | 52 |
| [@MedakhmetAsylmurat](https://github.com/MedakhmetAsylmurat) | 2 |

<picture><source media="(prefers-color-scheme: dark)" srcset="chess/final-2.webp"><source media="(prefers-color-scheme: light)" srcset="chess/final-2-light.webp"><img src="chess/final-2.webp" width="300" alt="Final position of game 2"></picture>

| game | result | final move |
| :-: | :-- | :-- |
| 2 | 1-0 · checkmate | `Nxe7#` by [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |
| 1 | 1-0 · checkmate | `Qc7#` by [@2md55nmxkw-arch](https://github.com/2md55nmxkw-arch) |

</details></div>
<!-- chess:end -->

<p align="center"><sub>
  header rendered with canvas&nbsp;·&nbsp;chess set 3D model by Riley Queen (<a href="https://polyhaven.com/a/chess_set">Poly Haven</a>, CC0)&nbsp;·&nbsp;board pieces by Cburnett (<a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">Wikimedia Commons</a>, CC BY-SA 3.0)
</sub></p>
