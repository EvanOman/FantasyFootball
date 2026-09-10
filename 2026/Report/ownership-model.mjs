/** Cumulative ownership of the frozen ESPN Top 10/20/30/40. No new scoring. */
export const CUTOFFS = [10, 20, 30, 40];
export function rankOwnership(players, teams) {
  if (new Set(teams).size !== teams.length || !teams.length) throw Error('Invalid teams');
  return CUTOFFS.map(top => {
    const ranked = players.filter(p => p.rank !== null && p.rank >= 1 && p.rank <= top);
    if (ranked.some(p => !Number.isInteger(p.rank) || !teams.includes(p.team)) || new Set(ranked.map(p => p.rank)).size !== ranked.length) throw Error('Ambiguous ranked ownership');
    const rows = teams.map(team => {
      const selected = ranked.filter(p => p.team === team).sort((a, b) => a.rank - b.rank);
      return { team, count:selected.length, share:selected.length / top * 100, players:selected };
    });
    const max = Math.max(...rows.map(r => r.count));
    return { top, rows, undrafted:top - ranked.length, leaders:rows.filter(r => r.count === max).map(r => r.team) };
  });
}

export function ownershipView(cohorts, team, top = 30) {
  if (!CUTOFFS.includes(top) || !cohorts.every(c => c.rows.some(r => r.team === team))) throw Error('Invalid ownership selection');
  return { team, top, cohorts:cohorts.map(c => {
    const row = c.rows.find(r => r.team === team);
    const place = 1 + c.rows.filter(r => r.count > row.count).length;
    const tied = c.rows.filter(r => r.count === row.count).length > 1;
    return { ...c, selected:row, place, tied,
      ordered:[row, ...c.rows.filter(r => r.team !== team)] };
  }), players:cohorts.find(c => c.top === top).rows.find(r => r.team === team).players };
}
