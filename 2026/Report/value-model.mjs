/** Historical rank-price lens. Published points in; no individual forecasts out. */
import { percentile } from './analysis.mjs';
export const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
export const VALUE_WEIGHTS = { balanced:[60,20,10,10], starters:[80,10,5,5], depth:[40,40,10,10],
  value:[35,15,25,25], espn:[60,20,20,0], history:[60,20,0,20] };
const mean = values => values.reduce((s, v) => s + v, 0) / values.length;
const total = values => values.reduce((s, v) => s + v, 0);

/** Pool the league's legal offensive slots, then select the best position counts.
 * Replacement is the NEXT unselected player at that position. This is a static,
 * full-season starter baseline, not the weekly waiver pool or a bench baseline.
 */
export function replacement(players, { teams = 8, wr = 2 } = {}) {
  if (!Number.isInteger(teams) || teams < 1 || ![2, 3].includes(wr)) throw Error('Invalid league');
  const pool = Object.fromEntries(POSITIONS.map(pos => [pos, players.filter(p => p.position === pos)
    .sort((a, b) => b.points - a.points || a.id.localeCompare(b.id))]));
  const sums = Object.fromEntries(POSITIONS.map(pos => {
    const prefix = [0];
    for (const p of pool[pos]) prefix.push(prefix.at(-1) + p.points);
    return [pos, prefix];
  }));
  let best = null;
  for (let q = teams; q <= 2 * teams; q++) for (let r = 2 * teams; r <= 4 * teams; r++) for (let w = wr * teams; w <= (wr + 2) * teams; w++) {
    const t = (6 + wr) * teams - q - r - w;
    if (t < teams || t > 3 * teams) continue;
    const counts = { QB: q, RB: r, WR: w, TE: t };
    if (POSITIONS.some(pos => !pool[pos][counts[pos]])) continue;
    const points = total(POSITIONS.map(pos => sums[pos][counts[pos]]));
    if (!best || points > best.points) best = { points, counts };
  }
  if (!best) throw Error('Insufficient players to establish replacement');
  return { ...best, baseline: Object.fromEntries(POSITIONS.map(pos => [pos, { ...pool[pos][best.counts[pos]], rank: best.counts[pos] + 1 }])) };
}

/** Weighted pool-adjacent-violators: least-squares nonincreasing band means.
 * Raw observations remain visible; this constraint is not evidence of a slope.
 */
export function decreasingFit(values, weights = values.map(() => 1)) {
  if (values.length !== weights.length || values.some(v => !Number.isFinite(v)) || weights.some(w => !(w > 0))) throw Error('Invalid fit inputs');
  const blocks = [];
  values.forEach((v, i) => {
    blocks.push({ start: i, end: i, sum: v * weights[i], weight: weights[i] });
    while (blocks.length > 1 && blocks.at(-2).sum / blocks.at(-2).weight < blocks.at(-1).sum / blocks.at(-1).weight) {
      const b = blocks.pop(), a = blocks.pop();
      blocks.push({ start: a.start, end: b.end, sum: a.sum + b.sum, weight: a.weight + b.weight });
    }
  });
  return blocks.flatMap(b => Array(b.end - b.start + 1).fill(b.sum / b.weight));
}

/** Smooth between observed ten-player band centers; flat outside observed range.
 * Unknown ranks receive no credit. Known ranks >140 keep the last observed value:
 * this data cannot justify further tail precision or an invented rank-140 cliff.
 */
export function curveCredit(bands, rank) {
  if (rank === null || !Number.isFinite(rank) || rank < 1) return 0;
  if (!bands.length) throw Error('Missing curve');
  if (rank <= bands[0].center) return bands[0].fitted;
  for (let i = 1; i < bands.length; i++) {
    if (rank <= bands[i].center) {
      const a = bands[i - 1], b = bands[i], f = (rank - a.center) / (b.center - a.center);
      return a.fitted + f * (b.fitted - a.fitted);
    }
  }
  return bands.at(-1).fitted;
}

