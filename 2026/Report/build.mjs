import { readFileSync, writeFileSync } from 'node:fs';
import { joinPlayers, summarize, optimize, availableAt, OFFENSE, WEIGHTS } from './analysis.mjs';
import { teams as copy, sources, availability } from './content.mjs';
import { labTemplate } from './lab-template.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const write = (name, value) => writeFileSync(new URL(name, import.meta.url), value);
const draft = read('./data/draft.json');
const projections = read('./data/projections.json');
const players = joinPlayers(draft, projections);
const rows = summarize(players, draft.teams);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = value => Number(value).toFixed(1);
const sign = value => `${value > 0 ? '+' : ''}${Number.isInteger(value) ? value : n(value)}`;
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const positionRank = player => player.positionRank ? `${player.position === 'DST' ? 'D/ST' : player.position}${player.positionRank}` : 'Not in Top 300';
const source = id => sources.find(s => s.id === id);
const cite = id => `<a href="${source(id).url}">${esc(source(id).title)}</a>`;
const short = name => name.replace(/ (Jr\.|Sr\.|III)$/, '');
const compactLineup = result => ({ total: result.total, perGame: result.perGame, emptySlots: result.emptySlots,
  slots: result.slots.map(s => ({ slot: s.slot, id: s.player.empty ? null : s.player.id })), bench: result.bench.map(p => p.id) });
const drafted = new Set(players.map(p => `${p.position}|${p.name}`));
const freeAgents = projections.players.filter(p => !drafted.has(`${p.position}|${p.name}`)).map((p, i) => {
  const ranked = draft.rankings.find(r => r.CanonicalPlayer === p.name && r.Position === p.position);
  return { id: `free-${i}`, name: p.name, position: p.position, team: 'Undrafted', nflTeam: p.team,
    pick: 0, round: 0, rank: ranked?.Rank ?? null, positionRank: ranked?.PositionRank ?? null,
    bye: ranked?.Bye ?? null, salary: ranked?.SalaryValue ?? null, points: p.points, games: p.games, projection: p, cost: 0 };
});
const wire = Object.fromEntries(OFFENSE.map(pos => [pos, freeAgents.filter(p => p.position === pos).sort((a, b) => b.points - a.points).slice(0, 3)]));
const result = { teams: draft.teams, players, wire, sources, availability, weights: WEIGHTS, formats: {}, replay: [] };
for (const format of ['standard', 'threeWR']) {
  result.formats[format] = summarize(players, draft.teams, format).map(row => {
    const roster = row.roster;
    const absences = {};
    for (const p of roster.filter(p => OFFENSE.includes(p.position))) {
      const after = optimize(roster, { format, exclude: [p.id] });
      const candidate = wire[p.position][0];
      const withWire = optimize([...roster, candidate], { format, exclude: [p.id] });
      absences[p.id] = { ...compactLineup(after), wire: { ...compactLineup(withWire), candidate } };
    }
    return { team: row.team, grade: copy[row.team].grade, scores: row.scores, places: row.places,
      components: row.components, rankDiff: row.rankDiff, valueSurplus: row.valueSurplus,
      starterSalary: row.salary.total, rosterPoints: row.rosterPoints, benchPoints: row.benchPoints,
      retention: row.cover.retention, averageLoss: row.cover.averageLoss,
      worst: { id: row.cover.worst.id, name: row.cover.worst.name, loss: row.cover.worst.loss },
      baseline: compactLineup(row.starters), salaryLineup: compactLineup(row.salary), absences,
      byes: Object.fromEntries(Array.from({ length: 18 }, (_, i) => i + 1).map(week => [week, compactLineup(optimize(roster, { format, week }))])),
      flaggedOut: compactLineup(optimize(roster, { format, exclude: roster.filter(p => availability.some(a => a.name === p.name && a.kind === 'Unavailable')).map(p => p.id) })) };
  });
}
for (let pick = 0; pick <= 128; pick++) {
  const chosen = pick ? players[pick - 1] : null;
  const available = pick ? availableAt(players, draft.rankings, pick).filter(p => OFFENSE.includes(p.Position)).slice(0, 5) : [];
  result.replay.push({ pick, chosen: chosen?.id ?? null, available,
    teams: draft.teams.map(team => {
      const roster = players.filter(p => p.team === team && p.pick <= pick);
      return { team, count: roster.length, total: optimize(roster).perGame,
        rankDiff: roster.length ? roster.reduce((s, p) => s + (p.rank ?? 301) - p.pick, 0) / roster.length : null,
        salarySurplus: roster.filter(p => OFFENSE.includes(p.position)).reduce((s, p) => s + (p.salary ?? 0) - p.cost, 0) };
    }) });
}
write('./data/analysis.json', JSON.stringify(result) + '\n');

