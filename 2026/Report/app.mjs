import { matchupRows, headToHead, replayView, gradeView } from './lab-model.mjs';
import { startValueLab } from './value-app.mjs';
import { startOwnership } from './ownership-app.mjs';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = value => Number(value).toFixed(1);
const signed = value => `${value > 0 ? '+' : ''}${n(value)}`;
const short = name => name.replace(/ (Jr\.|Sr\.|III)$/, '');
const tier = p => p.positionRank ? `${p.position === 'DST' ? 'D/ST' : p.position}${p.positionRank}` : 'Unranked';
const labIds = new Set(['lab','replay','matchups','sensitivity','value-lab']);
let stopPlayback = () => {};

function showTab() {
  const id = location.hash.slice(1) || 'report';
  const lab = labIds.has(id);
  $('#report').hidden = lab;
  $('#lab').hidden = !lab;
  for (const name of ['report','lab']) {
    const selected = name === (lab ? 'lab' : 'report');
    const tab = $(`#tab-${name}`);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle('active', selected);
  }
  if (!lab) stopPlayback();
  const target = document.getElementById(id);
  for (let detail = target?.closest('details'); detail; detail = detail.parentElement?.closest('details')) detail.open = true;
  if (target && location.hash) requestAnimationFrame(() => target.scrollIntoView({behavior:'instant',block:'start'}));
}
for (const name of ['report','lab']) $(`#tab-${name}`).addEventListener('click', () => {
  // Native fragment navigation can discard keyboard focus from the tab.
  if (location.hash !== `#${name}`) history.pushState(null,'',`#${name}`);
  showTab();
});
$('.tab-buttons').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const name = event.key === 'Home' ? 'report' : event.key === 'End' ? 'lab'
    : document.activeElement.id === 'tab-report' ? 'lab' : 'report';
  $(`#tab-${name}`).focus();
  $(`#tab-${name}`).click();
});
window.addEventListener('hashchange', showTab);
window.addEventListener('popstate', showTab);
showTab();

