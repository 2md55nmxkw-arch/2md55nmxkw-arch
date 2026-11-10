// «Every commit is a move»: последние 64 дня контрибуций для ячейки панели (chess/panel.mjs) — сетка 8×8,
// a1 — 63 дня назад … h8 — сегодня; яркость клетки зависит от числа контрибуций за день.
//   node chess/activity.mjs                    — в Actions (env GITHUB_TOKEN, LOGIN)
//   ACTIVITY_JSON=file node chess/activity.mjs — из сохранённого ответа GraphQL (для локального запуска)
import { Chess } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePanel } from './panel.mjs';
import { writeReadme, REPO } from './readme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'chess');
const LOGIN = process.env.LOGIN || REPO.split('/')[0];
const QUERY = `query($login: String!) { user(login: $login) { contributionsCollection {
  contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;

async function calendar() {
  let json;
  if (process.env.ACTIVITY_JSON) json = JSON.parse(fs.readFileSync(process.env.ACTIVITY_JSON, 'utf8'));
  else {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme-activity' },
      body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
    });
    if (!res.ok) throw new Error(`GraphQL ${res.status}`);
    json = await res.json();
  }
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  return weeks.flatMap(w => w.contributionDays).map(d => ({ date: d.date, count: d.contributionCount })).sort((a, b) => a.date.localeCompare(b.date));
}

const days = (await calendar()).slice(-64);
for (const f of fs.readdirSync(DIR)) if (/^activity-.*\.webp$/.test(f)) fs.unlinkSync(path.join(DIR, f)); // доска прежней версии
const total = days.reduce((s, d) => s + d.count, 0);
fs.writeFileSync(path.join(DIR, 'activity.json'), JSON.stringify({ total, from: days[0].date, to: days.at(-1).date, days: days.map(d => d.count) }) + '\n');

const state = { recent: [], hall: [], ...JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8')) };
writePanel(state);
writeReadme(state, new Chess(state.fen));
console.log(`activity: ${total} contributions ${days[0].date}..${days.at(-1).date}`);
