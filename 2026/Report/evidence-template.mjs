const n = value => Number(value).toFixed(1);
const colors = { 30:'#9f3328', 40:'#263d3a', preseason:'#263d3a', hindsight:'#9f3328' };

/** Views of existing historical calculations; no new forecast or scoring input. */
export function yearlyConcentrationChart(curve) {
  const x = i => 48 + i * 40, y = value => 232 - value * 1.7;
  const series = [30,40].map(top => ({ top, values:curve.seasons.map(s => ({
    year:s.year, share:s.concentration.find(c => c.top === top).preseason
  })) }));
  return `<svg id="yearly-concentration" viewBox="0 0 450 295" role="img" aria-labelledby="yearly-concentration-title yearly-concentration-desc"><title id="yearly-concentration-title">Value captured each season by the preseason top 30 and 40</title><desc id="yearly-concentration-desc">Share of all positive points above replacement, 2016–2025. ${series.map(s => `Top ${s.top}: ${s.values.map(p => `${p.year}, ${n(p.share)} percent`).join('; ')}.`).join(' ')}</desc>
  ${[0,25,50,75,100].map(v => `<line class="gridline" x1="48" x2="408" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="39" y="${y(v)+4}" text-anchor="end">${v}%</text>`).join('')}
  ${series.map((s,j) => `<line x1="${48+j*162}" x2="${71+j*162}" y1="23" y2="23" stroke="${colors[s.top]}" stroke-width="3"${j ? ' stroke-dasharray="5 4"' : ''}/><text class="axis" x="${79+j*162}" y="27">Top ${s.top} preseason</text>
  <path d="${s.values.map((p,i) => `${i ? 'L':'M'}${x(i)},${y(p.share)}`).join(' ')}" fill="none" stroke="${colors[s.top]}" stroke-width="2.5"${j ? ' stroke-dasharray="5 4"' : ''}/>
  ${s.values.map((p,i) => `<circle data-year="${p.year}" data-top="${s.top}" data-share="${p.share}" cx="${x(i)}" cy="${y(p.share)}" r="3.5" fill="${colors[s.top]}"><title>${p.year}, top ${s.top}: ${n(p.share)}%</title></circle>`).join('')}`).join('')}
  ${curve.seasons.map((s,i) => i % 2 === 0 || i === curve.seasons.length-1 ? `<text class="axis" x="${x(i)}" y="255" text-anchor="middle">${s.year}</text>` : '').join('')}<text class="axis" x="48" y="281">Share of positive value · full regular season</text></svg>`;
}

export function hindsightConcentrationChart(curve) {
  const x = share => 75 + share * 3.2, y = i => 75 + i * 45;
  return `<svg id="hindsight-concentration" viewBox="0 0 450 295" role="img" aria-labelledby="hindsight-concentration-title hindsight-concentration-desc"><title id="hindsight-concentration-title">Preseason selections versus eventual top performers</title><desc id="hindsight-concentration-desc">Mean share of all positive points above replacement, 2016–2025. ${curve.concentration.map(c => `Top ${c.top}: preseason ${n(c.preseason)} percent; hindsight ${n(c.hindsight)} percent.`).join(' ')}</desc>
  <circle cx="75" cy="23" r="4" fill="${colors.preseason}"/><text class="axis" x="86" y="27">Preseason ADP</text><circle cx="246" cy="23" r="4" fill="${colors.hindsight}"/><text class="axis" x="257" y="27">Actual finishers</text>
  ${[0,25,50,75,100].map(v => `<line class="gridline" x1="${x(v)}" x2="${x(v)}" y1="47" y2="232"/><text class="axis" x="${x(v)}" y="255" text-anchor="middle">${v}%</text>`).join('')}
  ${curve.concentration.map((c,i) => `<text class="axis" x="59" y="${y(i)+4}" text-anchor="end">Top ${c.top}</text><line x1="${x(c.preseason)}" x2="${x(c.hindsight)}" y1="${y(i)}" y2="${y(i)}" stroke="#afa99b" stroke-width="2"/>
  ${['preseason','hindsight'].map(key => `<circle data-top="${c.top}" data-basis="${key}" data-share="${c[key]}" cx="${x(c[key])}" cy="${y(i)}" r="4" fill="${colors[key]}"><title>Top ${c.top}, ${key}: ${n(c[key])}%</title></circle><text class="axis" x="${x(c[key])}" y="${y(i)-11}" text-anchor="middle">${n(c[key])}%</text>`).join('')}`).join('')}
  <text class="axis" x="75" y="281">Share of positive value · ten-season mean</text></svg>`;
}

export function concentrationEvidence(curve) {
  const top40 = curve.seasons.map(s => s.concentration.find(c => c.top === 40).preseason);
  return `<div class="evidence-grid"><figure><h3>Value captured each season</h3>${yearlyConcentrationChart(curve)}<figcaption>The preseason top 40 captured ${n(Math.min(...top40))}–${n(Math.max(...top40))}% of positive value across the ten seasons. The top 30 line shows how much came from the earlier group.</figcaption></figure>
  <figure><h3>Preseason ranks versus actual finishers</h3>${hindsightConcentrationChart(curve)}<figcaption>The eventual top 40 supplied ${n(curve.concentration.find(c => c.top === 40).hindsight)}% of positive value on average; the preseason top 40 captured ${n(curve.concentration.find(c => c.top === 40).preseason)}%. Actual finishers are ranked after the season by value above replacement, so that view requires hindsight.</figcaption></figure></div>`;
}
