// Run inside the rendered page: agent-browser eval --stdin < tests/browser-replay-audit.js
(async () => {
  const $ = selector => document.querySelector(selector);
  const assert = (ok,message) => { if (!ok) throw Error(message); };
  const equal = (a,b,message) => assert(JSON.stringify(a)===JSON.stringify(b),`${message}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const change = (id,value,type='change') => { $(id).value=String(value);$(id).dispatchEvent(new Event(type,{bubbles:true})); };
  const click = id => $(id).click();
  const wait = async condition => {
    const deadline=Date.now()+5000;
    while (!condition()) {if(Date.now()>deadline)throw Error('Browser condition timed out');await new Promise(r=>setTimeout(r,20));}
  };
  await wait(()=>document.documentElement.dataset.replayReady==='true');
  const data=await (await fetch('data/analysis.json')).json();
  let checkedPicks=0;
  click('#tab-lab');await wait(()=>!$('#lab').hidden);
  change('#replay-team','Rome Reigns');
  for(let pick=0;pick<=128;pick++) {
    change('#pick-scrub',pick,'input');
    equal($('#pick-counter').textContent,`${pick} / 128`,'Scrub counter');
    equal(document.querySelectorAll('.draft-cell:not(.future)').length,pick,'Revealed pick count');
    equal(document.querySelectorAll('.draft-cell.current').length,pick?1:0,'Current pick marker');
    for(const cell of document.querySelectorAll('.draft-cell.future')) equal(cell.querySelector('span').textContent,'Not picked yet','Future player hidden');
    const count=data.players.filter(p=>p.team==='Rome Reigns' && p.pick<=pick).length;
    equal(document.querySelectorAll('#replay-roster tbody tr').length,count,'Cumulative roster');
    checkedPicks++;
  }
  click('[data-pick="77"]');assert($('#pick-detail').textContent.includes('Odell Beckham Jr.'),'Confirmed Beckham pick');
  click('[data-pick="84"]');assert($('#pick-detail').textContent.includes('Travis Etienne Jr.'),'Disclosed Etienne correction');
  click('#round-back');equal($('#pick-scrub').value,'80','Back to prior round end');
  click('#round-next');equal($('#pick-scrub').value,'88','Next round');
  click('#replay-end');
  for (const position of ['QB','RB','WR','TE','K','DST']) {
    change('#replay-position',position);
    equal(document.querySelectorAll('.draft-cell:not(.dimmed)').length,data.players.filter(p=>p.position===position).length,'Position highlight');
  }
  change('#replay-position','all');
  for (const team of data.teams) {
    change('#replay-team',team);
    equal(document.querySelectorAll('.draft-cell.followed').length,16,'Highlighted team');
    assert($('#replay-roster-title').textContent.includes(team),'Selected roster heading');
  }
  click('#replay-reset');click('#replay-play');
  await wait(()=>Number($('#pick-scrub').value)>=8);
  click('#replay-play');equal($('#replay-play').textContent,'Play','Pause');
  change('#pick-scrub',120,'input');click('#replay-play');
  await wait(()=>$('#pick-scrub').value==='128' && $('#replay-play').textContent==='Play');

  change('#pick-scrub',40,'input');click('#replay-play');click('#tab-report');
  await wait(()=>!$('#report').hidden && $('#lab').hidden);
  equal($('#replay-play').textContent,'Play','Changing tabs pauses playback');
  $('#tab-report').focus();$('.tab-buttons').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  await wait(()=>!$('#lab').hidden);equal(document.activeElement.id,'tab-lab','Keyboard tab activation');
  click('#replay a[href="#method"]');await wait(()=>!$('#report').hidden && $('#lab').hidden);
  assert($('#method').open,'Sources link opens details');
  $('#method').open=false;
  click('#tab-lab');await wait(()=>!$('#lab').hidden);
  change('#replay-team',data.teams[0]);change('#replay-position','all');click('#replay-end');
  for(const id of ['matchups','sensitivity','value-lab','lineup-comparison','replay-chart']) assert(!document.getElementById(id),`Removed view: ${id}`);
  equal($('#tab-lab').textContent,'Draft replay','Tab label');
  for(const select of document.querySelectorAll('#lab select')) assert(select.value!=='',`Prefilled ${select.id}`);
  for(const anchor of document.querySelectorAll('a[href^="#"]')) assert(document.getElementById(anchor.hash.slice(1)),`Valid anchor ${anchor.hash}`);
  assert(document.documentElement.scrollWidth<=innerWidth+1,'No page overflow');
  return {passed:true,checkedPicks,teams:8,positions:6,viewport:`${innerWidth}×${innerHeight}`,
    operations:'scrub, round jumps, confirmed picks, playback/pause/end, all positions/teams, keyboard tabs, source navigation'};
})();
