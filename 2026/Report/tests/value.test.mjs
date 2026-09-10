import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, nameKey } from '../import-history.mjs';
import { replacement, decreasingFit, curveCredit, historicalCurve, rosterCurve, withHistoricalScores, VALUE_WEIGHTS } from '../value-model.mjs';
import { optimize, joinPlayers, summarize } from '../analysis.mjs';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)));
const history = read('history');
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('Source parser preserves quoted commas, quotes, newlines and final rows', () => {
  assert.deepEqual(parseCSV('a,b\r\n"x,y","say ""yes"""\r\nz,"q\nr"'), [{ a:'x,y', b:'say "yes"' }, { a:'z', b:'q\nr' }]);
  assert.throws(() => parseCSV('a,b\n"open,quote'));
  assert.throws(() => parseCSV('a,b\n1,2,3'));
  assert.equal(nameKey('Odell Beckham Jr.'), nameKey('Odell Beckham'));
});
test('All ten regular seasons and 2,800 historical ADP observations are covered', () => {
  assert.deepEqual(history.seasons.map(s => s.year), Array.from({ length:10 }, (_, i) => i + 2016));
  assert.equal(history.sources.length, 40);
  assert(history.sources.every(s => /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.equal(history.audit.matched, 2800);
  for (const s of history.seasons) {
    assert.equal(s.scheduleGames, s.year < 2021 ? 16 : 17);
    assert.equal(new Set(s.players.map(p => p.id)).size, s.players.length);
    for (const adp of Object.values(s.adp)) {
      assert.equal(adp.players.length, 140);
      assert.equal(new Set(adp.players.map(p => p.id)).size, 140);
      for (const [i, p] of adp.players.entries()) {
        assert.equal(p.rank, i + 1);
        assert(p.id && Number.isFinite(p.points));
        const original = s.players.find(r => r.id === p.id);
        if (original) { assert.equal(p.points, original.points); assert.equal(p.resultsPosition, original.position); }
        else { assert.equal(p.points, 0); assert(p.zeroSeason); }
      }
    }
  }
});
test('Zero-production selections and historical positions survive the join', () => {
  const s2018 = history.seasons.find(s => s.year === 2018);
  const bell = s2018.adp['2qb'].players.find(p => p.name === 'LeVeon Bell');
  assert.equal(bell.rank, 2); assert.equal(bell.points, 0); assert(bell.zeroSeason);
  const s2016 = history.seasons.find(s => s.year === 2016);
  assert.equal(s2016.players.find(p => p.name === 'Jordan Matthews').position, 'WR');
  const s2025 = history.seasons.find(s => s.year === 2025);
  assert.equal(s2025.players.find(p => p.name === 'Travis Hunter').position, 'WR');
  assert.equal(s2025.players.find(p => p.name === 'Travis Hunter').points, 63.8);
});
test('Pooled replacement matches the independently tested lineup optimizer for one team', () => {
  const all = history.seasons[0].players.map(p => ({ ...p, rank:null }));
  for (const wr of [2, 3]) {
    const repl = replacement(all, { teams:1, wr });
    near(repl.points, optimize(all, { format:wr === 2 ? 'standard' : 'threeWR' }).total);
    assert.equal(Object.values(repl.counts).reduce((a, b) => a + b), 6 + wr);
    for (const [pos, baseline] of Object.entries(repl.baseline)) {
      const sorted = all.filter(p => p.position === pos).sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
      assert.equal(baseline.id, sorted[repl.counts[pos]].id);
    }
  }
});
test('Nonincreasing fit is weighted, preserves means and exposes flat plateaus', () => {
  assert.deepEqual(decreasingFit([5, 2, 4, 1]), [5, 3, 3, 1]);
  assert.deepEqual(decreasingFit([2, 4], [3, 1]), [2.5, 2.5]);
  assert.deepEqual(decreasingFit([1, 2, 3]), [2, 2, 2]);
  assert.throws(() => decreasingFit([1], [0]));
  const bands = [{ center:5.5, fitted:5 }, { center:15.5, fitted:3 }];
  near(curveCredit(bands, 10.5), 4);
  assert.equal(curveCredit(bands, 1), 5);
  assert.equal(curveCredit(bands, 300), 3);
  assert.equal(curveCredit(bands, null), 0);
});
test('Eight-team pooled optimizer agrees with independent mandatory/FLEX/SF allocation', () => {
  for (const s of history.seasons) for (const wr of [2,3]) {
    const sorted = [...s.players].sort((a,b) => b.points - a.points || a.id.localeCompare(b.id));
    const selected = [];
    for (const [pos,count] of Object.entries({ QB:8, RB:16, WR:8*wr, TE:8 })) selected.push(...sorted.filter(p => p.position === pos).slice(0,count));
    const ids = new Set(selected.map(p => p.id));
    const flex = sorted.filter(p => p.position !== 'QB' && !ids.has(p.id)).slice(0,8);
    flex.forEach(p => ids.add(p.id)); selected.push(...flex);
    selected.push(...sorted.filter(p => !ids.has(p.id)).slice(0,8));
    near(replacement(s.players,{wr}).points, selected.reduce((sum,p) => sum+p.points,0));
  }
});
test('Historical bands use all picks, divide by schedule and remain reproducible', () => {
  const curve = historicalCurve(history);
  for (const s of curve.seasons) {
    assert.equal(Object.values(s.replacement.counts).reduce((a, b) => a + b), 64);
    for (const p of s.picks) near(p.value, Math.max(0, p.points - s.replacement.baseline[p.resultsPosition].points) / s.scheduleGames);
    for (const b of s.bands) {
      const picks = s.picks.filter(p => p.rank >= b.first && p.rank <= b.last);
      near(b.value, picks.reduce((sum, p) => sum + p.value, 0) / 10);
      assert.equal(b.n, 10);
    }
    assert(s.concentration.every(c => c.preseason <= c.hindsight + 1e-9));
  }
  for (const [i, b] of curve.bands.entries()) {
    assert.equal(b.n, 100);
    near(b.value, curve.seasons.reduce((sum, s) => sum + s.bands[i].value, 0) / 10);
    assert(i === 0 || curve.bands[i - 1].fitted >= b.fitted);
  }
  const pre2021 = historicalCurve(history, { years:[2016, 2017, 2018, 2019, 2020] });
  assert(pre2021.bands.every(b => b.n === 50));
});
test('Curve acquisition surplus subtracts pick cost and excludes specialists', () => {
  const bands = historicalCurve(history).bands;
  const players = joinPlayers(read('draft'), read('projections'));
  for (const team of read('draft').teams) {
    const roster = players.filter(p => p.team === team), result = rosterCurve(roster, bands);
    assert.equal(result.picks.length, 14);
    near(result.surplus, result.credit - result.cost);
    for (const p of result.picks) {
      const original = roster.find(r => r.id === p.id);
      near(p.surplus, curveCredit(bands, original.rank) - curveCredit(bands, original.pick));
    }
    assert(result.top[10] <= result.top[20] && result.top[20] <= result.top[30] && result.top[30] <= result.top[40]);
  }
});
test('Revised scores split the value budget, preserve the previous index, and match the export', () => {
  const draft = read('draft'), players = joinPlayers(draft,read('projections'));
  for (const format of ['standard','threeWR']) {
    const bands = historicalCurve(history,{wr:format === 'standard' ? 2 : 3}).bands;
    const old = summarize(players,draft.teams,format), snapshot = JSON.stringify(old);
    const revised = withHistoricalScores(old,bands);
    assert.equal(JSON.stringify(old),snapshot,'Old three-input contract was mutated');
    for (const row of revised) {
      near(row.scores.espn,old.find(r=>r.team===row.team).scores.balanced);
      assert.deepEqual(row.scores,read('analysis').formats[format].find(r=>r.team===row.team).scores);
      for (const [preset,weights] of Object.entries(VALUE_WEIGHTS)) {
        assert.equal(weights.reduce((a,b)=>a+b),100);
        near(row.scores[preset],weights.reduce((s,w,i)=>s+w*row.components[i]/100,0));
      }
    }
    assert.equal(revised[0].team,'Rome Reigns');
  }
  const scores = read('analysis').formats.standard;
  assert(scores.find(r=>r.team==='Think Tank').scores.balanced > scores.find(r=>r.team==='Clint Bilton').scores.balanced);
});
test('History export is reproducible and the written conclusions match its arithmetic', () => {
  const exported = read('value-analysis');
  for (const [format,curve] of Object.entries(exported.curves)) assert.deepEqual(curve,historicalCurve(history,{wr:format==='standard'?2:3}));
  const c = exported.curves.standard;
  assert.equal(c.concentration[2].hindsight.toFixed(1),'79.4');
  assert.equal(c.concentration[3].hindsight.toFixed(1),'89.9');
  assert.equal(c.concentration[3].preseason.toFixed(1),'58.8');
  assert.equal(c.top10BeatsNext10,7);
  assert(c.bands[5].value > c.bands[4].value,'Do not hide the observed reversal');
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/class="scorecard-curve"/g)??[]).length,8);
  assert(!html.includes('class="curve-assessment"'));
  assert(html.includes('All eight letter grades are unchanged'));
  const draft=read('draft'), players=joinPlayers(draft,read('projections'));
  for (const [years,winner] of [[[2016,2017,2018,2019,2020],'Rome Reigns'],[[2021,2022,2023,2024,2025],'Magic Skol Bus']]) {
    const curve=historicalCurve(history,{years});
    const ranked=draft.teams.map(team=>({team,...rosterCurve(players.filter(p=>p.team===team),curve.bands)})).sort((a,b)=>b.surplus-a.surplus);
    assert.equal(ranked[0].team,winner,'Sample-sensitivity claim');
  }
});
