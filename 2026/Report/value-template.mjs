const n = value => Number(value).toFixed(1);

export function valueChart(curve, { metric = 'value', id = 'value-chart', selected = -1, compact = false } = {}) {
  const bands = curve.bands, raw = metric === 'points';
  const max = raw ? Math.ceil(Math.max(...bands.map(b => b.points)) / 5) * 5 : Math.max(2, Math.ceil(Math.max(...bands.map(b => b.max)) / 2) * 2);
  const x = i => compact ? 48 + i * 27 : 72 + i * 55, y = v => 255 - v / max * 195;
  const path = key => bands.map((b, i) => `${i ? 'L' : 'M'}${x(i)},${y(b[key])}`).join(' ');
  return `<svg viewBox="0 0 ${compact ? 430 : 850} 335" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${raw ? 'Actual PPR points' : 'Positive points above replacement'} by preseason ten-player ADP band, ${curve.years[0]}–${curve.years.at(-1)}</title>
  <text class="axis" x="${compact ? 48 : 72}" y="20">${compact ? 'Positive value per scheduled game' : raw ? 'PPR points per scheduled team game' : 'Positive above-replacement points per scheduled team game'}</text>
  ${Array.from({ length:5 }, (_, i) => max * i / 4).map(v => `<line class="gridline" x1="${compact ? 42 : 60}" x2="${compact ? 407 : 805}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${compact ? 35 : 49}" y="${y(v) + 4}" text-anchor="end">${n(v)}</text>`).join('')}
  ${!raw ? bands.map((b, i) => `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.min)}" y2="${y(b.max)}" stroke="#afa99b" stroke-width="3"/>`).join('') : ''}
  <path d="${path(raw ? 'points' : 'fitted')}" fill="none" stroke="#9f3328" stroke-width="3"/>
  ${bands.map((b, i) => `<circle cx="${x(i)}" cy="${y(b[metric])}" r="${i === selected ? 7 : 4}" fill="#263d3a"><title>${b.first}–${b.last}: ${n(b[metric])}; ${b.n} observations</title></circle>${!compact || i % 2 ? `<text class="axis" x="${x(i)}" y="280" text-anchor="middle">${b.last}</text>` : ''}`).join('')}
  <text class="axis" x="${compact ? 48 : 72}" y="307">${compact ? 'Ten-player ADP bands · last rank shown' : 'Ten-player bands, labeled by last rank (10 = ranks 1–10)'}</text></svg>`;
}
