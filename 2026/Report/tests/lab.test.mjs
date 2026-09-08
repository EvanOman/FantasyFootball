import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { powerRating, matchupRows, headToHead, replayView, gradeView } from '../lab-model.mjs';
const data = JSON.parse(readFileSync(new URL('../data/analysis.json', import.meta.url)));
const near = (a,b) => assert(Math.abs(a-b) < 1e-9, `${a} != ${b}`);

test('Power scale has a 1500 baseline mean, preserves order, and recovers point ratios', () => {
  for (const format of Object.keys(data.formats)) {
    const rows = matchupRows(data, {format});
    near(rows.reduce((s,r) => s+r.rating,0)/8, 1500);
    for (const a of rows) for (const b of rows) {
      const h = headToHead(a,b);
      near(10**(h.ratingGap/400), a.lineup.total/b.lineup.total);
      near(1/(1+10**(-h.ratingGap/400)), h.projectionShare);
      near(h.edge, -headToHead(b,a).edge);
      near(h.projectionShare + headToHead(b,a).projectionShare, 1);
    }
  }
  assert.throws(() => powerRating(0,100));
});
test('Every scenario uses the precomputed legal lineup, with a fixed rating reference', () => {
  for (const format of Object.keys(data.formats)) {
    const base = matchupRows(data,{format});
    for (const scenario of ['absence','bye','flagged']) for (const week of [1,6,10,11,13,18]) {
      for (const row of matchupRows(data,{format,scenario,week})) {
        const source = data.formats[format].find(r => r.team===row.team);
        const expected = scenario==='absence' ? source.absences[source.worst.id]
          : scenario==='bye' ? source.byes[week] : source.flaggedOut;
        assert.deepEqual(row.lineup,expected);
        near(row.baselineRating,base.find(r=>r.team===row.team).rating);
        assert(row.rating <= row.baselineRating + 1e-9);
      }
    }
  }
});
test('Custom removals and independent optimistic pickups use the correct roster and source candidate', () => {
  for (const format of Object.keys(data.formats)) for (const source of data.formats[format]) {
    for (const [id,after] of Object.entries(source.absences)) {
      const row = matchupRows(data,{format,scenario:'absence',exclusions:{[source.team]:id},waivers:true}).find(r=>r.team===source.team);
      assert.deepEqual(row.lineup,after.wire);
      assert.equal(row.absentId,id);
      assert.equal(row.candidate.id,after.wire.candidate.id);
    }
  }
  assert.throws(()=>matchupRows(data,{scenario:'absence',exclusions:{Flames:'999'}}));
  assert.throws(()=>matchupRows(data,{week:0}));
});
test('All scrub positions expose only picks already made and the correct selected team history', () => {
  for (const team of data.teams) for (let pick=0;pick<=128;pick++) {
    const view = replayView(data,pick,team);
    assert.equal(view.roster.length,view.selected.count);
    assert(view.roster.every(p=>p.pick<=pick && p.team===team));
    assert.equal(view.history.length,pick+1);
    assert.equal(view.chosen?.pick??0,pick);
    near(view.history.at(-1).team,view.selected.total);
  }
  assert.throws(()=>replayView(data,129,'Flames'));
});
test('Weight views preserve the actual old ranking and all editorial grades', () => {
  for (const format of Object.keys(data.formats)) for (const preset of Object.keys(data.weights)) {
    const rows = gradeView(data,format,preset);
    assert.equal(rows.length,8);
    assert.equal(rows.find(r=>r.oldPlace===1).team,'Purple Rain');
    assert(rows.every((r,i)=>i===0 || rows[i-1].score>=r.score));
    assert(rows.every(r=>data.formats[format].some(s=>s.team===r.team && s.grade===r.grade)));
  }
});
