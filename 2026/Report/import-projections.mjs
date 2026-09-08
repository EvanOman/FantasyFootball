// Import only numerical player projections from ESPN's frozen PDF.
// Usage: node import-projections.mjs /path/to/espn-clay-2026-09-07.pdf
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const path = process.argv[2];
assert(path, 'Supply the September 7, 2026 Mike Clay projection PDF.');
const bytes = readFileSync(path);
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, 'a88e277c3d9c3f07bb5f2bafb23e9d3781b4b4e834524b743a3887e99e714ddf', 'Source changed; review before refreshing.');
const text = execFileSync('pdftotext', ['-layout', '-f', '35', '-l', '45', path, '-'], { encoding: 'utf8' });
const positions = { Quarterback: 'QB', 'Running Back': 'RB', 'Wide Receiver': 'WR', 'Tight End': 'TE' };
const aliases = {
  'James Cook': 'James Cook III', 'Ken Walker III': 'Kenneth Walker III',
  'Travis Etienne': 'Travis Etienne Jr.', 'Aaron Jones': 'Aaron Jones Sr.',
  'Kenneth Gainwell': 'Kenny Gainwell', 'Kyle Pitts': 'Kyle Pitts Sr.',
  'Deebo Samuel': 'Deebo Samuel Sr.', 'Chris Godwin': 'Chris Godwin Jr.',
  'Cameron Ward': 'Cam Ward', 'Chris Rodriguez': 'Chris Rodriguez Jr.',
  'Harold Fannin': 'Harold Fannin Jr.', 'A.J. Barner': 'AJ Barner',
};
const teams = { BLT: 'BAL', ARZ: 'ARI', CLV: 'CLE', HST: 'HOU', JAX: 'JAC' };
const players = [];
let position;
for (const line of text.split('\n')) {
  const heading = line.match(/(Quarterback|Running Back|Wide Receiver|Tight End) Projections/);
  if (heading) { position = positions[heading[1]]; continue; }
  const row = line.trim().match(/^(.+?)\s+([A-Z]{2,3})\s+(\d+)\s+(-?\d+)\s+(\d+)\s+(.+)$/);
  if (!row || !position) continue;
  const [, sourceName, team, rank, points, games, rest] = row;
  const stats = rest.split(/\s+/).map(n => Number(n.replace('%', '')));
  assert(stats.every(Number.isFinite));
  const player = { name: aliases[sourceName] ?? sourceName, sourceName, position, team: teams[team] ?? team,
    projectionRank: +rank, points: +points, games: +games };
  if (position === 'QB') {
    assert.equal(stats.length, 9, sourceName);
    Object.assign(player, { passAttempts: stats[0], completions: stats[1], passYards: stats[2], passTD: stats[3],
      interceptions: stats[4], sacks: stats[5], carries: stats[6], rushYards: stats[7], rushTD: stats[8] });
  } else {
    assert.equal(stats.length, 9, sourceName);
    Object.assign(player, { carries: stats[0], rushYards: stats[1], rushTD: stats[2], targets: stats[3],
      receptions: stats[4], receiveYards: stats[5], receiveTD: stats[6], carryShare: stats[7], targetShare: stats[8] });
  }
  players.push(player);
}
for (const position of ['QB', 'RB', 'WR', 'TE']) {
  const rows = players.filter(p => p.position === position);
  assert(rows.length >= 40, `Too few ${position} projections`);
  assert.deepEqual(rows.map(p => p.projectionRank), Array.from({ length: rows.length }, (_, i) => i + 1));
}
assert.equal(new Set(players.map(p => `${p.position}|${p.name}`)).size, players.length);
const output = { source: 'https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf',
  sourceUpdated: '2026-09-07', sourceSha256: sha256, sourcePages: '35–45 (printed PDF pages)',
  basis: 'Published PPR points, Weeks 1–18. Baseline 17-game projections; some players have fewer games explicitly modeled. No additional injury probability inferred.',
  aliases, players };
writeFileSync(new URL('./data/projections.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(`Imported ${players.length} position-qualified projections.`);
