import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rankOwnership, ownershipView, CUTOFFS } from '../ownership-model.mjs';
import { ownershipBars, ownershipPlayers } from '../ownership-template.mjs';
import { valueChart } from '../value-template.mjs';
import { yearlyConcentrationChart, hindsightConcentrationChart } from '../evidence-template.mjs';
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
  const selected=CUTOFFS.map(top=>ownershipView(cohorts,'Magic Skol Bus',top).rows.find(r=>r.team==='Magic Skol Bus'));
  assert.deepEqual(selected.map(r=>r.count),[2,5,8,8]);
  assert.deepEqual(cohorts[0].leaders,['Clint Bilton','Rome Reigns','Magic Skol Bus']);
  assert.deepEqual(cohorts[1].leaders,['Magic Skol Bus']);
  assert.deepEqual(cohorts[2].leaders,['Magic Skol Bus']);
  assert.deepEqual(cohorts[3].leaders,['Rome Reigns','Magic Skol Bus']);
  assert.deepEqual(selected.map(r=>r.tied),[true,false,false,true]);
});
test('Every team/cohort selection preserves cumulative membership and its true league place', () => {
  for (const team of data.teams) for (const top of CUTOFFS) {
    const view=ownershipView(cohorts,team,top);
    assert.equal(view.players.length,cohorts.find(c=>c.top===top).rows.find(r=>r.team===team).count);
    assert.equal(view.rows.length,8);
    assert.equal(view.maximum,30);
    for (const r of view.rows) {
      assert.equal(r.place,1+view.rows.filter(other=>other.count>r.count).length);
      assert.equal(r.tied,view.rows.filter(other=>other.count===r.count).length>1);
    }
    assert.deepEqual(view.rows.map(r=>r.count),view.rows.map(r=>r.count).sort((a,b)=>b-a));
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
test('Main report follows collapsed scorecards → evidence → shares; replay is the only second-tab view', () => {
  const ids=['team-reports','value-curve','rank-shares'].map(id=>html.indexOf(`id="${id}"`));
  assert(ids.every(i=>i>0)); assert(ids[0]<ids[1] && ids[1]<ids[2]);
  for (const phrase of ['with receipts','with <em>receipts','Only the players who fit','Your second RB drafted','The bench has to cover','<section class="report-section" id="specialists"','class="hero"']) assert(!html.includes(phrase),phrase);
  assert.equal((html.match(/class="roster-details"/g)??[]).length,8);
  assert.equal((html.match(/<details class="team-report"[^>]*>/g)??[]).length,8);
  assert(!/<details class="team-report"[^>]*\bopen\b/.test(html));
  assert(html.includes('Evan’s hypothesis'));
  for(const phrase of ['Magic has 8','Magic leads outright','Draft Lab','id="matchups"','id="sensitivity"','id="value-lab"','id="replay-chart"']) assert(!html.includes(phrase),phrase);
  assert(html.includes('id="pick-scrub"'));
});
test('Ownership markup escapes player and team names; compact curve preserves all data dots', () => {
  const view=ownershipView(cohorts,'Magic Skol Bus');
  assert.equal((ownershipBars(view).match(/class="ownership-team"/g)??[]).length,8);
  const safe=ownershipPlayers({...view,team:'<script>',players:[{rank:1,name:'<img src=x>',position:'WR',pick:1}]});
  assert(safe.includes('&lt;script&gt;') && safe.includes('&lt;img src=x&gt;'));
  const curve=JSON.parse(readFileSync(new URL('../data/value-analysis.json',import.meta.url))).curves.standard;
  for (const compact of [false,true]) assert.equal((valueChart(curve,{compact}).match(/<circle /g)??[]).length,14);
});
test('Neutral defaults and stable tie order let concentration emerge from the counts', () => {
  const view=ownershipView(cohorts);
  assert.equal(view.team,null);assert.equal(view.top,30);assert.deepEqual(view.players,[]);
  assert.equal((ownershipBars(view).match(/aria-pressed="true"/g)??[]).length,0);
  assert.equal(view.rows[0].team,'Magic Skol Bus');
  assert.equal(view.rows[0].count,8);assert.equal(view.rows[1].count,5);
  assert.deepEqual(ownershipView(cohorts,null,40).rows.slice(0,2).map(r=>r.team),['Rome Reigns','Magic Skol Bus']);
  const renamed=data.teams.map((_,i)=>`Team ${i}`);
  const anonymous=rankOwnership(data.players.map(p=>({...p,team:renamed[data.teams.indexOf(p.team)]})),renamed);
  assert.deepEqual(ownershipView(anonymous).rows.map(r=>r.count),view.rows.map(r=>r.count));
});
test('New charts render the frozen seasonal and hindsight shares without fitting new data', () => {
  const curve=JSON.parse(readFileSync(new URL('../data/value-analysis.json',import.meta.url))).curves.standard;
  const yearly=yearlyConcentrationChart(curve), paired=hindsightConcentrationChart(curve);
  assert.equal((yearly.match(/data-year=/g)??[]).length,20);
  assert.equal((paired.match(/data-basis=/g)??[]).length,8);
  for(const season of curve.seasons) for(const top of [30,40]) {
    const share=season.concentration.find(c=>c.top===top).preseason;
    assert(yearly.includes(`data-year="${season.year}" data-top="${top}" data-share="${share}"`));
  }
  for(const c of curve.concentration) for(const basis of ['preseason','hindsight']) assert(paired.includes(`data-top="${c.top}" data-basis="${basis}" data-share="${c[basis]}"`));
  assert(html.includes('do not establish top-30 or top-40 counts as the strongest predictor'));
  assert(html.includes('50.2–67.0%') && html.includes('58.8%') && html.includes('89.9%'));
});
