import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinPlayers, optimize, summarize, resilience, availableAt, percentile, OFFENSE } from '../analysis.mjs';
const draft = JSON.parse(readFileSync(new URL('../data/draft.json', import.meta.url)));
const projections = JSON.parse(readFileSync(new URL('../data/projections.json', import.meta.url)));
const players = joinPlayers(draft, projections);

test('All 128 picks, the snake, source identities, and original rankings survive', () => {
  assert.equal(players.length, 128);
  assert.equal(new Set(players.map(p => p.id)).size, 128);
  assert.equal(players.filter(p => p.rank === null).length, 4);
  assert.equal(players.filter(p => OFFENSE.includes(p.position) && p.points !== null).length, 112);
  for (const p of players) {
    const slot = draft.teams.indexOf(p.team) + 1;
    assert.equal(p.pick, (p.round - 1) * 8 + (p.round % 2 ? slot : 9 - slot));
    if (p.projection) assert.equal(p.projection.position, p.position);
  }
  const etienne = players.filter(p => p.name.includes('Etienne'));
  assert.equal(etienne.length, 1);
  assert.equal(etienne[0].name, 'Travis Etienne Jr.');
  assert.equal(etienne[0].pick, 84);
  assert.equal(etienne[0].rank, 45);
  assert.equal(etienne[0].points, 246);
  assert.equal(players.find(p => p.pick === 77).name, 'Odell Beckham Jr.');
  assert.equal(players.find(p => p.pick === 77).points, 24);
  assert.equal(players.find(p => p.pick === 77).bye, 8);
  assert.equal(players.find(p => p.name === 'Tyler Bass').bye, 7);
  assert.equal(players.find(p => p.name === 'Bears D/ST').bye, 10);
  assert.equal(players.find(p => p.name === 'Vikings D/ST').bye, 6);
  assert.equal(players.filter(p => p.byeInferred).length, 4);
});

test('Projection extraction retains observed numerical rows and special availability cases', () => {
  assert.equal(projections.players.length, 396);
  const byName = n => projections.players.find(p => p.name === n);
  assert.equal(byName('Josh Allen').points, 370);
  assert.equal(byName('Jahmyr Gibbs').receptions, 68);
  assert.equal(byName('Jahmyr Gibbs').carryShare, 63);
  assert.equal(byName('Derrick Henry').receptions, 21);
  assert.equal(byName('Josh Jacobs').games, 11);
  assert.equal(byName('Zach Charbonnet').games, 11);
  assert.equal(byName('Isiah Pacheco').games, 12);
  assert.equal(byName('AJ Barner').position, 'TE');
  assert.equal(projections.sourceUpdated, '2026-09-07');
});

// Independent exhaustive subset oracle. It shares no optimization implementation.
function bruteForce(roster, metric, wr) {
  const pool = roster.filter(p => OFFENSE.includes(p.position));
  const size = 6 + wr;
  let best = -Infinity;
  for (let mask = 0; mask < 2 ** pool.length; mask++) {
    const subset = pool.filter((_, i) => mask & (1 << i));
    if (subset.length !== size) continue;
    const counts = Object.fromEntries(OFFENSE.map(pos => [pos, subset.filter(p => p.position === pos).length]));
    if (counts.QB < 1 || counts.QB > 2 || counts.RB < 2 || counts.WR < wr || counts.TE < 1) continue;
    best = Math.max(best, subset.reduce((s, p) => s + (p[metric] ?? 0), 0));
  }
  return best;
}

for (const team of draft.teams) for (const format of ['standard', 'threeWR']) for (const metric of ['points', 'salary']) {
  test(`${team}: ${format}/${metric} matches exhaustive legal-lineup oracle`, () => {
    const roster = players.filter(p => p.team === team);
    const result = optimize(roster, { format, metric });
    assert.equal(result.total, bruteForce(roster, metric, format === 'standard' ? 2 : 3));
    assert.equal(result.slots.length, format === 'standard' ? 8 : 9);
    assert.equal(new Set(result.slots.map(s => s.player.id)).size, result.slots.length);
    assert.equal(result.emptySlots, 0);
    assert(result.slots.find(s => s.slot === 'FLEX').player.position !== 'QB');
    assert.equal(result.total, result.slots.reduce((s, row) => s + (row.player[metric] ?? 0), 0));
    assert.equal(result.perGame, result.total / 17);
    for (const p of result.bench) assert(!result.slots.some(s => s.player.id === p.id));
  });
}