function lineupTable(row) {
  const slots = [...row.starters.slots, ...['K', 'DST'].map(pos => ({ slot: pos === 'DST' ? 'D/ST' : pos, player: row.roster.find(p => p.position === pos) }))];
  return `<table class="lineup"><caption>Projection-selected lineup · eight offensive slots plus K and D/ST</caption><thead><tr><th>Slot</th><th>Player</th><th>ESPN tier</th><th>Pts / 17</th></tr></thead><tbody>${slots.map(s => `<tr><th>${s.slot}</th><td>${esc(s.player.name)}</td><td>${positionRank(s.player)}</td><td>${s.player.points === null ? '—' : n(s.player.points / 17)}</td></tr>`).join('')}</tbody></table>`;
}
function barChart() {
  const ordered = [...rows].sort((a, b) => b.starters.total - a.starters.total);
  return `<svg viewBox="0 0 860 370" role="img" aria-labelledby="starter-chart-title"><title id="starter-chart-title">Projected starting offense in points per 17-game equivalent; Rome leads at 136.8</title>
  ${[0, 30, 60, 90, 120, 150].map(t => `<line class="gridline" x1="${190 + t * 3.8}" x2="${190 + t * 3.8}" y1="12" y2="329"/><text class="axis" x="${190 + t * 3.8}" y="353" text-anchor="middle">${t}</text>`).join('')}
  ${ordered.map((r, i) => `<text class="label" x="175" y="${35 + i * 40}" text-anchor="end">${esc(r.team)}</text><rect fill="${i === 0 ? '#9f3328' : '#263d3a'}" x="190" y="${17 + i * 40}" width="${r.starters.perGame * 3.8}" height="24"/><text class="number" x="${202 + r.starters.perGame * 3.8}" y="${35 + i * 40}">${n(r.starters.perGame)}</text>`).join('')}</svg>`;
}
function rbChart() {
  const max = 25;
  return `<svg viewBox="0 0 860 410" role="img" aria-labelledby="rb-chart-title"><title id="rb-chart-title">RB1 and RB2 projected points per 17-game equivalent, by roster</title>
  ${[0, 5, 10, 15, 20, 25].map(t => `<line class="gridline" x1="${190 + t * 21}" x2="${190 + t * 21}" y1="38" y2="366"/><text class="axis" x="${190 + t * 21}" y="394" text-anchor="middle">${t}</text>`).join('')}
  <circle cx="194" cy="14" r="5" fill="#9f3328"/><text class="axis" x="207" y="19">Roster RB1</text><circle cx="338" cy="14" r="5" fill="#263d3a"/><text class="axis" x="351" y="19">Roster RB2</text>
  ${rows.map((r, i) => { const a = r.rb[0].points / 17; const b = r.rb[1].points / 17; return `<text class="label" x="175" y="${63 + i * 42}" text-anchor="end">${esc(r.team)}</text><line x1="${190 + b * 21}" x2="${190 + a * 21}" y1="${58 + i * 42}" y2="${58 + i * 42}" stroke="#afa99b" stroke-width="3"/><circle cx="${190 + a * 21}" cy="${58 + i * 42}" r="6" fill="#9f3328"/><circle cx="${190 + b * 21}" cy="${58 + i * 42}" r="6" fill="#263d3a"/><text class="axis" x="${204 + a * 21}" y="${63 + i * 42}">${n(b)} / ${n(a)}</text>`; }).join('')}</svg>`;
}
function stressChart() {
  return `<svg viewBox="0 0 860 385" role="img" aria-labelledby="stress-title"><title id="stress-title">Largest loss after removing one starter and reoptimizing from the bench</title>
  ${[0, 5, 10, 15, 20].map(t => `<line class="gridline" x1="${190 + t * 23}" x2="${190 + t * 23}" y1="12" y2="337"/><text class="axis" x="${190 + t * 23}" y="367" text-anchor="middle">${t}</text>`).join('')}
  ${rows.map((r, i) => `<text class="label" x="175" y="${35 + i * 40}" text-anchor="end">${esc(r.team)}</text><rect fill="#9f3328" x="190" y="${18 + i * 40}" width="${r.cover.worst.loss * 23}" height="23"/><text class="axis" x="${202 + r.cover.worst.loss * 23}" y="${35 + i * 40}">${n(r.cover.worst.loss)} · ${esc(short(r.cover.worst.name))}</text>`).join('')}</svg>`;
}
const teamSections = rows.map(row => {
  const t = copy[row.team];
  const notes = availability.filter(a => row.roster.some(p => p.name === a.name));
  return `<article class="team-report" id="team-${slug(row.team)}"><div class="team-heading"><div><p class="eyebrow">Draft slot ${draft.teams.indexOf(row.team) + 1} · analyst grade</p><h3>${esc(row.team)}</h3></div><div class="grade">${t.grade}</div></div><h4>${esc(t.headline)}</h4>
  <div class="team-columns"><div class="team-copy">${t.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}<p class="action"><span>Next move</span> ${esc(t.action)}</p>
  ${notes.length ? `<details><summary>${notes.length} sourced availability ${notes.length === 1 ? 'note' : 'notes'}</summary>${notes.map(a => `<p><strong>${esc(a.name)} · ${esc(a.kind)}.</strong> ${esc(a.note)} <a href="${source(a.source).url}">${source(a.source).date}</a></p>`).join('')}</details>` : '<p class="small">No specific current injury claim is made for this roster. The same starter-out test is applied to all eight teams.</p>'}
  <p class="small">Numerical evidence: ${cite('rankings')}; ${cite('projections')}. See the methodology for the calculation rules.</p></div>
  <div class="team-data"><div class="mini-stats"><div><b>${n(row.starters.perGame)}</b><span>starting offense / 17</span></div><div><b>${n(row.cover.retention)}%</b><span>mean retained, one out</span></div></div>${lineupTable(row)}<p class="small">Offensive bench: ${row.starters.bench.map(p => esc(short(p.name))).join(', ')}.</p></div></div></article>`;
}).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="2026 eight-team PPR superflex draft grades, legal-lineup comparisons, depth tests, and an interactive draft lab."><title>The 2026 Draft, With Receipts · 4th Floor Fantasy</title><link rel="stylesheet" href="style.css"></head>
<body><a class="skip-link" href="#main">Skip to report</a><header class="masthead"><a href="../Draft/" class="wordmark">4TH FLOOR <span>FANTASY</span></a><div>2026 DRAFT ANNUAL <span class="edition">No. 01 / September 7</span></div></header>
<nav class="tabs" aria-label="Report sections"><div class="tab-buttons" role="tablist" aria-label="Draft analysis"><button id="tab-report" role="tab" aria-controls="report" aria-selected="true" class="active">01 <span>The Report</span></button><button id="tab-lab" role="tab" aria-controls="lab" aria-selected="false" tabindex="-1">02 <span>Draft Lab</span></button></div><a href="../Draft/" class="archive-link">Original knitr page ↗</a></nav>
<main id="main"><section id="report" role="tabpanel" aria-labelledby="tab-report"><div class="hero"><p class="eyebrow">8 teams / 128 picks / PPR superflex</p><h1>The draft,<br>with <em>receipts.</em></h1><div class="hero-bottom"><p class="standfirst">Rome built the best projected lineup. Magic collected the most ESPN value. Those are different achievements, and this draft needs both scorecards.</p><div class="hero-aside"><span>RANKINGS</span>ESPN · September 2<span>PROJECTIONS</span>Mike Clay · September 7<span>ANALYSIS</span>AI-written · grades explained below</div></div></div>
<div class="rule-strip">QB · RB · RB · WR · WR · TE · FLEX · SUPERFLEX · K · D/ST <span>Six bench slots. Full PPR. Four-point passing TDs.</span></div>
<section class="report-section" id="grades"><div class="section-heading"><p class="section-number">01</p><div><h2>Rome and Magic lead for different reasons.</h2><p>Letter grades are editorial judgments for this league. The index is a transparent, relative comparison, not a win probability or an ESPN grade.</p></div></div>
<div class="table-scroll"><table class="scoreboard"><caption>Draft grades and the three inputs to the balanced index</caption><thead><tr><th>Team</th><th>Grade</th><th>Starting<br>offense / 17</th><th>Mean retained<br>with one out</th><th>ESPN value<br>surplus</th><th>Relative<br>index / 100</th></tr></thead><tbody>${rows.map(r => `<tr><th><a href="#team-${slug(r.team)}">${esc(r.team)}</a></th><td class="table-grade">${copy[r.team].grade}</td><td>${n(r.starters.perGame)}</td><td>${n(r.cover.retention)}%</td><td>${sign(r.valueSurplus)}</td><td>${n(r.scores.balanced)}</td></tr>`).join('')}</tbody></table></div>
<p class="caption">Starting offense = the best legal eight-player offensive lineup’s projected season points ÷ 17. K and D/ST are shown in the full lineups but excluded from point totals because this source lacks comparable projections for them. Value surplus uses ESPN’s ten-team auction dollars as a scale, not dollars paid in this snake draft.</p>
<div class="editorial-columns"><p>Magic owns Daniels, Jackson, Lamb, London, McBride, and Rice. ESPN’s salary-value scale loves that core. Rome’s receivers and three-startable-RB structure produce more points in Clay’s separate projection set, even with a weaker quarterback pair. The two views are related, so agreement is useful evidence, not two independent forecasts.</p><p>Purple wins the old all-position rank-difference calculation, but that measure gives a late bench pick the same rank-gap weight as a starting quarterback. It also gives unmatched players the historical placeholder of 301. The new analysis keeps that baseline visible while separating acquisition value from what can fit into a lineup.</p></div></section>
<section class="report-section" id="lineups"><div class="section-heading"><p class="section-number">02</p><div><h2>Only the players who fit can score.</h2><p>Every roster gets the same legal slots. A third QB cannot occupy FLEX; a second TE can, if the projection warrants it.</p></div></div>
<figure>${barChart()}<figcaption>Projected offense, before matchup adjustments, byes, or future transactions. These are season-total equivalents, not predictions for a particular Sunday. The bars start at zero.</figcaption></figure>
<p class="reading-note">Clint’s lineup trails Magic by only ${n(rows.find(r => r.team === 'Magic Skol Bus').starters.perGame - rows.find(r => r.team === 'Clint Bilton').starters.perGame)} points per game-equivalent. The index separates them more sharply because it also rewards draft value and roster coverage. Small projection gaps deserve less confidence than the displayed ordering might suggest.</p></section>
<section class="report-section" id="running-backs"><div class="section-heading"><p class="section-number">03</p><div><h2>Your second RB drafted may not be your RB2.</h2><p>Roster roles use projected production. ESPN tier labels use the superflex cheat sheet’s positional ranks. Neither is inferred from selection order.</p></div></div>
<figure>${rbChart()}<figcaption>Each line joins a roster’s first and second RB by projected production. Units are published season points ÷ 17. The numeric pair reads RB2 / RB1.</figcaption></figure>
<div class="table-scroll"><table><caption>RB tiers and the third option</caption><thead><tr><th>Team</th><th>Roster RB1</th><th>Roster RB2</th><th>Next RB</th></tr></thead><tbody>${rows.map(r => `<tr><th>${esc(r.team)}</th>${r.rb.slice(0, 3).map(p => `<td>${esc(short(p.name))}<small>${positionRank(p)} · ${n(p.points / 17)} pts / 17 · ${p.projection.receptions} projected catches</small></td>`).join('')}</tr>`).join('')}</tbody></table></div>
<div class="editorial-columns"><p>In an eight-team league, the first RB slot draws from a much smaller top tier than the usual 12-team “RB1” shorthand. ESPN RB9 Henry is still a strong second starter. A team’s nominal RB1 can sit outside the top eight, as Jeanty and Williams do in the frozen ranking.</p><p>Receiving work matters in full PPR. Clay projects Robinson for 76 catches and Henry for 21. Those are different routes to points. Flames’ own second RB is Hall, despite Harris being drafted earlier; Faux’s corrected second RB is Etienne, with Skattebo available for FLEX.</p></div></section>
<section class="report-section" id="depth"><div class="section-heading"><p class="section-number">04</p><div><h2>The bench has to cover a specific absence.</h2><p>Remove each starter in turn, then rebuild the best legal lineup from the remaining roster. The chart shows each team’s largest loss.</p></div></div>
<figure>${stressChart()}<figcaption>Points per game-equivalent lost in the worst single-starter-out case. This tests roster structure. It does not estimate who will get injured. No waiver replacement is included in the red bars.</figcaption></figure>
<div class="editorial-columns"><p>Rome can move Hampton from FLEX to RB and promote Olave if McCaffrey is unavailable. The calculated loss is ${n(rows[0].cover.worst.loss)}, despite removing a player with a much larger individual projection. Flames has to fall from Gibbs to a far weaker RB option, while Think Tank’s biggest roster-only hole is the sole TE slot.</p><p>The waiver pool changes the practical answer. The draft snapshot leaves Kittle, Goedert, and Ferguson undrafted. A zero at TE is a warning to make a transaction, not a prediction that a manager will accept an empty lineup. The report grades the submitted roster; the Lab’s optimistic one-pickup comparison will expose how much that assumption matters.</p></div>
<div class="table-scroll"><table><caption>Best projected players absent from the submitted draft; current waiver availability is unverified</caption><thead><tr><th>Position</th><th>First option</th><th>Second option</th><th>Third option</th></tr></thead><tbody>${OFFENSE.map(pos => `<tr><th>${pos}</th>${wire[pos].map(p => `<td>${esc(short(p.name))}<small>${n(p.points / 17)} pts / 17 · ${positionRank(p)}</small></td>`).join('')}</tr>`).join('')}</tbody></table></div>
<h3 class="subheading">Some absences are already on the calendar.</h3><div class="table-scroll"><table><caption>Worst offensive bye-week exposure before waivers; all byes use the frozen ESPN ranking source</caption><thead><tr><th>Team</th><th>Week</th><th>Loss / 17</th><th>Unfilled offensive slots</th><th>Players off, including specialists</th></tr></thead><tbody>${rows.map(r => `<tr><th>${esc(r.team)}</th><td>${r.worstBye.week}</td><td>${n(r.worstBye.loss)}</td><td>${r.worstBye.emptySlots}</td><td>${r.worstBye.missing.map(esc).join(', ')}</td></tr>`).join('')}</tbody></table></div>
<p class="caption">Rome’s QBs share Week 10; NKFL’s share Week 11. FLEX permits RB/WR/TE, and SUPERFLEX permits QB/RB/WR/TE, but neither rule eliminates the mandatory QB slot. Specialist bye coverage is separate from these offensive losses. Beckham, Bass, the Bears, and the Vikings inherit their NFL team’s bye from other entries in the same ESPN source; their individual ranks remain unknown.</p></section>
<section class="report-section" id="team-reports"><div class="section-heading"><p class="section-number">05</p><div><h2>Eight grades, with the case for each.</h2><p>The letters weigh lineup strength, draft choices, and repairable weaknesses. They are deliberately broader than the numerical index.</p></div></div><div class="team-jump">${rows.map(r => `<a href="#team-${slug(r.team)}">${esc(r.team)}</a>`).join('')}</div>${teamSections}</section>
<section class="report-section" id="specialists"><div class="section-heading"><p class="section-number">06</p><div><h2>Kickers and defenses count, without driving the grade.</h2><p>Everyone waited until the last two rounds. ESPN assigns these specialists zero auction dollars in the source sheet, which is not a zero-points projection.</p></div></div>
<div class="table-scroll"><table><caption>All eight kicker and defense pairs</caption><thead><tr><th>Team</th><th>Kicker</th><th>Defense</th></tr></thead><tbody>${rows.map(r => `<tr><th>${esc(r.team)}</th>${['K', 'DST'].map(pos => { const p = r.roster.find(p => p.position === pos); return `<td>${esc(p.name)}<small>${positionRank(p)} · pick ${p.pick}${p.bye ? ` · bye ${p.bye}` : ' · bye not supplied by source'}</small></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
<p>Clint has the source’s top defense, Houston; Rome has its top kicker, Aubrey. Bass, the Bears, and the Vikings are missing from the frozen Top 300, so their ranks stay unknown. Buffalo described Bass as healthy on its initial roster. The original page’s placeholder rank should not be read as a scouting judgment. ${cite('bass')}.</p>
<details><summary>ESPN’s usual specialist scoring</summary><p>ESPN lists made field goals at three points from 0–39 yards, four from 40–49, five from 50–59, and six from 60-plus. Made PATs earn one; a missed field goal costs one. ${cite('rules')}.</p><p>For D/ST, sacks earn one, interceptions and recovered fumbles earn two, and return touchdowns earn six. Points and yards allowed also affect the score. The initial 10 points combine five for zero points allowed and five for zero yards allowed; they are not a flat appearance bonus. ${cite('defense-rules')}.</p></details></section>
<section class="report-section methodology" id="method"><div class="section-heading"><p class="section-number">07</p><div><h2>You can inspect every assumption.</h2><p>The draft, rankings, projections, and model choices are separate inputs.</p></div></div>
<details open><summary>How the score works</summary><p>The balanced index weights three within-league percentiles: 60% starting offensive projection, 20% mean percentage retained after one starter is removed, and 20% ESPN salary-value surplus. For each input, the lowest of eight teams receives 0 and the highest 100; ties share their average rank. An index of 97 is not a 97% chance of winning. The Lab also supplies starter-heavy (80/10/10), depth-heavy (40/40/20), and value-heavy (35/15/50) comparisons.</p><p>Value surplus sums each offensive player’s ESPN salary value minus the source salary value at that overall pick number. It accounts for the different draft slots and avoids pretending that moving from rank 200 to 150 is worth the same as moving from 50 to 1. The only unranked offensive pick, Beckham, receives zero modeled salary value; his rank remains unknown. These values are scaled for a ten-team, $200 auction and are only a benchmark for this eight-team snake.</p><p>Letters are analyst judgments: A-range drafts combine contender-level lineups with useful value and cover; B-range drafts have competitive lineups and identifiable repairs; C-range drafts have substantial acquisition or structural weaknesses. They are not obtained by converting the relative index into school percentages.</p></details>
<details><summary>Projection selection, injuries, and replacement limits</summary><p>Lineups maximize Clay’s published PPR points under the confirmed slots, with ESPN rank breaking point ties. Dividing the lineup total by 17 produces a common season-average scale, not a matchup forecast. The source is generally a 17-game baseline but explicitly models fewer games for some players. Known reduced-game projections are retained without another haircut. Bench players do not all score at once.</p><p>The injury test removes each offensive starter equally, then reoptimizes. Equal scenario weighting is not a claim that their injury risks are equal. The supplied news notes are selective, dated checks, not a complete medical model. Missing notes do not certify health. The one-pickup sensitivity adds the best projected undrafted player at the removed player’s position, with no bidding competition or roster-limit friction. It is an optimistic scenario, not a verified waiver recommendation.</p><p>The three-WR sensitivity adds a WR slot and leaves five bench spots out of the same 16-player roster. K and D/ST remain displayed. Their projected points, streaming matchups, and return-touchdown probabilities are not modeled, and no championship odds are claimed.</p></details>
<details><summary>League rules and data corrections</summary><p>Evan confirmed the ten starting slots shown above. The scoring assumption follows ESPN’s standard full-PPR settings: one point per reception, one per 10 rushing/receiving yards, six per rushing/receiving TD, one per 25 passing yards, four per passing TD, and minus two for interceptions and lost fumbles. A custom league-settings export was not supplied. ${cite('rules')}.</p><p>The supplied draft has eight teams and 16 snake rounds. Fauxgendaz’s round-10 pick is Beckham, confirmed by Evan. Its sole round-11 Etienne entry is treated as Travis based on Evan’s recollection that the higher-value brother was selected; no independent league export confirms that correction. Trevor is not inserted elsewhere. All 128 original picks remain available in the ledger.</p><p>Ranks and byes are frozen to September 2. Clay’s projections and the roster outlook use September 7 information. They are a later outlook, not evidence of what every manager knew while drafting. No regular-season results are used.</p></details>
<div class="downloads"><a href="../Draft/data/draft-ledger.csv">128-pick ledger ↓</a><a href="data/projections.json">Projection extract ↓</a><a href="data/analysis.json">Calculated scenarios ↓</a><a href="https://github.com/EvanOman/FantasyFootball/tree/gh-pages/2026/Report">Source and tests ↗</a></div>
<h3 class="subheading">Source dates stay attached to the claims.</h3><ol class="source-list">${sources.map(s => `<li id="source-${s.id}"><a href="${s.url}">${esc(s.title)}</a><span>${s.date}</span></li>`).join('')}</ol></section>
</section><section id="lab" hidden role="tabpanel" aria-labelledby="tab-lab">${labTemplate}</section><noscript><p>The written report works without JavaScript. Enable JavaScript to explore the Draft Lab.</p></noscript></main><footer><span>4TH FLOOR FANTASY / 2026</span><a href="../Draft/">Return to the original knitr analysis ↗</a></footer><script type="module" src="app.mjs"></script></body></html>`;
write('./index.html', html);
console.log(`Built report: ${players.length} picks, ${projections.players.length} projections, ${result.replay.length} replay states, 8 team assessments.`);
