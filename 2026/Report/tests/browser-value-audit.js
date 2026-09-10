// Run after data-value-ready=true, at desktop and mobile widths.
(async () => {
  const $ = s => document.querySelector(s);
  const assert = (ok, label) => { if (!ok) throw Error(label); };
  const equal = (a,b,label) => assert(JSON.stringify(a) === JSON.stringify(b), `${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const n = v => Number(v).toFixed(1), signed = v => `${v > 0 ? '+' : ''}${n(v)}`;
  const data = await (await fetch('data/analysis.json')).json();
  const history = await (await fetch('data/history.json')).json();
  const { historicalCurve, rosterCurve } = await import('../Report/value-model.mjs');
  const change = (id,value,event='change') => { $(`#value-${id}`).value=String(value); $(`#value-${id}`).dispatchEvent(new Event(event,{bubbles:true})); };
  const cells = tr => [...tr.cells].map(c => c.textContent.trim());
  assert(document.documentElement.dataset.valueReady === 'true','History loaded');
  $('#tab-lab').click();
  $('a[href="#value-lab"]').click();
  await new Promise(resolve=>setTimeout(resolve,80));
  assert(!$('#lab').hidden && $('#report').hidden,'Deep link opens Lab');
  let combinations=0, checkedPickRows=0;
  for (const market of ['2qb','ppr']) for (const wr of [2,3]) for (const sample of ['all','early','recent',...history.seasons.map(s=>String(s.year))]) {
    change('market',market);change('format',wr);change('years',sample);
    const years=history.seasons.map(s=>s.year).filter(y=>sample==='all'||(sample==='early'?y<=2020:sample==='recent'?y>=2021:y===+sample));
    const c=historicalCurve(history,{format:market,wr,years});
    const b=c.bands[0], last=c.seasons.at(-1);
    const means=cells($('#value-band-detail tbody tr:last-child'));
    equal(means,['Sample mean',n(b.points),n(b.value),`${b.positive} / ${b.n}`],'Band arithmetic');
    const concentrations=[...$('#value-concentration').querySelectorAll('b')].map(el=>el.textContent);
    equal(concentrations,[`${n(c.concentration[2].hindsight)}%`,`${n(c.concentration[2].preseason)}%`],'Value shares');
    const expected=data.teams.map(team=>({team,...rosterCurve(data.players.filter(p=>p.team===team),c.bands)})).sort((a,b)=>b.surplus-a.surplus);
    const rendered=[...$('#value-teams').querySelectorAll('tbody tr')];
    equal(rendered.length,8,'All team scores');
    rendered.forEach((tr,i)=>{const t=expected[i];equal(cells(tr),[t.team,String(t.top[30]),n(t.credit),n(t.cost),signed(t.surplus)],'Team curve score');});
    equal($('#value-finishers tbody tr').cells[1].textContent,last.finishers[0].name,'Correct final season leader');
    assert(!$('#value-lab-chart').innerHTML.includes('NaN'),'Finite chart geometry');
    combinations++;
  }
  $('#value-reset').click();
  for (let band=0;band<14;band++) {
    change('band',band);
    assert($('#value-band-detail caption').textContent.includes(`${band*10+1}–${band*10+10}`),'Band selection');
    equal($('#value-lab-chart').querySelectorAll('circle[r="7"]').length,1,'One highlighted chart dot');
  }
  for (const metric of ['points','value']) {
    change('metric',metric);
    assert($('#explore-value-chart-title').textContent.includes(metric==='points'?'Actual PPR points':'Positive points above replacement'),'Measure changes');
  }
  for (const cutoff of [10,20,30,40]) {
    change('cutoff',cutoff,'input');
    equal($('#value-cutoff-output').value,String(cutoff),'Slider output');
    equal($('#value-finishers').querySelectorAll('tbody tr').length,cutoff,'Finisher cutoff');
    assert($('#value-teams thead').textContent.includes(`top ${cutoff}`),'Team cutoff');
  }
  const c=historicalCurve(history);
  for (const team of data.teams) {
    change('team',team);
    const roster=data.players.filter(p=>p.team===team), curve=rosterCurve(roster,c.bands);
    const trs=[...$('#value-picks').querySelectorAll('tbody tr')];
    equal(trs.length,16,'All picks including specialists');
    trs.forEach((tr,i)=>{
      const p=roster[i], credit=curve.picks.find(v=>v.id===p.id), values=cells(tr);
      equal(values[0],String(p.pick),'Actual pick order');assert(values[1].includes(p.name),'Player identity');
      equal(values.slice(2),[String(p.rank??'Unknown'),...(credit?[n(credit.credit),n(credit.cost),signed(credit.surplus)]:['Excluded','Excluded','Excluded'])],'Per-pick credit/cost/surplus');
      checkedPickRows++;
    });
  }
  $('#value-reset').click();
  for(const [id,value] of Object.entries({market:'2qb',years:'all',format:'2',metric:'value',band:'0',cutoff:'30',team:'Magic Skol Bus'})) equal($(`#value-${id}`).value,value,'Reset');
  for (const a of document.querySelectorAll('a[href^="#"]')) assert(document.getElementById(a.hash.slice(1)),`Anchor ${a.hash}`);
  const duplicateIds=[...document.querySelectorAll('[id]')].map(el=>el.id).filter((id,i,all)=>all.indexOf(id)!==i);
  equal(duplicateIds,[],'Unique DOM identifiers');
  assert(document.documentElement.scrollWidth <= innerWidth+1,'No page overflow');
  return {passed:true,combinations,checkedPickRows,bands:14,cutoffs:4,viewport:`${innerWidth}×${innerHeight}`};
})();
