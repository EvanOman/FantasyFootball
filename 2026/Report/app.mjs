import { startOwnership } from './ownership-app.mjs';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = name => name.replace(/ (Jr\.|Sr\.|III)$/, '');
const tier = p => p.positionRank ? `${p.position === 'DST' ? 'D/ST' : p.position}${p.positionRank}` : 'Unranked';
const replayIds = new Set(['lab','replay']);
let stopPlayback = () => {};

function showTab() {
  const id = location.hash.slice(1) || 'report';
  const lab = replayIds.has(id);
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

async function startReplay() {
  const response = await fetch('data/analysis.json');
  if (!response.ok) throw Error(`Draft data could not be loaded (HTTP ${response.status}).`);
  const data = await response.json();
  startOwnership(data);
  const state = { pick:128, team:data.teams[0], position:'all' };
  let timer = null;
  const teamOptions = data.teams.map(team => `<option>${esc(team)}</option>`).join('');
  $('#replay-team').innerHTML = teamOptions;
  $('#replay-team').value = state.team;

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
    const view = { chosen:state.pick ? data.players[state.pick-1] : null,
      roster:data.players.filter(p => p.team === state.team && p.pick <= state.pick) };
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
    $('#replay-roster-title').textContent = `${state.team} · ${view.roster.length}/16 picks`;
    $('#replay-roster').innerHTML = view.roster.length ? `<table class="compact-table"><thead><tr><th>Pick</th><th>Player</th><th>ESPN tier</th></tr></thead><tbody>${view.roster.map(p=>`<tr><td>${p.pick}</td><th>${esc(p.name)}</th><td>${tier(p)}</td></tr>`).join('')}</tbody></table>` : '<p class="small">No selections yet. Move the slider or jump a round.</p>';
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

  renderReplay();
  $('#replay-loading').hidden=true;$('#replay-content').hidden=false;
  document.documentElement.dataset.replayReady='true';
  if (replayIds.has(location.hash.slice(1))) showTab();
}
startReplay().catch(error=>{
  $('#replay-loading').textContent=`${error.message} Reload the page to retry. The written report and downloadable data remain available.`;
  $('#replay-loading').setAttribute('role','alert');
  console.error(error);
});