test('Starter-out scenarios recompute flex substitutions and expose unfilled TE slots', () => {
  for (const team of draft.teams) {
    const roster = players.filter(p => p.team === team);
    const base = optimize(roster);
    const result = resilience(roster);
    assert.equal(result.cases.length, 8);
    for (const c of result.cases) {
      assert(c.loss >= 0 && c.retained >= 0 && c.retained <= 100);
      assert(!c.after.slots.some(s => s.player.id === c.id));
      assert(Math.abs(c.loss - (base.total - c.after.total) / 17) < 1e-8);
    }
  }
  const think = players.filter(p => p.team === 'Think Tank');
  const withoutTE = optimize(think, { exclude: [players.find(p => p.name === 'Tyler Warren').id] });
  assert.equal(withoutTE.emptySlots, 1);
  assert.equal(withoutTE.slots.find(s => s.slot === 'TE').player.points, 0);
  const rome = resilience(players.filter(p => p.team === 'Rome Reigns'));
  assert.equal(rome.worst.name, 'Christian McCaffrey');
  assert.deepEqual(rome.worst.replacements, ['Chris Olave']);
  assert.equal(rome.worst.after.slots.find(s => s.slot === 'RB2').player.name, 'Omarion Hampton');
});

test('Bye exclusions, including two QBs on the same bye, are legal', () => {
  for (const team of draft.teams) for (let week = 5; week <= 14; week++) {
    const roster = players.filter(p => p.team === team);
    const result = optimize(roster, { week });
    assert(result.slots.every(s => s.player.bye !== week));
    assert(result.total <= optimize(roster).total);
  }
  assert.equal(optimize(players.filter(p => p.team === 'NKFL'), { week: 11 }).slots.find(s => s.slot === 'QB').player.empty, true);
  assert.equal(optimize(players.filter(p => p.team === 'Rome Reigns'), { week: 10 }).slots.find(s => s.slot === 'QB').player.empty, true);
});

test('Replays use the actual available board; no future or already-picked players leak', () => {
  for (let pick = 1; pick <= 128; pick++) {
    const available = availableAt(players, draft.rankings, pick);
    for (const p of players.filter(p => p.pick < pick && p.rank !== null)) {
      assert(!available.some(r => r.CanonicalPlayer === p.name));
    }
    const chosen = players[pick - 1];
    if (chosen.rank !== null) assert(available.some(p => p.CanonicalPlayer === chosen.name));
  }
  assert(availableAt(players, draft.rankings, 33).some(p => p.CanonicalPlayer === 'Joe Burrow'));
  assert(!availableAt(players, draft.rankings, 35).some(p => p.CanonicalPlayer === 'Joe Burrow'));
});

test('Relative scores handle ties, stay bounded, and retain the legacy baseline', () => {
  assert.equal(percentile([1, 1, 1], 1), 50);
  assert.equal(percentile([1, 2, 3], 1), 0);
  assert.equal(percentile([1, 2, 3], 3), 100);
  const rows = summarize(players, draft.teams);
  assert.equal(rows[0].team, 'Rome Reigns');
  assert.equal(rows.find(r => r.team === 'Purple Rain').rankDiff, 2.5);
  assert.equal(rows.find(r => r.team === 'Flames').rankDiff, 58.9375);
  assert.equal(rows.find(r => r.team === 'Magic Skol Bus').valueSurplus, 94);
  assert.equal(rows.find(r => r.team === 'Clint Bilton').scores.balanced, rows.find(r => r.team === 'Think Tank').scores.balanced);
  for (const row of rows) for (const score of Object.values(row.scores)) assert(score >= 0 && score <= 100);
});

test('Partial replay rosters and all-excluded rosters remain valid', () => {
  const result = optimize([]);
  assert.equal(result.total, 0);
  assert.equal(result.emptySlots, 8);
  for (const team of draft.teams) for (let pick = 1; pick <= 128; pick++) {
    const roster = players.filter(p => p.team === team && p.pick <= pick);
    const result = optimize(roster);
    assert.equal(new Set(result.slots.map(s => s.player.id)).size, 8);
    assert(result.slots.every(s => s.player.empty || s.player.pick <= pick));
  }
});
