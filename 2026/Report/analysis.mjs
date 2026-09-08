/** Pure draft-analysis functions, shared by the static report build and the lab.
 * No DOM, network, random sampling, or hidden injury probabilities.
 * @typedef {'QB'|'RB'|'WR'|'TE'|'K'|'DST'} Position
 * @typedef {{id:string,name:string,position:Position,team:string,nflTeam:string|null,
 * pick:number,round:number,rank:number|null,positionRank:number|null,bye:number|null,
 * salary:number|null,points:number|null,games:number|null,projection:Object|null,byeInferred?:boolean,
 * cost:number,empty?:boolean}} Player
 */
export const OFFENSE = ['QB', 'RB', 'WR', 'TE'];
export const FORMATS = { standard: { wr: 2, label: 'Confirmed · 2 WR + FLEX' },
  threeWR: { wr: 3, label: 'Sensitivity · 3 WR + FLEX' } };
export const WEIGHTS = { balanced: [60, 20, 20], starters: [80, 10, 10], depth: [40, 40, 20], value: [35, 15, 50] };

/** @param {Object} draft @param {Object} projections @returns {Player[]} */
export function joinPlayers(draft, projections) {
  return draft.ledger.map(row => {
    const projection = projections.players.find(p => p.name === row.CanonicalPlayer && p.position === row.Position);
    if (OFFENSE.includes(row.Position) && !projection) throw Error(`Missing projection: ${row.CanonicalPlayer}`);
    if (projection && row.NFLTeam && projection.team !== row.NFLTeam) throw Error(`Team mismatch: ${row.CanonicalPlayer}`);
    const unrankedTeams = { 'Bears D/ST': 'CHI', 'Vikings D/ST': 'MIN', 'Tyler Bass': 'BUF' };
    const nflTeam = row.NFLTeam ?? projection?.team ?? unrankedTeams[row.CanonicalPlayer] ?? null;
    const teamByes = [...new Set(draft.rankings.filter(r => r.NFLTeam === nflTeam).map(r => r.Bye))];
    if (teamByes.length !== 1) throw Error(`Ambiguous team bye: ${row.CanonicalPlayer}`);
    return { id: String(row.PickNumber), name: row.CanonicalPlayer, position: row.Position,
      team: row.Team, nflTeam, pick: row.PickNumber,
      round: row.Round, rank: row.Rank, positionRank: row.PositionRank, bye: row.Bye ?? teamByes[0], byeInferred: row.Bye === null,
      salary: row.SalaryValue, points: projection?.points ?? null, games: projection?.games ?? null,
      projection: projection ?? null, cost: draft.rankings.find(r => r.Rank === row.PickNumber).SalaryValue };
  });
}

/** @param {Player} player @param {'points'|'salary'} metric @returns {number} */
export function value(player, metric = 'points') { return player[metric] ?? 0; }
/** @param {Player} a @param {Player} b @param {'points'|'salary'} metric */
function compare(a, b, metric) { return value(b, metric) - value(a, metric) || (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name); }
/** @param {Position} position @param {number} n @returns {Player} */
function empty(position, n) { return { id: `empty-${position}-${n}`, name: 'Unfilled slot', position, team: '', nflTeam: null,
  pick: 0, round: 0, rank: null, positionRank: null, bye: null, salary: 0, points: 0, games: null, projection: null, cost: 0, empty: true }; }

/** Exact optimization by position-count enumeration. With equal eligibility
 * within each position, the best k players dominate every other k-player subset.
 * @param {Player[]} roster
 * @param {{format?:string,metric?:'points'|'salary',exclude?:string[],week?:number}} options
 */
export function optimize(roster, { format = 'standard', metric = 'points', exclude = [], week = 0 } = {}) {
  const wr = FORMATS[format]?.wr;
  if (!wr) throw Error('Unknown lineup format');
  const size = 6 + wr;
  const pool = Object.fromEntries(OFFENSE.map(pos => [pos, roster.filter(p => p.position === pos && !exclude.includes(p.id) && (!week || p.bye !== week))
    .concat(Array.from({ length: pos === 'WR' ? wr + 2 : 4 }, (_, n) => empty(pos, n))).sort((a, b) => compare(a, b, metric))]));
  let best = null;
  for (let q = 1; q <= 2; q++) for (let r = 2; r <= 4; r++) for (let w = wr; w <= wr + 2; w++) {
    const t = size - q - r - w;
    if (t < 1 || t > 3) continue;
    const selected = [...pool.QB.slice(0, q), ...pool.RB.slice(0, r), ...pool.WR.slice(0, w), ...pool.TE.slice(0, t)];
    const total = selected.reduce((sum, p) => sum + value(p, metric), 0);
    const tie = selected.reduce((sum, p) => sum + (p.rank ?? 999), 0);
    if (!best || total > best.total || (total === best.total && tie < best.tie)) best = { selected, total, tie };
  }
  const chosen = Object.fromEntries(OFFENSE.map(pos => [pos, best.selected.filter(p => p.position === pos)]));
  const slots = [{ slot: 'QB', player: chosen.QB.shift() },
    { slot: 'RB1', player: chosen.RB.shift() }, { slot: 'RB2', player: chosen.RB.shift() },
    ...Array.from({ length: wr }, (_, n) => ({ slot: `WR${n + 1}`, player: chosen.WR.shift() })),
    { slot: 'TE', player: chosen.TE.shift() }];
  const flex = [...chosen.RB, ...chosen.WR, ...chosen.TE].sort((a, b) => compare(a, b, metric));
  slots.push({ slot: 'FLEX', player: flex.shift() });
  slots.push({ slot: 'SF', player: chosen.QB[0] ?? flex.shift() });
  const ids = slots.map(s => s.player.id);
  return { slots, total: best.total, perGame: best.total / 17,
    emptySlots: slots.filter(s => s.player.empty).length,
    bench: roster.filter(p => OFFENSE.includes(p.position) && !ids.includes(p.id) && !exclude.includes(p.id) && (!week || p.bye !== week)) };
}