async function startLab() {
  const response = await fetch('data/analysis.json');
  if (!response.ok) throw Error(`Draft data could not be loaded (HTTP ${response.status}).`);
  const data = await response.json();
  startOwnership(data);
  const players = new Map([...data.players, ...Object.values(data.wire).flat()].map(p => [p.id,p]));
  const state = { pick:128, team:'Rome Reigns', position:'all', a:'Rome Reigns', b:'Magic Skol Bus',
    format:'standard', scenario:'baseline', week:10, exclusions:{}, waivers:false, preset:'balanced' };
  let timer = null;
  const teamOptions = data.teams.map(team => `<option>${esc(team)}</option>`).join('');
  for (const selector of ['#replay-team','#team-a','#team-b']) $(selector).innerHTML = teamOptions;
  $('#replay-team').value = state.team;
  $('#team-a').value = state.a;
  $('#team-b').value = state.b;

  function stop() {
    clearInterval(timer); timer = null;
    $('#replay-play').textContent = 'Play';
    $('#replay-play').setAttribute('aria-pressed','false');
  }
  stopPlayback = stop;
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  const board = $('#draft-board');
  board.innerHTML += `<thead><tr><th scope="col">Round</th>${data.teams.map(t=>`<th scope="col">${esc(t)}</th>`).join('')}</tr></thead><tbody>${Array.from({length:16},(_,i)=>{
    const round=i+1;
    return `<tr><th scope="row">${round}<small>${round%2?'→':'←'}</small></th>${data.teams.map(team=>{
      const p=data.players.find(p=>p.team===team && p.round===round);
      return `<td><button type="button" data-pick="${p.pick}" class="draft-cell"><small></small><span></span></button></td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody>`;
  const boardCells = [...board.querySelectorAll('[data-pick]')];

  function renderReplay() {
    const view = replayView(data,state.pick,state.team);
    $('#pick-scrub').value = state.pick;
    $('#pick-scrub').setAttribute('aria-valuetext', `After ${state.pick} of 128 picks`);
    $('#pick-counter').textContent = `${state.pick} / 128`;
    $('#round-counter').textContent = state.pick === 0 ? 'Before round 1' : state.pick === 128 ? 'Draft complete'
      : `Round ${Math.ceil(state.pick/8)} · pick ${(state.pick-1)%8+1} of 8`;
    $('#round-back').disabled = state.pick===0;
    $('#round-next').disabled = state.pick===128;
    $('#replay-reset').disabled = state.pick===0;
    $('#replay-end').disabled = state.pick===128;
    $('#pick-detail').innerHTML = view.chosen
      ? `<span class="pick-tag">Pick ${view.chosen.pick}</span><strong>${esc(view.chosen.team)}</strong><span>${esc(view.chosen.name)} <small>${esc(view.chosen.position)} · ESPN ${view.chosen.rank??'unranked'}</small></span>`
      : '<span class="pick-tag">Before pick 1</span><strong>The board is open.</strong><span>Flames is on the clock.</span>';
    for (const cell of boardCells) {
      const p = data.players[Number(cell.dataset.pick)-1];
      const seen = p.pick<=state.pick;
      cell.className = `draft-cell ${seen?`pos-${p.position}`:'future'}${p.pick===state.pick?' current':''}${p.team===state.team?' followed':''}${seen && state.position!=='all' && p.position!==state.position?' dimmed':''}`;
      cell.querySelector('small').textContent = seen ? `#${p.pick} · ${p.position==='DST'?'D/ST':p.position}` : `#${p.pick}`;
      cell.querySelector('span').textContent = seen ? short(p.name) : 'Not picked yet';
      cell.setAttribute('aria-label', `Jump to pick ${p.pick}, ${p.team}${seen?`, ${p.name}`:''}`);
      cell.setAttribute('aria-current', String(p.pick===state.pick));
    }
    $('#replay-stats').innerHTML = `<div><b>${n(view.selected.total)}</b><span>starting offense / 17</span></div><div><b>${view.selected.rankDiff===null?'—':n(view.selected.rankDiff)}</b><span>old mean rank gap · lower is better</span></div>`;
    const x=pick=>48+pick/128*570, y=value=>205-value/150*180;
    const path=key=>view.history.map((v,i)=>`${i?'L':'M'}${x(v.pick).toFixed(2)},${y(v[key]).toFixed(2)}`).join(' ');
    $('#replay-chart').innerHTML = `<svg viewBox="0 0 650 245" role="img" aria-labelledby="replay-chart-title"><title id="replay-chart-title">${esc(state.team)} and the leading projected lineup through pick ${state.pick}</title>${[0,50,100,150].map(v=>`<line class="gridline" x1="48" x2="618" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="36" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('')}${[0,32,64,96,128].map(v=>`<text class="axis" x="${x(v)}" y="230" text-anchor="middle">${v}</text>`).join('')}<path d="${path('leader')}" fill="none" stroke="#77796f" stroke-width="2" stroke-dasharray="5 5"/><path d="${path('team')}" fill="none" stroke="#9f3328" stroke-width="3"/><circle cx="${x(state.pick)}" cy="${y(view.selected.total)}" r="4" fill="#9f3328"/></svg>`;
    $('#replay-roster-title').textContent = `${state.team} · ${view.roster.length}/16 picks`;
    $('#replay-roster').innerHTML = view.roster.length ? `<table class="compact-table"><thead><tr><th>Pick</th><th>Player</th><th>ESPN tier</th></tr></thead><tbody>${view.roster.map(p=>`<tr><td>${p.pick}</td><th>${esc(p.name)}</th><td>${tier(p)}</td></tr>`).join('')}</tbody></table>` : '<p class="small">No selections yet. Move the slider or jump a round.</p>';
    $('#available-list').innerHTML = view.state.available.length ? view.state.available.map(p=>`<li>${esc(p.CanonicalPlayer)} <span>ESPN ${p.Rank} · ${p.Position}</span></li>`).join('') : '<li>All players are available before pick 1. The list appears after the first selection.</li>';
  }
  function setPick(pick) {
    state.pick = Math.max(0,Math.min(128,pick)); renderReplay();
    const scroller=$('.board-scroll'), current=board.querySelector('.current');
    if (!current) {scroller.scrollTop=0;return;}
    const bounds=scroller.getBoundingClientRect(), rect=current.getBoundingClientRect();
    if (bounds.height && (rect.top<bounds.top+52 || rect.bottom>bounds.bottom-8)) {
      scroller.scrollTop+=rect.top-bounds.top-(scroller.clientHeight-rect.height)/2;
    }
  }
  $('#pick-scrub').addEventListener('input',e=>{stop();setPick(Number(e.target.value));});
  $('#round-back').addEventListener('click',()=>{stop();setPick(Math.max(0,Math.ceil(state.pick/8)*8-8));});
  $('#round-next').addEventListener('click',()=>{stop();setPick(Math.floor(state.pick/8)*8+8);});
  $('#replay-reset').addEventListener('click',()=>{stop();setPick(0);});
  $('#replay-end').addEventListener('click',()=>{stop();setPick(128);});
  $('#replay-play').addEventListener('click',()=>{
    if (timer) {stop();return;}
    if (state.pick===128) setPick(0);
    $('#replay-play').textContent='Pause'; $('#replay-play').setAttribute('aria-pressed','true');
    timer=setInterval(()=>{setPick(state.pick+8);if(state.pick===128)stop();},1200);
  });
  board.addEventListener('click',e=>{const cell=e.target.closest('[data-pick]');if(cell){stop();setPick(Number(cell.dataset.pick));}});
  $('#replay-team').addEventListener('change',e=>{state.team=e.target.value;renderReplay();});
  $('#replay-position').addEventListener('change',e=>{state.position=e.target.value;renderReplay();});

  function fillAbsences() {
    for (const side of ['a','b']) {
      const row=data.formats[state.format].find(r=>r.team===state[side]);
      const select=$(`#absent-${side}`);
      select.innerHTML=Object.keys(row.absences).map(id=>`<option value="${id}">${esc(players.get(id).name)}${id===row.worst.id?' · worst loss':''}</option>`).join('');
      select.value=state.exclusions[row.team]??row.worst.id;
    }
  }
  function playerCell(slot, baseIds, scenario) {
    if (!slot.id) return '<span class="empty-slot">Unfilled slot</span><small>0.0 points</small>';
    const p=players.get(slot.id);
    return `${esc(p.name)}${!baseIds.has(slot.id)?'<span class="promotion">IN</span>':''}<small>${tier(p)} · ${n(p.points/17)} pts / 17${scenario==='bye'?` · bye ${p.bye??'unknown'}`:''}</small>`;
  }
  function renderMatchups() {
    fillAbsences();
    $('#absence-controls').hidden=state.scenario!=='absence';
    $('#week-control').hidden=state.scenario!=='bye';
    const rows=matchupRows(data,state);
    const a=rows.find(r=>r.team===state.a), b=rows.find(r=>r.team===state.b);
    const match=headToHead(a,b);
    const notes={baseline:'Uses the submitted roster and published season totals. A player modeled for fewer games keeps that reduced total.',absence:'Reoptimizes every roster after one removal. This measures coverage, not the probability of an injury.',bye:`Removes Week ${state.week} bye players, then reoptimizes. Remaining season-average projections are not Week ${state.week} forecasts.`,flagged:'Excludes Jacobs, Charbonnet, and Pacheco on their dated September 7 status snapshot. Other injury notes remain informational; missing notes do not certify health.'};
    $('#scenario-note').textContent=notes[state.scenario];
    const scoreCard=(row,side)=>`<div class="match-team ${side}"><p class="eyebrow">${esc(row.team)}</p><strong>${n(row.rating)}</strong><span>Elo-style power</span><p><b>${n(row.lineup.perGame)}</b> offensive pts / 17</p><small>${row.loss>0?`${n(row.loss)} below baseline`:row.loss<0?`${n(-row.loss)} above baseline`:'Baseline lineup'} · ${row.lineup.emptySlots} unfilled</small></div>`;
    $('#matchup-summary').innerHTML=`${scoreCard(a,'left')}<div class="match-edge"><span>${match.edge===0?'Level projection':`${esc(match.edge>0?a.team:b.team)} leads`}</span><strong>${n(Math.abs(match.edge))}</strong><span>offensive points / 17</span><div class="share-bar" role="img" aria-label="${esc(a.team)} has ${n(match.projectionShare*100)} percent of the pair’s projected offense, not a win probability"><i style="width:${match.projectionShare*100}%"></i></div><small>Point share ${n(match.projectionShare*100)}% / ${n((1-match.projectionShare)*100)}%</small></div>${scoreCard(b,'right')}`;
    const aIds=new Set(a.baseline.slots.map(s=>s.id)), bIds=new Set(b.baseline.slots.map(s=>s.id));
    $('#lineup-comparison').innerHTML=`<table class="head-to-head"><caption>${esc(a.team)} vs ${esc(b.team)} · optimal legal offensive lineups plus specialists</caption><thead><tr><th>Slot</th><th>${esc(a.team)}</th><th>Left edge / 17</th><th>${esc(b.team)}</th></tr></thead><tbody>${a.lineup.slots.map((slot,i)=>{
      const other=b.lineup.slots[i]; const edge=((players.get(slot.id)?.points??0)-(players.get(other.id)?.points??0))/17;
      return `<tr><th>${slot.slot}</th><td>${playerCell(slot,aIds,state.scenario)}</td><td class="edge ${edge>0?'positive':edge<0?'negative':''}">${signed(edge)}</td><td>${playerCell(other,bIds,state.scenario)}</td></tr>`;
    }).join('')}${['K','DST'].map(pos=>`<tr class="specialist-row"><th>${pos==='DST'?'D/ST':pos}</th>${[a,b].map((row,i)=>{
      const p=data.players.find(p=>p.team===row.team && p.position===pos);
      return `${i===1?'<td class="edge">Not modeled</td>':''}<td>${esc(p.name)}<small>${tier(p)} · bye ${p.bye}${state.scenario==='bye' && p.bye===state.week?' · NEEDS COVER':''}</small></td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
    $('#comparison-notes').innerHTML=[a,b].map(row=>{
      const removed=row.absentId?players.get(row.absentId):null;
      const baseIds=new Set(row.baseline.slots.map(s=>s.id));
      const incoming=row.lineup.slots.filter(s=>s.id && !baseIds.has(s.id)).map(s=>players.get(s.id).name);
      const outgoing=row.baseline.slots.filter(s=>s.id && !row.lineup.slots.some(t=>t.id===s.id)).map(s=>players.get(s.id).name);
      const news=data.availability.filter(note=>data.players.some(p=>p.team===row.team && p.name===note.name));
      return `<div><h4>${esc(row.team)}</h4>${removed?`<p>Removed: ${esc(removed.name)}.</p>`:''}${outgoing.length?`<p>Out of starting lineup: ${outgoing.map(esc).join(', ')}.<br>Promoted: ${incoming.length?incoming.map(esc).join(', '):'no new starters'}.</p>`:'<p>No starters change from baseline.</p>'}${row.candidate?`<p>Optimistic pickup: ${esc(row.candidate.name)}${row.lineup.slots.some(s=>s.id===row.candidate.id)?' enters the lineup':' stays on the bench'}. Current availability is unverified.</p>`:''}<p>Offensive bench: ${row.lineup.bench.length?row.lineup.bench.map(id=>esc(short(players.get(id).name))).join(', '):'none available'}.</p>${news.length?`<details><summary>${news.length} dated availability notes</summary>${news.map(note=>{const source=data.sources.find(s=>s.id===note.source);return `<p><strong>${esc(note.name)}.</strong> ${esc(note.note)} <a href="${esc(source.url)}">${source.date}</a></p>`;}).join('')}</details>`:''}</div>`;
    }).join('');
    $('#power-table').innerHTML=`<table class="power-table"><caption>Elo-style power · current scenario · ${state.format==='standard'?'confirmed 2-WR':'3-WR sensitivity'} format</caption><thead><tr><th>Team</th><th>Baseline power</th><th>Scenario power</th><th>Offense / 17</th><th>Old rank gap ↓</th></tr></thead><tbody>${rows.map(row=>`<tr class="${[state.a,state.b].includes(row.team)?'compared':''}"><th>${esc(row.team)}</th><td>${n(row.baselineRating)}</td><td>${n(row.rating)}</td><td>${n(row.lineup.perGame)}</td><td>${n(row.rankDiff)}</td></tr>`).join('')}</tbody></table>`;
    const labels=['FL','CB','NK','FX','PR','RR','MS','TT'];
    $('#matchup-matrix').innerHTML=`<table class="matrix"><caption>All pairs · row minus column · offensive pts / 17</caption><thead><tr><th>Row team</th>${data.teams.map((t,i)=>`<th><abbr title="${esc(t)}">${labels[i]}</abbr></th>`).join('')}</tr></thead><tbody>${data.teams.map(team=>{
      const left=rows.find(r=>r.team===team);
      return `<tr><th>${esc(team)}</th>${data.teams.map(other=>{
        const edge=headToHead(left,rows.find(r=>r.team===other)).edge;
        return team===other?'<td class="diagonal">—</td>':`<td><button data-left="${esc(team)}" data-right="${esc(other)}" class="${edge>0?'positive':edge<0?'negative':''}" aria-label="Compare ${esc(team)} with ${esc(other)}, row edge ${signed(edge)} points">${signed(edge)}</button></td>`;
      }).join('')}</tr>`;
    }).join('')}</tbody></table>`;
    renderGrades();
  }
  function renderGrades() {
    const rows=gradeView(data,state.format,state.preset);
    $('#grade-note').textContent=`${state.format==='standard'?'Confirmed 2-WR':'Three-WR sensitivity'} format; baseline rosters. These draft grades do not change with the matchup desk’s absence or bye controls.`;
    $('#grade-comparison').innerHTML=`<table class="grade-comparison"><caption>Current emphasis versus the legacy score</caption><thead><tr><th>Team</th><th>Index & place</th><th>Old rank gap & place</th><th>ESPN value surplus</th><th>Best lineup salary value</th><th>Historical curve surplus</th></tr></thead><tbody>${rows.map(row=>`<tr><th>${esc(row.team)} <small>${row.grade}</small></th><td><div class="index-bar"><i style="width:${row.score}%"></i></div>${n(row.score)} · #${row.place}</td><td>${n(row.rankDiff)} · #${row.oldPlace}</td><td>${signed(row.valueSurplus)}</td><td>${row.starterSalary}</td><td>${signed(row.curveSurplus)}</td></tr>`).join('')}</tbody></table>`;
  }
  function selectTeams(side,value) {
    const other=side==='a'?'b':'a';
    if (state[other]===value) state[other]=state[side];
    state[side]=value;
    $('#team-a').value=state.a; $('#team-b').value=state.b;
    renderMatchups();
  }
  for (const side of ['a','b']) {
    $(`#team-${side}`).addEventListener('change',e=>selectTeams(side,e.target.value));
    $(`#absent-${side}`).addEventListener('change',e=>{state.exclusions[state[side]]=e.target.value;renderMatchups();});
  }
  $('#swap-teams').addEventListener('click',()=>{[state.a,state.b]=[state.b,state.a];$('#team-a').value=state.a;$('#team-b').value=state.b;renderMatchups();});
  $('#lineup-format').addEventListener('change',e=>{state.format=e.target.value;renderMatchups();});
  $('#scenario').addEventListener('change',e=>{state.scenario=e.target.value;renderMatchups();});
  $('#bye-week').addEventListener('change',e=>{state.week=Number(e.target.value);renderMatchups();});
  $('#waiver-toggle').addEventListener('change',e=>{state.waivers=e.target.checked;renderMatchups();});
  $('#grade-preset').addEventListener('change',e=>{state.preset=e.target.value;renderGrades();});
  $('#matchup-reset').addEventListener('click',()=>{
    Object.assign(state,{a:'Rome Reigns',b:'Magic Skol Bus',format:'standard',scenario:'baseline',week:10,exclusions:{},waivers:false});
    for (const [id,key] of [['team-a','a'],['team-b','b'],['lineup-format','format'],['scenario','scenario'],['bye-week','week']]) $(`#${id}`).value=state[key];
    $('#waiver-toggle').checked=false;renderMatchups();
  });
  $('#matchup-matrix').addEventListener('click',e=>{
    const cell=e.target.closest('[data-left]');if(!cell)return;
    state.a=cell.dataset.left;state.b=cell.dataset.right;
    $('#team-a').value=state.a;$('#team-b').value=state.b;renderMatchups();
    $('#matchup-title').scrollIntoView({behavior:'smooth',block:'start'});
  });
  renderReplay(); renderMatchups();
  $('#lab-loading').hidden=true;$('#lab-content').hidden=false;
  document.documentElement.dataset.labReady='true';
  startValueLab(data).catch(error => {
    $('#value-loading').textContent = `${error.message} Reload to retry. The written findings and other Lab views remain available.`;
    $('#value-loading').setAttribute('role','alert');
    console.error(error);
  });
  if (labIds.has(location.hash.slice(1))) showTab();
}
startLab().catch(error=>{
  $('#lab-loading').textContent=`${error.message} Reload the page to retry. The written report and downloadable data remain available.`;
  $('#lab-loading').setAttribute('role','alert');
  console.error(error);
});
