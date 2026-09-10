(async () => {
  const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
  const assert=(ok,label)=>{if(!ok)throw Error(label);};
  const equal=(a,b,label)=>assert(JSON.stringify(a)===JSON.stringify(b),`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const data=await(await fetch('data/analysis.json')).json();
  const curve=(await(await fetch('data/value-analysis.json')).json()).curves.standard;
  const {rankOwnership,ownershipView}=await import('../Report/ownership-model.mjs');
  const cohorts=rankOwnership(data.players,data.teams);
  assert(document.documentElement.dataset.ownershipReady==='true','Ownership ready');
  $('#tab-report').click();
  equal(all('.team-report[open]').length,0,'All scorecards initially collapsed');
  equal(all('[data-share-team][aria-pressed="true"]').length,0,'No default team selection');
  equal(all('.ownership-fill').map(el=>getComputedStyle(el).backgroundColor).filter((c,i,a)=>a.indexOf(c)===i).length,1,'All teams use the same bar color');
  let combinations=0;
  for (const team of data.teams) for (const top of [10,20,30,40]) {
    const cutoff=$(`[data-share-cutoff="${top}"]`);cutoff.focus();cutoff.click();
    assert(document.activeElement===cutoff,'Cutoff selection preserves keyboard focus');
    const teamButton=all('[data-share-team]').find(b=>b.dataset.shareTeam===team);
    teamButton.focus();teamButton.click();
    assert(document.activeElement===teamButton,'Team selection preserves keyboard focus');
    equal(all('[data-share-team][aria-pressed="true"]').length,1,'One explicitly selected team');
    equal(all('[data-share-cutoff][aria-pressed="true"]').length,1,'One selected group');
    const view=ownershipView(cohorts,team,top), buttons=all('[data-share-team]');
    equal(buttons.map(b=>b.dataset.shareTeam),view.rows.map(r=>r.team),'Data-sorted order, including stable ties');
    for(const [i,r] of view.rows.entries()) {
      const row=buttons[i],fill=row.querySelector('.ownership-fill'),track=row.querySelector('.ownership-track');
      equal(row.querySelector('.ownership-stat b').textContent,`${r.count} / ${top}`,'Count fraction');
      equal(+fill.dataset.count,r.count,'Bar count');
      equal(+fill.dataset.share,r.share,'Percentage');
      assert(Math.abs(fill.getBoundingClientRect().width/track.getBoundingClientRect().width*view.maximum-r.share)<0.1,'Rendered width matches the labeled shared scale');
      assert(row.getAttribute('aria-label').includes(`${r.tied?'tied ':''}number ${r.place}`),'Tie-aware rank');
    }
    equal(view.rows.reduce((s,r)=>s+r.count,0),top,'Full cohort');
    const list=all('.ownership-player-list li');
    equal(list.length,view.players.length,'Player count');
    list.forEach((li,i)=>{assert(li.textContent.includes(view.players[i].name),'Player identity');equal(li.querySelector('b').textContent,`#${view.players[i].rank}`,'ESPN rank');});
    combinations++;
  }
  $('#ownership-clear').click();
  equal(all('[data-share-team][aria-pressed="true"]').length,0,'Clear restores neutral view');
  assert($('#ownership-clear').hidden,'Clear hidden when no team selected');
  assert(document.activeElement.matches('[data-share-cutoff]'),'Clear returns focus to cutoff');
  $('[data-share-cutoff="30"]').click();
  for(const details of all('.team-report')) {
    const summary=details.querySelector('summary');summary.focus();summary.click();
    assert(details.open && details.querySelector('.scorecard-body').getBoundingClientRect().height>0,'Assessment expands');
    assert(document.activeElement===summary,'Scorecard retains keyboard focus');
    const roster=details.querySelector('.roster-details');roster.querySelector('summary').click();
    assert(roster.open,'Roster expands');equal(roster.querySelectorAll('.lineup tbody tr').length,10,'Full lineup with specialists');
    roster.querySelector('summary').click();assert(!roster.open,'Roster collapses');
    summary.click();assert(!details.open,'Assessment collapses');
  }
  $('#grades').querySelector('summary').click();assert($('#grades').open,'Grade basis opens');
  $('#grades a[href^="#team-"]').click();
  await new Promise(r=>setTimeout(r,80));assert(all('.team-report[open]').length===1,'Deep link opens selected scorecard');
  all('.team-report').forEach(d=>d.open=false);$('#grades').open=false;
  $('#method').open=false;$('a[href="#method"]').click();
  await new Promise(r=>setTimeout(r,80));assert($('#method').open,'Source fragment opens methodology');
  equal(all('#report svg[role="img"]').filter(s=>s.getBoundingClientRect().width>0).length,3,'Three visible evidence charts');
  for(const dot of all('#yearly-concentration [data-year]')) {
    const value=curve.seasons.find(s=>s.year===+dot.dataset.year).concentration.find(c=>c.top===+dot.dataset.top).preseason;
    equal(+dot.dataset.share,value,'Seasonal share');equal(+dot.getAttribute('cy'),232-value*1.7,'Seasonal geometry');
  }
  equal(all('#yearly-concentration [data-year]').length,20,'Twenty season/cohort points');
  for(const dot of all('#hindsight-concentration [data-basis]')) {
    const value=curve.concentration.find(c=>c.top===+dot.dataset.top)[dot.dataset.basis];
    equal(+dot.dataset.share,value,'Hindsight/preseason share');equal(+dot.getAttribute('cx'),75+value*3.2,'Concentration geometry');
  }
  equal(all('#hindsight-concentration [data-basis]').length,8,'Eight comparison points');
  assert(document.documentElement.scrollWidth<=innerWidth+1,'No page overflow');
  const ids=all('[id]').map(el=>el.id);equal(new Set(ids).size,ids.length,'Unique IDs');
  $('#method').open=false;
  return {passed:true,combinations,scorecards:8,evidencePoints:28,viewport:`${innerWidth}×${innerHeight}`};
})();
