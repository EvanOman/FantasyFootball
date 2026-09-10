const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const pct = value => `${Number(value.toFixed(1))}%`;
const codes = { Flames:'FL', 'Clint Bilton':'CB', NKFL:'NK', Fauxgendaz:'FX', 'Purple Rain':'PR', 'Rome Reigns':'RR', 'Magic Skol Bus':'MS', 'Think Tank':'TT' };

export function ownershipBars(view, { disabled = false } = {}) {
  return view.cohorts.map(c => `<div class="ownership-row" data-cohort="${c.top}">
  <div class="ownership-row-label"><button type="button"${disabled ? ' disabled' : ''} data-share-cutoff="${c.top}" aria-pressed="${c.top === view.top}" aria-label="Show ${esc(view.team)} players in the top ${c.top}">Top ${c.top}</button><span class="ownership-stat"><b>${c.selected.count}<small> / ${c.top}</small></b><span>${pct(c.selected.share)}<small>${c.tied ? 'Tied ' : ''}#${c.place}</small></span></span></div>
  <div class="ownership-bar" role="img" aria-label="Top ${c.top}: ${c.rows.map(r => `${esc(r.team)} ${r.count} (${pct(r.share)})`).join('; ')}${c.undrafted ? `; undrafted ${c.undrafted}` : ''}">${c.ordered.filter(r => r.count).map(r => `<div class="ownership-segment${r.team === view.team ? ' highlighted' : ''}" data-owner="${esc(r.team)}" data-count="${r.count}" style="width:${r.share}%" title="${esc(r.team)}: ${r.count} of ${c.top} (${pct(r.share)})"><span class="segment-code">${codes[r.team] ?? esc(r.team)}</span><span>${r.count}</span></div>`).join('')}${c.undrafted ? `<div class="ownership-segment undrafted" style="width:${c.undrafted / c.top * 100}%" title="Undrafted: ${c.undrafted}"><span>${c.undrafted}</span></div>` : ''}</div></div>`).join('');
}

export function ownershipPlayers(view) {
  return `<h3>${esc(view.team)} <span>Top ${view.top} · ${view.players.length} ${view.players.length === 1 ? 'player' : 'players'}</span></h3>${view.players.length ? `<ol class="ownership-player-list">${view.players.map(p => `<li><b>#${p.rank}</b><span>${esc(p.name)}<small>${p.position} · pick ${p.pick}</small></span></li>`).join('')}</ol>` : '<p class="small">No players in this group.</p>'}`;
}

export function ownershipTable(cohorts, teams) {
  return `<table class="ownership-table"><caption>Cumulative counts and shares of ESPN’s 2026 rankings</caption><thead><tr><th>Team</th>${cohorts.map(c => `<th>Top ${c.top}</th>`).join('')}</tr></thead><tbody>${teams.map(team => `<tr><th>${esc(team)}</th>${cohorts.map(c => { const r = c.rows.find(r => r.team === team); return `<td>${r.count} <small>${pct(r.share)}</small></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
