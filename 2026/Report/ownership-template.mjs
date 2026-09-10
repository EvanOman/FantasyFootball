const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const pct = value => `${Number(value.toFixed(1))}%`;

export function ownershipBars(view, { disabled = false } = {}) {
  return `<h3>Share of the top ${view.top}</h3><div class="ownership-axis" aria-hidden="true"><span>Team</span><div>${[0,1,2,3].map(i => `<span>${pct(view.maximum * i / 3)}</span>`).join('')}</div><span>Players · share</span></div>
  <div class="ownership-comparison" data-maximum="${view.maximum}">${view.rows.map(r => `<button type="button" class="ownership-team" data-share-team="${esc(r.team)}" aria-pressed="${r.team === view.team}"${disabled ? ' disabled' : ''} aria-label="${esc(r.team)}: ${r.count} of the top ${view.top}, ${pct(r.share)}, ${r.tied ? 'tied ' : ''}number ${r.place}. Show players."><span class="ownership-name">${esc(r.team)}</span><span class="ownership-track" aria-hidden="true"><span class="ownership-fill" data-count="${r.count}" data-share="${r.share}" style="width:${r.share / view.maximum * 100}%"></span></span><span class="ownership-stat"><b>${r.count}<small> / ${view.top}</small></b><span>${pct(r.share)}</span></span></button>`).join('')}</div>${view.undrafted ? `<p class="small">${view.undrafted} of these ${view.top} players were not drafted.</p>` : ''}`;
}

export function ownershipPlayers(view) {
  if (view.team === null) return '<p class="ownership-empty">Select a team’s bar to see its players.</p>';
  return `<h3>${esc(view.team)} <span>Top ${view.top} · ${view.players.length} ${view.players.length === 1 ? 'player' : 'players'}</span></h3>${view.players.length ? `<ol class="ownership-player-list">${view.players.map(p => `<li><b>#${p.rank}</b><span>${esc(p.name)}<small>${esc(p.position)} · pick ${p.pick}</small></span></li>`).join('')}</ol>` : '<p class="small">No players in this group.</p>'}`;
}

export function ownershipTable(cohorts, teams) {
  return `<table class="ownership-table"><caption>Cumulative counts and shares of ESPN’s 2026 rankings</caption><thead><tr><th>Team</th>${cohorts.map(c => `<th>Top ${c.top}</th>`).join('')}</tr></thead><tbody>${teams.map(team => `<tr><th>${esc(team)}</th>${cohorts.map(c => { const r = c.rows.find(r => r.team === team); return `<td>${r.count} <small>${pct(r.share)}</small></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
