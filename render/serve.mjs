// Мини-сервер для рендера спрайтов в браузере:
//   GET  /...            — статика из корня проекта
//   POST /save/<name>.png — сохранить PNG в source/sprites/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'source', 'sprites');
const PORT = Number(process.env.PORT ?? 5178);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png' };

fs.mkdirSync(OUT, { recursive: true });
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname.startsWith('/save/')) {
    const name = path.basename(url.pathname.slice(6));
    if (!/^[\w-]+\.png$/.test(name)) { res.writeHead(400).end('bad name'); return; }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(OUT, name), Buffer.concat(chunks));
      console.log('saved', name);
      res.writeHead(200).end('ok');
    });
    return;
  }
  const file = path.join(ROOT, path.normalize(decodeURIComponent(url.pathname === '/' ? '/render/sprites.html' : url.pathname)));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`sprites server http://localhost:${PORT}`));
