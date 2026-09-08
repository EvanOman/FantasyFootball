// Run inside the rendered page: agent-browser eval --stdin < tests/browser-lab-audit.js
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
  const n = value => Number(value).toFixed(1);
  await wait(()=>document.documentElement.dataset.labReady==='true');
  const data=await (await fetch('data/analysis.json')).json();
  const players=new Map([...data.players,...Object.values(data.wire).flat()].map(p=>[p.id,p]));
  let checkedLineups=0, checkedPicks=0;
  click('#tab-lab');await wait(()=>!$('#lab').hidden);
  click('#matchup-reset');
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

  function checkComparison(format,scenario,week=10,wire=false) {
    const base=data.formats[format];
    const reference=Math.exp(base.reduce((sum,row)=>sum+Math.log(row.baseline.total),0)/8);
    const aTeam=$('#team-a').value,bTeam=$('#team-b').value;
    assert(aTeam!==bTeam,'Teams remain distinct');
    const selected=[aTeam,bTeam].map((team,i)=>{
      const row=base.find(r=>r.team===team);
      const absent=$(`#absent-${i?'b':'a'}`).value;
      return scenario==='absence' ? (wire?row.absences[absent].wire:row.absences[absent])
        : scenario==='bye' ? row.byes[week] : scenario==='flagged' ? row.flaggedOut : row.baseline;
    });
    const rendered=[...document.querySelectorAll('#lineup-comparison tbody tr')];
    equal(rendered.length,(format==='standard'?8:9)+2,'Full lineup row count');
    selected.forEach((lineup,side)=>{
      const team=side?bTeam:aTeam;
      const card=$(`.match-team.${side?'right':'left'}`);
      equal(card.querySelector('strong').textContent,n(1500+400*Math.log10(lineup.total/reference)),'Power rating from published totals');
      equal(card.querySelector('p b').textContent,n(lineup.perGame),'Projected total');
      lineup.slots.forEach((slot,i)=>{
        equal(rendered[i].cells[0].textContent,slot.slot,'Slot order');
        const text=rendered[i].cells[side?3:1].textContent;
        assert(text.includes(slot.id?players.get(slot.id).name:'Unfilled slot'),`${team} rendered player at ${slot.slot}`);
        const expected=slot.id?n(players.get(slot.id).points/17):'0.0';
        assert(text.includes(expected),`${team} published player points`);
      });
      for(const [i,position] of ['K','DST'].entries()) {
        const p=data.players.find(p=>p.team===team && p.position===position);
        assert(rendered[lineup.slots.length+i].cells[side?3:1].textContent.includes(p.name),'Specialist identity');
      }
      checkedLineups++;
    });
    equal($('.match-edge>strong').textContent,n(Math.abs(selected[0].perGame-selected[1].perGame)),'Head-to-head point edge');
    assert(document.documentElement.scrollWidth<=innerWidth+1,'No page-level overflow');
  }
  for(const format of ['standard','threeWR']) {
    change('#lineup-format',format);
    for(const scenario of ['baseline','absence','bye','flagged']) {
      change('#scenario',scenario);
      for(const team of data.teams) {change('#team-a',team);checkComparison(format,scenario);}
      if(scenario==='absence') {
        change('#team-a','Flames');change('#absent-a','1');
        checkComparison(format,scenario);
        $('#waiver-toggle').checked=true;$('#waiver-toggle').dispatchEvent(new Event('change',{bubbles:true}));
        checkComparison(format,scenario,10,true);
        $('#waiver-toggle').checked=false;$('#waiver-toggle').dispatchEvent(new Event('change',{bubbles:true}));
        change('#absent-b',$('#absent-b').options[1].value);checkComparison(format,scenario);
      }
      if(scenario==='bye') {
        for(let week=1;week<=18;week++){change('#bye-week',week);checkComparison(format,scenario,week);}
        change('#bye-week',10);
      }
    }
    for(const preset of ['balanced','starters','depth','value']) {
      change('#grade-preset',preset);
      const rows=[...document.querySelectorAll('#grade-comparison tbody tr')];
      equal(rows.length,8,'Eight grade rows');
      const ordered=[...data.formats[format]].sort((a,b)=>b.scores[preset]-a.scores[preset]||a.team.localeCompare(b.team));
      rows.forEach((tr,i)=>{assert(tr.cells[0].textContent.includes(ordered[i].team),'Grade order');assert(tr.cells[1].textContent.includes(n(ordered[i].scores[preset])),'Grade score');});
    }
  }
  click('#matchup-reset');change('#grade-preset','balanced');
  const initial=[$('#team-a').value,$('#team-b').value];click('#swap-teams');equal([$('#team-a').value,$('#team-b').value],initial.reverse(),'Swap');
  click('#matchup-matrix button[data-left="NKFL"][data-right="Think Tank"]');
  equal([$('#team-a').value,$('#team-b').value],['NKFL','Think Tank'],'Matrix drill-down');checkComparison('standard','baseline');
  click('#matchup-reset');checkComparison('standard','baseline');
  click('#tab-report');await wait(()=>!$('#report').hidden && $('#lab').hidden);
  $('#tab-report').focus();$('.tab-buttons').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  await wait(()=>!$('#lab').hidden);equal(document.activeElement.id,'tab-lab','Keyboard tab activation');
  click('a[href="#method"]');await wait(()=>!$('#report').hidden && $('#lab').hidden);
  click('#tab-lab');await wait(()=>!$('#lab').hidden);
  change('#replay-team','Rome Reigns');change('#replay-position','all');click('#replay-end');
  for(const select of document.querySelectorAll('#lab select')) assert(select.value!=='',`Prefilled ${select.id}`);
  for(const anchor of document.querySelectorAll('a[href^="#"]')) assert(document.getElementById(anchor.hash.slice(1)),`Valid anchor ${anchor.hash}`);
  return {passed:true,checkedPicks,checkedLineups,viewport:`${innerWidth}×${innerHeight}`,
    operations:'scrub, round jumps, board picks, playback/pause/end, all positions/teams, both formats, removals/pickups, every bye, availability, swap, matrix, weights, reset, keyboard tabs, source navigation'};
})();
