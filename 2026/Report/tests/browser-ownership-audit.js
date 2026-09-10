(async () => {
  const $=s=>document.querySelector(s), assert=(ok,label)=>{if(!ok)throw Error(label);};
  const equal=(a,b,label)=>assert(JSON.stringify(a)===JSON.stringify(b),`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const data=await(await fetch('data/analysis.json')).json();
  const {rankOwnership,ownershipView}=await import('../Report/ownership-model.mjs');
  const cohorts=rankOwnership(data.players,data.teams);
  assert(document.documentElement.dataset.ownershipReady==='true','Ownership ready');
  $('#tab-report').click();
  assert(!$('#report').hidden,'Report visible');
  let combinations=0;
  for (const team of data.teams) for (const top of [10,20,30,40]) {
    const teamButton=[...document.querySelectorAll('[data-share-team]')].find(b=>b.dataset.shareTeam===team);
    teamButton.focus();teamButton.click();
    assert(document.activeElement===teamButton,'Team selection preserves keyboard focus');
    const cutoff=$(`[data-share-cutoff="${top}"]`);cutoff.focus();cutoff.click();
    assert(document.activeElement===cutoff,'Cutoff selection preserves keyboard focus');
    equal(document.querySelectorAll('[data-share-team][aria-pressed="true"]').length,1,'One selected team');
    equal(document.querySelectorAll('[data-share-cutoff][aria-pressed="true"]').length,1,'One selected group');
    const view=ownershipView(cohorts,team,top);
    for(const c of view.cohorts) {
      const row=$(`[data-cohort="${c.top}"]`), bar=row.querySelector('.ownership-bar'), selected=bar.querySelector('.highlighted');
      equal(row.querySelector('.ownership-stat b').textContent.trim(),`${c.selected.count} / ${c.top}`,'Count fraction');
      equal(selected?+selected.dataset.count:0,c.selected.count,'Highlighted segment count');
      if(selected) {
        equal(selected.dataset.owner,team,'Highlighted owner');
        assert(Math.abs(selected.getBoundingClientRect().width/bar.getBoundingClientRect().width*100-c.selected.share)<0.1,'Drawn percentage matches full-cohort denominator');
      }
      equal([...bar.querySelectorAll('[data-count]')].reduce((s,el)=>s+ +el.dataset.count,0),c.top,'Complete cohort');
      const label=row.querySelector('.ownership-stat > span').textContent;
      assert(label.includes(`${c.tied?'Tied ':''}#${c.place}`),'Tie/league place');
    }
    const list=[...document.querySelectorAll('.ownership-player-list li')];
    equal(list.length,view.players.length,'Player count');
    list.forEach((li,i)=>{assert(li.textContent.includes(view.players[i].name),'Player identity');equal(li.querySelector('b').textContent,`#${view.players[i].rank}`,'ESPN rank');});
    combinations++;
  }
  [...document.querySelectorAll('[data-share-team]')].find(b=>b.dataset.shareTeam==='Magic Skol Bus').click();
  $('[data-share-cutoff="30"]').click();
  for(const details of document.querySelectorAll('.roster-details')) {
    details.querySelector('summary').click();assert(details.open,'Roster expands');
    equal(details.querySelectorAll('.lineup tbody tr').length,10,'Full lineup with specialists');
    details.querySelector('summary').click();assert(!details.open,'Roster collapses');
  }
  $('#grades').querySelector('summary').click();assert($('#grades').open,'Grade basis opens');
  $('#grades').querySelector('summary').click();
  $('#method').open=false;$('a[href="#method"]').click();
  await new Promise(r=>setTimeout(r,60));assert($('#method').open,'Source fragment opens collapsed methodology');
  equal([...document.querySelectorAll('#report svg[role="img"]')].filter(s=>s.getBoundingClientRect().width>0).length,1,'One responsive curve is visible');
  assert(document.documentElement.scrollWidth<=innerWidth+1,'No page overflow');
  const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);equal(new Set(ids).size,ids.length,'Unique IDs');
  return {passed:true,combinations,fullLineups:8,viewport:`${innerWidth}×${innerHeight}`};
})();