/** @param {Player[]} roster @param {string} format */
export function resilience(roster, format = 'standard') {
  const baseline = optimize(roster, { format });
  const cases = baseline.slots.filter(s => !s.player.empty).map(({ slot, player }) => {
    const after = optimize(roster, { format, exclude: [player.id] });
    return { id: player.id, name: player.name, slot, loss: (baseline.total - after.total) / 17,
      retained: baseline.total ? after.total / baseline.total * 100 : 0,
      replacements: after.slots.filter(s => !s.player.empty && !baseline.slots.some(b => b.player.id === s.player.id)).map(s => s.player.name),
      emptySlots: after.emptySlots, after };
  }).sort((a, b) => b.loss - a.loss || a.id.localeCompare(b.id));
  return { cases, averageLoss: cases.reduce((a, b) => a + b.loss, 0) / cases.length,
    retention: cases.reduce((a, b) => a + b.retained, 0) / cases.length, worst: cases[0] };
}

/** @param {number[]} values @param {number} target */
export function percentile(values, target) {
  if (values.length < 2) return 50;
  const below = values.filter(v => v < target).length;
  const tied = values.filter(v => v === target).length;
  return (below + (tied - 1) / 2) / (values.length - 1) * 100;
}

/** @param {Player[]} players @param {string[]} teams @param {string} format */
export function summarize(players, teams, format = 'standard') {
  const rows = teams.map(team => {
    const roster = players.filter(p => p.team === team);
    const offense = roster.filter(p => OFFENSE.includes(p.position));
    const starters = optimize(roster, { format });
    const cover = resilience(roster, format);
    const salary = optimize(roster, { format, metric: 'salary' });
    const rankDiff = roster.reduce((s, p) => s + (p.rank ?? 301) - p.pick, 0) / roster.length;
    const valueSurplus = offense.reduce((s, p) => s + (p.salary ?? 0) - p.cost, 0);
    const rb = offense.filter(p => p.position === 'RB').sort((a, b) => compare(a, b, 'points'));
    const byes = Array.from({ length: 14 }, (_, i) => i + 5).map(week => {
      const after = optimize(roster, { format, week });
      return { week, loss: starters.perGame - after.perGame, emptySlots: after.emptySlots,
        missing: roster.filter(p => p.bye === week).map(p => p.name), total: after.perGame };
    }).filter(w => w.missing.length);
    return { team, roster, starters, cover, salary, rankDiff, valueSurplus, rb,
      rosterPoints: offense.reduce((s, p) => s + value(p), 0),
      benchPoints: starters.bench.reduce((s, p) => s + value(p), 0), byes,
      worstBye: [...byes].sort((a, b) => b.loss - a.loss)[0] };
  });
  for (const row of rows) {
    row.components = [percentile(rows.map(r => r.starters.total), row.starters.total),
      percentile(rows.map(r => r.cover.retention), row.cover.retention),
      percentile(rows.map(r => r.valueSurplus), row.valueSurplus)];
    row.scores = Object.fromEntries(Object.entries(WEIGHTS).map(([key, weights]) => [key,
      weights.reduce((sum, weight, i) => sum + weight * row.components[i] / 100, 0)]));
    row.places = {};
  }
  for (const key of Object.keys(WEIGHTS)) for (const row of rows) row.places[key] = 1 + rows.filter(other => other.scores[key] > row.scores[key]).length;
  return rows.sort((a, b) => b.scores.balanced - a.scores.balanced);
}

/** The player was genuinely available immediately before this pick.
 * @param {Player[]} players @param {Object[]} rankings @param {number} pick */
export function availableAt(players, rankings, pick) {
  const gone = new Set(players.filter(p => p.pick < pick).map(p => `${p.position}|${p.name}`));
  return rankings.filter(p => !gone.has(`${p.Position}|${p.CanonicalPlayer}`));
}