export function historicalCurve(history, { format = '2qb', wr = 2, years = history.seasons.map(s => s.year) } = {}) {
  if (!['2qb', 'ppr'].includes(format) || !years.length || years.some(y => !history.seasons.some(s => s.year === y))) throw Error('Invalid historical comparison');
  const seasons = history.seasons.filter(s => years.includes(s.year)).map(s => {
    const repl = replacement(s.players, { wr });
    const value = p => Math.max(0, p.points - repl.baseline[p.position].points) / s.scheduleGames;
    const finishers = s.players.map(p => ({ ...p, value: value(p),
      positionRank:1 + s.players.filter(other => other.position === p.position && other.points > p.points).length }))
      .sort((a, b) => b.value - a.value || b.points - a.points || a.id.localeCompare(b.id));
    const positiveTotal = total(finishers.map(p => p.value));
    const picks = s.adp[format].players.map(p => ({ ...p, value: value({ ...p, position: p.resultsPosition }) }));
    const bands = Array.from({ length: 14 }, (_, i) => {
      const ps = picks.slice(i * 10, (i + 1) * 10);
      return { first: i * 10 + 1, last: i * 10 + 10, value: mean(ps.map(p => p.value)),
        points: mean(ps.map(p => p.points / s.scheduleGames)), positive: ps.filter(p => p.value > 0).length,
        n: ps.length };
    });
    return { year: s.year, scheduleGames: s.scheduleGames, replacement: repl, bands,
      concentration: [10, 20, 30, 40].map(top => ({ top,
        hindsight: total(finishers.slice(0, top).map(p => p.value)) / positiveTotal * 100,
        preseason: total(picks.slice(0, top).map(p => p.value)) / positiveTotal * 100 })),
      finishers: finishers.slice(0, 80), picks };
  });
  const bands = Array.from({ length: 14 }, (_, i) => {
    const rows = seasons.map(s => s.bands[i]);
    return { first: 10 * i + 1, last: 10 * i + 10, center: 10 * i + 5.5,
      value: mean(rows.map(r => r.value)), points: mean(rows.map(r => r.points)),
      min: Math.min(...rows.map(r => r.value)), max: Math.max(...rows.map(r => r.value)),
      n: total(rows.map(r => r.n)), positive: total(rows.map(r => r.positive)) };
  });
  const fit = decreasingFit(bands.map(b => b.value), bands.map(b => b.n));
  bands.forEach((b, i) => b.fitted = fit[i]);
  const concentration = [10, 20, 30, 40].map((top, i) => ({ top,
    hindsight: mean(seasons.map(s => s.concentration[i].hindsight)),
    preseason: mean(seasons.map(s => s.concentration[i].preseason)) }));
  const top10BeatsNext10 = seasons.filter(s => s.bands[0].value > s.bands[1].value).length;
  return { format, wr, years: seasons.map(s => s.year), bands, concentration, top10BeatsNext10, seasons };
}

/** A draft-acquisition lens, not a sum of simultaneous starting-lineup points. */
export function rosterCurve(roster, bands) {
  const picks = roster.filter(p => POSITIONS.includes(p.position)).map(p => ({
    id: p.id, credit: curveCredit(bands, p.rank), cost: curveCredit(bands, p.pick),
    surplus: curveCredit(bands, p.rank) - curveCredit(bands, p.pick) }));
  return { picks, credit: total(picks.map(p => p.credit)), cost: total(picks.map(p => p.cost)),
    surplus: total(picks.map(p => p.surplus)),
    top: Object.fromEntries([10, 20, 30, 40].map(n => [n, roster.filter(p => POSITIONS.includes(p.position) && p.rank !== null && p.rank <= n).length])) };
}

/** Retain the old three-input analysis contract; enrich report rows explicitly. */
export function withHistoricalScores(rows, bands) {
  const enriched = rows.map(row => ({ ...row, curve:rosterCurve(row.roster, bands), previousScores:row.scores }));
  for (const row of enriched) {
    row.components = [...row.components, percentile(enriched.map(r => r.curve.surplus), row.curve.surplus)];
    row.scores = Object.fromEntries(Object.entries(VALUE_WEIGHTS).map(([key, weights]) => [key,
      total(weights.map((w, i) => w * row.components[i] / 100))]));
    row.places = {};
  }
  for (const row of enriched) for (const key of Object.keys(VALUE_WEIGHTS)) row.places[key] = 1 + enriched.filter(r => r.scores[key] > row.scores[key]).length;
  return enriched.sort((a, b) => b.scores.balanced - a.scores.balanced);
}
