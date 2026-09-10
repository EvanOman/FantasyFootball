// Run in the report page using agent-browser eval --stdin < tests/browser-audit.js.
(async () => {
  const response = await fetch('data/analysis.json');
  if (!response.ok) throw new Error(`Analysis export: HTTP ${response.status}`);
  const data = await response.json();
  const players = new Map(data.players.map(player => [player.id, player]));
  const equal = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  };
  const cells = row => Array.from(row.cells, cell => cell.textContent.trim());
  const number = value => value.toFixed(1);
  const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const scoreRows = [...document.querySelectorAll('.scoreboard tbody tr')];
  equal(scoreRows.length, 8, 'Scoreboard team count');
  equal(document.querySelectorAll('.team-report').length, 8, 'Team article count');
  let lineupRows = 0;
  for (const team of data.formats.standard) {
    const score = scoreRows.find(row => row.cells[0].textContent.trim() === team.team);
    if (!score) throw new Error(`Missing scoreboard row: ${team.team}`);
    const surplus = `${team.valueSurplus > 0 ? '+' : ''}${team.valueSurplus}`;
    equal(cells(score), [team.team, team.grade, number(team.baseline.perGame),
      `${number(team.retention)}%`, surplus, `${team.curve.surplus > 0 ? '+' : ''}${number(team.curve.surplus)}`, number(team.scores.balanced)], `${team.team} scores`);
    const section = document.getElementById(`team-${slug(team.team)}`);
    if (!section) throw new Error(`Missing article: ${team.team}`);
    equal(section.querySelector('.grade').textContent, team.grade, `${team.team} article grade`);
    const lineup = [...team.baseline.slots.map(slot => ({ slot: slot.slot, player: players.get(slot.id) })),
      ...['K', 'DST'].map(position => ({ slot: position === 'DST' ? 'D/ST' : position,
        player: data.players.find(player => player.team === team.team && player.position === position) }))];
    const rendered = [...section.querySelectorAll('.lineup tbody tr')];
    equal(rendered.length, 10, `${team.team} full lineup size`);
    lineup.forEach(({ slot, player }, i) => {
      const tier = player.positionRank
        ? `${player.position === 'DST' ? 'D/ST' : player.position}${player.positionRank}`
        : 'Not in Top 300';
      equal(cells(rendered[i]), [slot, player.name, tier,
        player.points === null ? '—' : number(player.points / 17)], `${team.team} ${slot}`);
      lineupRows++;
    });
  }
  for (const anchor of document.querySelectorAll('a[href^="#"]')) {
    if (!document.getElementById(anchor.hash.slice(1))) throw new Error(`Broken anchor: ${anchor.hash}`);
  }
  const charts = [...document.querySelectorAll('#report svg[role="img"]')];
  equal(charts.length, 2, 'Desktop and mobile renderings of the single value curve');
  for (const chart of charts) {
    const title = document.getElementById(chart.getAttribute('aria-labelledby'));
    if (!title?.textContent.trim()) throw new Error('Chart is missing an accessible title');
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) throw new Error('Page overflows viewport');
  return { passed: true, teams: scoreRows.length, lineupRows, charts: charts.length,
    viewport: `${innerWidth}×${innerHeight}`, scope: 'Static report; interactive checks are in browser-lab-audit.js' };
})();
