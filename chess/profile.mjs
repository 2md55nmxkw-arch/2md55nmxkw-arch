// Данные профиля из GitHub API для двух ячеек панели (chess/panel.mjs):
//   • «Pieces on the board» — закреплённые и самые звёздные репозитории как фигуры (король — больше всего звёзд);
//   • «Material» — из чего состоит код: доли языков по размеру во всех своих репозиториях, цвета — как у GitHub.
// Настройки (сколько проектов, что скрыть, какие языки не считать) — в chess/about.json.
//   node chess/profile.mjs                   — в Actions (env GITHUB_TOKEN, LOGIN)
//   PROFILE_JSON=file node chess/profile.mjs — из сохранённого ответа GraphQL (для локального запуска)
import { Chess } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePanel } from './panel.mjs';
import { writeReadme, REPO } from './readme.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOGIN = process.env.LOGIN || REPO.split('/')[0];
const CFG = JSON.parse(fs.readFileSync(path.join(DIR, 'about.json'), 'utf8'));
const QUERY = `query($login: String!) { user(login: $login) {
  pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { ...R } } }
  repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }) { nodes { ...R } } } }
fragment R on Repository { name nameWithOwner url stargazerCount isFork isArchived owner { login }
  languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } } }`;

async function fetchProfile() {
  if (process.env.PROFILE_JSON) return JSON.parse(fs.readFileSync(process.env.PROFILE_JSON, 'utf8')).data.user;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme' },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const json = await res.json();
  if (!json.data?.user) throw new Error(`GraphQL: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`);
  return json.data.user;
}
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// проекты: закреплённые, затем свои по звёздам; фигура — по месту (король — больше всего звёзд)
function pickProjects(user) {
  const max = Math.min(6, CFG.projects?.max ?? 6), hide = (CFG.projects?.hide ?? []).map(s => s.toLowerCase());
  const own = user.repositories.nodes.filter(r => !r.isFork && !r.isArchived && !same(r.name, LOGIN)); // без самого репозитория профиля
  const picked = [], seen = new Set();
  for (const r of [...user.pinnedItems.nodes, ...own]) {
    if (!r?.name || seen.has(r.nameWithOwner) || hide.includes(r.name.toLowerCase())) continue;
    seen.add(r.nameWithOwner); picked.push(r);
    if (picked.length >= max) break;
  }
  picked.sort((a, b) => b.stargazerCount - a.stargazerCount);
  return picked.map((r, i) => ({ name: same(r.owner.login, LOGIN) ? r.name : r.nameWithOwner, url: r.url, stars: r.stargazerCount, piece: 'kqrbnp'[Math.min(i, 5)] }));
}
// материал: доли языков по размеру кода
function material(user) {
  const skipRepos = (CFG.material?.skipRepos ?? [LOGIN]).map(s => s.toLowerCase()), skipLang = new Set(CFG.material?.skipLanguages ?? []);
  const size = new Map(), color = new Map();
  for (const r of user.repositories.nodes) {
    if (r.isFork || skipRepos.includes(r.name.toLowerCase())) continue;
    for (const e of r.languages.edges) {
      if (skipLang.has(e.node.name)) continue;
      size.set(e.node.name, (size.get(e.node.name) ?? 0) + e.size);
      color.set(e.node.name, e.node.color ?? '#8b949e');
    }
  }
  let list = [...size.entries()].sort((a, b) => b[1] - a[1]);
  if (list.length > 6) list = [...list.slice(0, 5), ['Other', list.slice(5).reduce((s, [, v]) => s + v, 0)]];
  const total = list.reduce((s, [, v]) => s + v, 0) || 1;
  // проценты целыми числами с суммой ровно 100 (метод наибольших остатков)
  const raw = list.map(([name, v]) => ({ name, exact: (100 * v) / total, pct: Math.floor((100 * v) / total) }));
  let rest = 100 - raw.reduce((s, r) => s + r.pct, 0);
  for (const r of [...raw].sort((a, b) => (b.exact - b.pct) - (a.exact - a.pct))) { if (rest-- <= 0) break; r.pct++; }
  return raw.map(({ name, pct }) => ({ name, pct, color: color.get(name) ?? '#8b949e' })).filter(r => r.pct > 0);
}

const user = await fetchProfile();
const out = { projects: pickProjects(user), material: material(user) };
fs.writeFileSync(path.join(DIR, 'profile.json'), JSON.stringify(out, null, 2) + '\n');

const state = { recent: [], hall: [], ...JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8')) };
writePanel(state);
writeReadme(state, new Chess(state.fen));
console.log(`profile: ${out.projects.map(p => `${p.piece}:${p.name}★${p.stars}`).join(' ')} | ${out.material.map(m => `${m.name} ${m.pct}%`).join(', ')}`);
