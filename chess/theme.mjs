// Палитры доски: тёмная (под GitHub dark) и светлая (под GitHub light).
// Каждая картинка README есть в двух вариантах; светлый файл лежит рядом с суффиксом -light,
// а README отдаёт его через <picture> при prefers-color-scheme: light.
export const THEMES = {
  dark: {
    bg: '#0d1117', sqLight: '#2d333b', sqDark: '#1c2128', line: '#30363d', hud: '#e6e6e6', dim: '#6e7681',
    barBlack: '#161b22', barWhite: '#e6edf3',
    mark: [214, 232, 96], markAlpha: 0.2, pink: [255, 70, 170],
    // перекраска SVG-фигур Cburnett: l — белые, d — чёрные
    piece: {
      l: [['fill:#ffffff', 'fill:#eef0f3'], ['fill="#fff', 'fill="#eef0f3'], ['stroke:#000000', 'stroke:#0d1117'], ['stroke="#000', 'stroke="#0d1117'], ['fill:#000000', 'fill:#0d1117']],
      d: [['fill:#000000', 'fill:#161b22'], ['stroke:#000000', 'stroke:#c9d1d9'], ['stroke:#ffffff', 'stroke:#c9d1d9'], ['fill:#ffffff', 'fill:#c9d1d9']],
    },
  },
  light: {
    bg: '#ffffff', sqLight: '#f6f8fa', sqDark: '#d8dee4', line: '#d0d7de', hud: '#1f2328', dim: '#8c959f',
    barBlack: '#24292f', barWhite: '#ffffff',
    mark: [212, 167, 44], markAlpha: 0.38, pink: [191, 57, 137],
    piece: {
      l: [['stroke:#000000', 'stroke:#24292f'], ['stroke="#000', 'stroke="#24292f'], ['fill:#000000', 'fill:#24292f']],
      d: [['fill:#000000', 'fill:#24292f'], ['stroke:#000000', 'stroke:#24292f']],
    },
  },
};
// board-1-8-f70e19.webp → board-1-8-f70e19-light.webp
export const lightName = file => file.replace(/(\.\w+)$/, '-light$1');
