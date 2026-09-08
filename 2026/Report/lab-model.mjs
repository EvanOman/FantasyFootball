/** Team-level comparisons of published projections. No fitted player model,
 * random outcomes, injury probabilities, or game-result Elo updates.
 * @typedef {import('./analysis.mjs').Player} Player
 */

/** A static Elo-style log scale, centered on the unchanged baseline cohort.
 * Doubling the published lineup total adds 400 log10(2), about 120.4.
 * @param {number} total @param {number} reference */
export function powerRating(total, reference) {
  if (!(total > 0) || !(reference > 0)) throw Error('Power ratings require positive totals');
  return 1500 + 400 * Math.log10(total / reference);
}

/** @param {Object} data
 * @param {{format?:string,scenario?:string,week?:number,exclusions?:Object,waivers?:boolean}} options */
export function matchupRows(data, { format = 'standard', scenario = 'baseline', week = 10,
  exclusions = {}, waivers = false } = {}) {
  const source = data.formats[format];
  if (!source || !['baseline', 'absence', 'bye', 'flagged'].includes(scenario)) throw Error('Unknown comparison');
  if (!Number.isInteger(week) || week < 1 || week > 18) throw Error('Invalid bye week');
  const reference = Math.exp(source.reduce((sum, row) => sum + Math.log(row.baseline.total), 0) / source.length);
  return source.map(row => {
    const absentId = exclusions[row.team] ?? row.worst.id;
    if (scenario === 'absence' && !row.absences[absentId]) throw Error('Absent player is not on this roster');
    const absence = row.absences[absentId];
    const lineup = scenario === 'absence' ? (waivers ? absence.wire : absence)
      : scenario === 'bye' ? row.byes[week] : scenario === 'flagged' ? row.flaggedOut : row.baseline;
    return { team: row.team, grade: row.grade, rankDiff: row.rankDiff, lineup,
      baseline: row.baseline, rating: powerRating(lineup.total, reference),
      baselineRating: powerRating(row.baseline.total, reference),
      loss: row.baseline.perGame - lineup.perGame,
      absentId: scenario === 'absence' ? absentId : null,
      candidate: scenario === 'absence' && waivers ? absence.wire.candidate : null };
  }).sort((a, b) => b.rating - a.rating || a.team.localeCompare(b.team));
}

/** @param {Object} a @param {Object} b */
export function headToHead(a, b) {
  return { edge: a.lineup.perGame - b.lineup.perGame,
    ratingGap: a.rating - b.rating,
    // This is a share of projected points, never a calibrated win probability.
    projectionShare: a.lineup.total / (a.lineup.total + b.lineup.total) };
}

/** @param {Object} data @param {number} pick @param {string} team */
export function replayView(data, pick, team) {
  if (!Number.isInteger(pick) || pick < 0 || pick >= data.replay.length || !data.teams.includes(team)) throw Error('Invalid replay selection');
  const state = data.replay[pick];
  return { state, chosen: data.players.find(p => p.id === state.chosen) ?? null,
    roster: data.players.filter(p => p.team === team && p.pick <= pick),
    selected: state.teams.find(t => t.team === team),
    history: data.replay.slice(0, pick + 1).map(s => ({ pick: s.pick,
      team: s.teams.find(t => t.team === team).total,
      leader: Math.max(...s.teams.map(t => t.total)) })) };
}

/** @param {Object} data @param {string} format @param {string} preset */
export function gradeView(data, format = 'standard', preset = 'balanced') {
  if (!data.formats[format] || !data.weights[preset]) throw Error('Unknown grade view');
  const rows = data.formats[format];
  return [...rows].sort((a, b) => b.scores[preset] - a.scores[preset] || a.team.localeCompare(b.team))
    .map(row => ({ team: row.team, grade: row.grade, score: row.scores[preset], place: row.places[preset],
      rankDiff: row.rankDiff, oldPlace: 1 + rows.filter(other => other.rankDiff < row.rankDiff).length,
      valueSurplus: row.valueSurplus, starterSalary: row.starterSalary }));
}
