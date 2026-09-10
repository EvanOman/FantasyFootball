import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rankOwnership, ownershipView, CUTOFFS } from '../ownership-model.mjs';
import { ownershipBars, ownershipPlayers } from '../ownership-template.mjs';
import { valueChart } from '../value-template.mjs';
const data = JSON.parse(readFileSync(new URL('../data/analysis.json',import.meta.url)));
const cohorts = rankOwnership(data.players,data.teams);
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('This presentation change leaves all scoring, history calculations and original knitr output unchanged', () => {
  // Frozen before the report restructuring. Updating the model is a separate change.
  for (const [path,hash] of Object.entries({
    '../data/analysis.json':'d68d9b5895e300354b8220302ff3419c42387e4af43d5d3dc547cb74b5a36e37',
    '../data/value-analysis.json':'20fb738849a528242b913e681cc7cf603b9f4b387962b20f6aa7cb0d0a1b0cc0',
    '../../Draft/index.html':'9c1c416d5a09c739bf00733f5c097ded2441ede14c3261aabf3876c654d5cf2e'
  })) assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex'),hash);
});
test('All cohort counts use the full top-N denominator and reconcile to drafted identities', () => {
  assert.deepEqual(cohorts.map(c=>c.top),CUTOFFS);
  for (const c of cohorts) {
    assert.equal(c.undrafted,0);
    assert.equal(c.rows.reduce((s,r)=>s+r.count,0),c.top);
    assert(Math.abs(c.rows.reduce((s,r)=>s+r.share,0)-100)<1e-10);
    for (const r of c.rows) {
      assert.deepEqual(r.players,data.players.filter(p=>p.team===r.team && p.rank!==null && p.rank<=c.top).sort((a,b)=>a.rank-b.rank));
      assert.equal(r.share,r.count/c.top*100);
    }
  }
});
test('Magic leads the top 20 and 30, with correctly identified ties at 10 and 40', () => {
  const view=ownershipView(cohorts,'Magic Skol Bus');
  assert.deepEqual(view.cohorts.map(c=>c.selected.count),[2,5,8,8]);
  assert.deepEqual(cohorts[0].leaders,['Clint Bilton','Rome Reigns','Magic Skol Bus']);
  assert.deepEqual(cohorts[1].leaders,['Magic Skol Bus']);
  assert.deepEqual(cohorts[2].leaders,['Magic Skol Bus']);
  assert.deepEqual(cohorts[3].leaders,['Rome Reigns','Magic Skol Bus']);
  assert.deepEqual(view.cohorts.map(c=>c.tied),[true,false,false,true]);
});
test('Every team/cohort selection preserves cumulative membership and its true league place', () => {
  for (const team of data.teams) for (const top of CUTOFFS) {
    const view=ownershipView(cohorts,team,top);
    assert.equal(view.players.length,cohorts.find(c=>c.top===top).rows.find(r=>r.team===team).count);
    for (const c of view.cohorts) {
      assert.equal(c.ordered[0].team,team);
      assert.equal(c.ordered.length,8);
      assert.equal(c.place,1+c.rows.filter(r=>r.count>c.selected.count).length);
    }
  }
  assert.throws(()=>ownershipView(cohorts,'Not a team'));
  assert.throws(()=>ownershipView(cohorts,'Flames',25));
});
test('Undrafted players retain a share and duplicate ranked ownership is rejected', () => {
  const partial=rankOwnership(data.players.filter(p=>p.rank!==1),data.teams);
  assert.equal(partial[0].undrafted,1);
  assert.equal(partial[0].rows.reduce((s,r)=>s+r.share,0),90);
  assert.throws(()=>rankOwnership([...data.players,data.players.find(p=>p.rank===1)],data.teams));
  assert.throws(()=>rankOwnership(data.players,['Flames']));
});
test('Main report follows curve → shares → scorecards and removes rejected sections and copy', () => {
  const ids=['value-curve','rank-shares','team-reports'].map(id=>html.indexOf(`id="${id}"`));
  assert(ids.every(i=>i>0)); assert(ids[0]<ids[1] && ids[1]<ids[2]);
  for (const phrase of ['with receipts','with <em>receipts','Only the players who fit','Your second RB drafted','The bench has to cover','<section class="report-section" id="specialists"','class="hero"']) assert(!html.includes(phrase),phrase);
  assert.equal((html.match(/class="roster-details"/g)??[]).length,8);
  assert(html.includes('The top-10 lead') || html.includes('Its top-10 lead is shared'));
});
test('Ownership markup escapes player and team names; compact curve preserves all data dots', () => {
  const view=ownershipView(cohorts,'Magic Skol Bus');
  assert.equal((ownershipBars(view).match(/role="img"/g)??[]).length,4);
  const safe=ownershipPlayers({...view,team:'<script>',players:[{rank:1,name:'<img src=x>',position:'WR',pick:1}]});
  assert(safe.includes('&lt;script&gt;') && safe.includes('&lt;img src=x&gt;'));
  const curve=JSON.parse(readFileSync(new URL('../data/value-analysis.json',import.meta.url))).curves.standard;
  for (const compact of [false,true]) assert.equal((valueChart(curve,{compact}).match(/<circle /g)??[]).length,14);
});
