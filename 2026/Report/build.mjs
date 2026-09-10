import { readFileSync, writeFileSync } from 'node:fs';
import { joinPlayers, summarize, optimize, availableAt, OFFENSE } from './analysis.mjs';
import { historicalCurve, withHistoricalScores, VALUE_WEIGHTS } from './value-model.mjs';
import { renderReport } from './report-template.mjs';
import { teams as copy, sources, availability } from './content.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const write = (name, value) => writeFileSync(new URL(name, import.meta.url), value);
const draft = read('./data/draft.json');
const projections = read('./data/projections.json');
const history = read('./data/history.json');
const curves = Object.fromEntries(['standard', 'threeWR'].map(format => [format, historicalCurve(history, { wr:format === 'standard' ? 2 : 3 })]));
write('./data/value-analysis.json', JSON.stringify({ retrieved:history.retrieved, curves }) + '\n');
const players = joinPlayers(draft, projections);
const summary = format => withHistoricalScores(summarize(players, draft.teams, format), curves[format].bands);
const rows = summary('standard');
const compactLineup = result => ({ total: result.total, perGame: result.perGame, emptySlots: result.emptySlots,
  slots: result.slots.map(s => ({ slot: s.slot, id: s.player.empty ? null : s.player.id })), bench: result.bench.map(p => p.id) });
const drafted = new Set(players.map(p => `${p.position}|${p.name}`));
const freeAgents = projections.players.filter(p => !drafted.has(`${p.position}|${p.name}`)).map((p, i) => {
  const ranked = draft.rankings.find(r => r.CanonicalPlayer === p.name && r.Position === p.position);
  return { id: `free-${i}`, name: p.name, position: p.position, team: 'Undrafted', nflTeam: p.team,
    pick: 0, round: 0, rank: ranked?.Rank ?? null, positionRank: ranked?.PositionRank ?? null,
    bye: ranked?.Bye ?? null, salary: ranked?.SalaryValue ?? null, points: p.points, games: p.games, projection: p, cost: 0 };
});
const wire = Object.fromEntries(OFFENSE.map(pos => [pos, freeAgents.filter(p => p.position === pos).sort((a, b) => b.points - a.points).slice(0, 3)]));
const result = { teams: draft.teams, players, wire, sources, availability, weights: VALUE_WEIGHTS, formats: {}, replay: [] };
for (const format of ['standard', 'threeWR']) {
  result.formats[format] = summary(format).map(row => {
    const roster = row.roster;
    const absences = {};
    for (const p of roster.filter(p => OFFENSE.includes(p.position))) {
      const after = optimize(roster, { format, exclude: [p.id] });
      const candidate = wire[p.position][0];
      const withWire = optimize([...roster, candidate], { format, exclude: [p.id] });
      absences[p.id] = { ...compactLineup(after), wire: { ...compactLineup(withWire), candidate } };
    }
    return { team: row.team, grade: copy[row.team].grade, scores: row.scores, places: row.places,
      components: row.components, rankDiff: row.rankDiff, valueSurplus: row.valueSurplus, curve:row.curve,
      starterSalary: row.salary.total, rosterPoints: row.rosterPoints, benchPoints: row.benchPoints,
      retention: row.cover.retention, averageLoss: row.cover.averageLoss,
      worst: { id: row.cover.worst.id, name: row.cover.worst.name, loss: row.cover.worst.loss },
      baseline: compactLineup(row.starters), salaryLineup: compactLineup(row.salary), absences,
      byes: Object.fromEntries(Array.from({ length: 18 }, (_, i) => i + 1).map(week => [week, compactLineup(optimize(roster, { format, week }))])),
      flaggedOut: compactLineup(optimize(roster, { format, exclude: roster.filter(p => availability.some(a => a.name === p.name && a.kind === 'Unavailable')).map(p => p.id) })) };
  });
}
for (let pick = 0; pick <= 128; pick++) {
  const chosen = pick ? players[pick - 1] : null;
  const available = pick ? availableAt(players, draft.rankings, pick).filter(p => OFFENSE.includes(p.Position)).slice(0, 5) : [];
  result.replay.push({ pick, chosen: chosen?.id ?? null, available,
    teams: draft.teams.map(team => {
      const roster = players.filter(p => p.team === team && p.pick <= pick);
      return { team, count: roster.length, total: optimize(roster).perGame,
        rankDiff: roster.length ? roster.reduce((s, p) => s + (p.rank ?? 301) - p.pick, 0) / roster.length : null,
        salarySurplus: roster.filter(p => OFFENSE.includes(p.position)).reduce((s, p) => s + (p.salary ?? 0) - p.cost, 0) };
    }) });
}
write('./data/analysis.json', JSON.stringify(result) + '\n');

write('./index.html', renderReport({ draft, players, rows, copy, sources, availability, curve:curves.standard }));
console.log(`Built report: ${players.length} picks, ${projections.players.length} projections, ${result.replay.length} replay states, 8 team assessments.`);
