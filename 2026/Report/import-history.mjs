/** Frozen public results and preseason ADP; no player-performance forecasts.
 * Usage: node import-history.mjs /path/to/cache
 * Reuses downloaded files. Review the manifest before accepting a refreshed source.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else field += c;
  }
  if (quoted) throw Error('Unclosed CSV quote');
  if (field || row.length) rows.push([...row, field.replace(/\r$/, '')]);
  const headers = rows.shift();
  return rows.filter(r => r.length > 1).map(r => {
    if (r.length !== headers.length) throw Error('CSV column mismatch');
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}

export const nameKey = name => name.toLowerCase().replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').replace(/[^a-z0-9]/g, '');
const aliases = { mitchelltrubisky: 'mitchtrubisky', gabedavis: 'gabrieldavis',
  hollywoodbrown: 'marquisebrown', joshuapalmer: 'joshpalmer' };
const identity = name => aliases[nameKey(name)] ?? nameKey(name);
const positions = ['QB', 'RB', 'WR', 'TE'];

async function main(cache) {
  if (!cache) throw Error('Pass a dedicated download cache directory');
  mkdirSync(cache, { recursive: true });
  const sources = [];
  const extractPath = new URL('./data/history.json', import.meta.url);
  const expectedSources = existsSync(extractPath) ? JSON.parse(readFileSync(extractPath)).sources : [];
  async function get(url, filename) {
    const path = resolve(cache, filename);
    if (!existsSync(path)) {
      const response = await fetch(url, { signal:AbortSignal.timeout(30000) });
      if (!response.ok) throw Error(`${response.status}: ${url}`);
      writeFileSync(path, Buffer.from(await response.arrayBuffer()));
    }
    const bytes = readFileSync(path);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const expected = expectedSources.find(s => s.filename === filename);
    if (expected && (expected.sha256 !== sha256 || expected.url !== url)) throw Error(`Changed historical source: ${filename}. Review the source and manifest explicitly before refreshing.`);
    sources.push({ filename, url, sha256 });
    return bytes.toString();
  }
  const seasons = [], positionCorrections = [];
  for (let year = 2016; year <= 2025; year++) {
    const rosterCSV = await get(`https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_${year}.csv`, `roster-${year}.csv`);
    const roster = parseCSV(rosterCSV).filter(p => p.gsis_id).map(p => ({ id: p.gsis_id, name: p.full_name,
      position: p.gsis_id === '00-0040718' ? 'WR' : p.position === 'FB' ? 'RB' : p.position }));
    const seasonPosition = p => {
      const candidates = [...new Set(roster.filter(r => r.id === p.player_id).map(r => r.position))];
      if (candidates.length > 1) throw Error(`Ambiguous season position: ${year} ${p.player_display_name}`);
      return p.player_id === '00-0040718' ? 'WR' : candidates[0] ?? (p.position === 'FB' ? 'RB' : p.position);
    };
    const csv = await get(`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_${year}.csv`, `stats-${year}.csv`);
    // Hunter's source label is CB; his published offensive points belong at WR.
    // https://www.jaguars.com/news/k000227-travis-hunter-undergoes-successful-knee-surgery
    const players = parseCSV(csv).filter(p => positions.includes(seasonPosition(p))).map(p => {
      if (+p.season !== year || p.season_type !== 'REG' || p.fantasy_points_ppr === '' || !Number.isFinite(+p.fantasy_points_ppr)) throw Error('Invalid season results');
      const position = seasonPosition(p);
      if (position !== p.position) positionCorrections.push({ year, id: p.player_id, name: p.player_display_name, sourcePosition: p.position, position });
      return { id: p.player_id, name: p.player_display_name,
        position,
        games: +p.games, points: +p.fantasy_points_ppr };
    });
    if (new Set(players.map(p => p.id)).size !== players.length) throw Error(`Duplicate season player: ${year}`);
    const adp = {};
    for (const format of ['2qb', 'ppr']) {
      const data = JSON.parse(await get(`https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=12&year=${year}`, `adp-${format}-${year}.json`));
      if (data.status !== 'Success' || !data.meta || data.players.length < 150) throw Error(`Bad ADP response: ${year}/${format}`);
      if (data.meta.teams !== 12 || data.meta.type !== (format === '2qb' ? '2 QB' : 'PPR') || !data.meta.end_date.startsWith(`${year}-`)) throw Error('ADP metadata mismatch');
      adp[format] = { meta: data.meta, players: data.players.filter(p => positions.includes(p.position)).sort((a, b) => a.adp - b.adp || a.player_id - b.player_id).slice(0, 140)
        .map((p, i) => ({ sourceId: p.player_id, name: p.name, position: p.position, adp: p.adp, rank: i + 1 })) };
      if (adp[format].players.length !== 140) throw Error(`Incomplete first 140: ${year}/${format}`);
    }
    seasons.push({ year, scheduleGames: year < 2021 ? 16 : 17, players, adp, roster });
    console.log(`Loaded ${year}: ${players.length} offensive result rows`);
  }
  const unmatched = [], zeros = [], positionChanges = [];
  for (const season of seasons) for (const [format, data] of Object.entries(season.adp)) for (const pick of data.players) {
    let matches = season.players.filter(p => identity(p.name) === identity(pick.name));
    if (matches.length > 1) matches = matches.filter(p => p.position === pick.position);
    let player = matches.length === 1 ? matches[0] : null;
    if (!player && matches.length === 0) {
      const known = season.roster.filter(p => identity(p.name) === identity(pick.name) && p.position === pick.position);
      const otherYears = known.length ? known : seasons.flatMap(s => s.players).filter(p => identity(p.name) === identity(pick.name) && p.position === pick.position);
      const ids = [...new Set(otherYears.map(p => p.id))];
      if (ids.length === 1 && !season.players.some(p => p.id === ids[0])) {
        player = { ...otherYears[0], points: 0, games: 0 };
        zeros.push({ year: season.year, format, name: pick.name, id: player.id });
      }
    }
    if (!player) { unmatched.push({ year: season.year, format, ...pick }); continue; }
    if (player.position !== pick.position) positionChanges.push({ year: season.year, format, name: pick.name, adpPosition: pick.position, resultsPosition: player.position });
    pick.id = player.id; pick.points = player.points; pick.games = player.games;
    pick.resultsPosition = player.position;
    pick.zeroSeason = player.games === 0;
  }
  if (unmatched.length) { console.log(JSON.stringify({ unmatched }, null, 2)); throw Error(`${unmatched.length} unresolved identities; no extract written`); }
  const output = { retrieved: '2026-09-10', sources: sources.sort((a, b) => a.filename.localeCompare(b.filename)),
    audit: { matched: seasons.length * 2 * 140, zeros, positionChanges, positionCorrections }, seasons: seasons.map(({ roster, ...s }) => s) };
  writeFileSync(new URL('./data/history.json', import.meta.url), JSON.stringify(output) + '\n');
  console.log(JSON.stringify({ matched: output.audit.matched, zeros, positionChanges }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv[2]);
