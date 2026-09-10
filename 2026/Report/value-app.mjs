import { historicalCurve, rosterCurve } from './value-model.mjs';
import { valueChart } from './value-template.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const n = value => Number(value).toFixed(1);
const signed = value => `${value > 0 ? '+' : ''}${n(value)}`;

export async function startValueLab(data) {
  const response = await fetch('data/history.json');
  if (!response.ok) throw Error(`Historical data could not be loaded (HTTP ${response.status}).`);
  const history = await response.json(), cache = new Map();
  $('#value-team').innerHTML = data.teams.map(team => `<option>${esc(team)}</option>`).join('');
  $('#value-team').value = 'Magic Skol Bus';
  function render() {
    const market = $('#value-market').value, sample = $('#value-years').value, wr = Number($('#value-format').value);
    const years = history.seasons.map(s => s.year).filter(y => sample === 'all' || (sample === 'early' ? y <= 2020 : sample === 'recent' ? y >= 2021 : y === Number(sample)));
    const key = `${market}/${sample}/${wr}`;
    if (!cache.has(key)) cache.set(key, historicalCurve(history, { format:market, wr, years }));
    const curve = cache.get(key), bandIndex = Number($('#value-band').value), band = curve.bands[bandIndex];
    const metric = $('#value-metric').value, cutoff = Number($('#value-cutoff').value), team = $('#value-team').value;
    $('#value-context').textContent = `${years[0]}${years.length > 1 ? `–${years.at(-1)}` : ''} · ${years.length * 140} matched offensive ADP observations · ${years.length * 10} players per band · ${8 * (6 + wr)} pooled offensive slots. Experimental view; published grades retain their fixed reference.`;
    $('#value-lab-chart').innerHTML = valueChart(curve, { metric, id:'explore-value-chart', selected:bandIndex });
    $('#value-band-detail').innerHTML = `<table><caption>Preseason ranks ${band.first}–${band.last} · each season contributes ten players</caption><thead><tr><th>Season</th><th>Mean total PPR / game</th><th>Mean positive value / game</th><th>Above replacement</th></tr></thead><tbody>${curve.seasons.map(s => {
      const b = s.bands[bandIndex];
      return `<tr><th>${s.year}</th><td>${n(b.points)}</td><td>${n(b.value)}</td><td>${b.positive} / 10</td></tr>`;
    }).join('')}<tr class="value-total"><th>Sample mean</th><td>${n(band.points)}</td><td>${n(band.value)}</td><td>${band.positive} / ${band.n}</td></tr></tbody></table>`;
    $('#value-cutoff-output').value = cutoff;
    const concentration = curve.concentration.find(c => c.top === cutoff);
    $('#value-concentration').innerHTML = `<div class="concentration-row"><span>Eventual top ${cutoff}</span><div><i style="width:${concentration.hindsight}%"></i></div><b>${n(concentration.hindsight)}%</b></div><div class="concentration-row preseason"><span>Preseason top ${cutoff}</span><div><i style="width:${concentration.preseason}%"></i></div><b>${n(concentration.preseason)}%</b></div><p class="caption">Share of all positive above-replacement value, averaged across the selected seasons. The eventual ranking is a hindsight ceiling. Breakouts outside the preseason top 140 still enter the denominator.</p>`;
    const last = curve.seasons.at(-1);
    $('#value-finishers').innerHTML = `<table><caption>${last.year} · eventual top ${cutoff} by positive value above replacement</caption><thead><tr><th>Value rank</th><th>Player</th><th>PPR position rank</th><th>Season PPR</th><th>Positive value / game</th></tr></thead><tbody>${last.finishers.slice(0, cutoff).map((p, i) => `<tr><td>${i + 1}</td><th>${esc(p.name)}</th><td>${p.position}${p.positionRank}</td><td>${n(p.points)}</td><td>${n(p.value)}</td></tr>`).join('')}</tbody></table>`;
    $('#value-replacement').innerHTML = `<table><caption>${last.year} · next unselected player at each position after filling ${8 * (6 + wr)} league slots</caption><thead><tr><th>Position</th><th>Selected starters</th><th>Replacement player</th><th>Season PPR baseline</th></tr></thead><tbody>${Object.entries(last.replacement.baseline).map(([pos, p]) => `<tr><th>${pos}</th><td>${last.replacement.counts[pos]}</td><td>${esc(p.name)} · ${pos}${p.rank}</td><td>${n(p.points)}</td></tr>`).join('')}</tbody></table>`;
    const teams = data.teams.map(team => ({ team, ...rosterCurve(data.players.filter(p => p.team === team), curve.bands) })).sort((a, b) => b.surplus - a.surplus);
    $('#value-teams').innerHTML = `<table><caption>2026 acquisitions under the selected historical curve · positive surplus is better</caption><thead><tr><th>Team</th><th>ESPN top ${cutoff}</th><th>Curve credits</th><th>Pick cost</th><th>Surplus</th></tr></thead><tbody>${teams.map(t => `<tr class="${t.team === team ? 'value-selected' : ''}"><th>${esc(t.team)}</th><td>${t.top[cutoff]}</td><td>${n(t.credit)}</td><td>${n(t.cost)}</td><td>${signed(t.surplus)}</td></tr>`).join('')}</tbody></table>`;
    const selected = teams.find(t => t.team === team);
    $('#value-picks').innerHTML = `<table><caption>${esc(team)} · each pick’s rank converted to curve credit</caption><thead><tr><th>Pick</th><th>Player</th><th>ESPN rank</th><th>Curve credit</th><th>Pick cost</th><th>Surplus</th></tr></thead><tbody>${data.players.filter(p => p.team === team).map(p => {
      const v = selected.picks.find(v => v.id === p.id);
      return `<tr><td>${p.pick}</td><th>${esc(p.name)}<small>${p.position === 'DST' ? 'D/ST' : p.position}</small></th><td>${p.rank ?? 'Unknown'}</td>${v ? `<td>${n(v.credit)}</td><td>${n(v.cost)}</td><td>${signed(v.surplus)}</td>` : '<td>Excluded</td><td>Excluded</td><td>Excluded</td>'}</tr>`;
    }).join('')}</tbody></table>`;
  }
  for (const id of ['market', 'years', 'format', 'metric', 'band', 'team']) $(`#value-${id}`).addEventListener('change', render);
  $('#value-cutoff').addEventListener('input', render);
  $('#value-reset').addEventListener('click', () => {
    for (const [id, value] of Object.entries({ market:'2qb', years:'all', format:'2', metric:'value', band:'0', cutoff:'30', team:'Magic Skol Bus' })) $(`#value-${id}`).value = value;
    render();
  });
  render();
  $('#value-loading').hidden = true;
  $('#value-content').hidden = false;
  document.documentElement.dataset.valueReady = 'true';
  if (location.hash === '#value-lab') $('#value-lab').scrollIntoView({ behavior:'instant', block:'start' });
}
