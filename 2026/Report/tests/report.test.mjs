import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { teams, sources, availability } from '../content.mjs';
const result = JSON.parse(readFileSync(new URL('../data/analysis.json', import.meta.url)));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('The original knitr report remains byte-identical', () => {
  const old = readFileSync(new URL('../../Draft/index.html', import.meta.url));
  assert.equal(createHash('sha256').update(old).digest('hex'), '9c1c416d5a09c739bf00733f5c097ded2441ede14c3261aabf3876c654d5cf2e');
});
test('All eight grades include substantive narratives, complete lineups, and source evidence', () => {
  assert.equal(Object.keys(teams).length, 8);
  for (const [team, copy] of Object.entries(teams)) {
    assert(copy.paragraphs.join(' ').split(/\s+/).length >= 130, team);
    assert(copy.action.length > 40, team);
    assert(result.formats.standard.some(r => r.team === team && r.grade === copy.grade));
  }
  assert.equal((html.match(/class="team-report"/g) ?? []).length, 8);
  assert.equal((html.match(/<th>D\/ST<\/th>/g) ?? []).length, 8);
  assert.equal((html.match(/<th>K<\/th>/g) ?? []).length, 8);
  for (const a of availability) {
    assert(result.players.some(p => p.name === a.name), a.name);
    assert(sources.some(s => s.id === a.source), a.source);
  }
  for (const s of sources) assert(s.date <= '2026-09-07', s.title);
});
test('Every replay state is cumulative, and every scenario retains legal slot counts', () => {
  assert.equal(result.replay.length, 129);
  for (const state of result.replay) {
    assert.equal(state.teams.reduce((s, t) => s + t.count, 0), state.pick);
    assert.equal(state.chosen, state.pick ? String(state.pick) : null);
  }
  for (const [format, rows] of Object.entries(result.formats)) for (const r of rows) {
    const expected = format === 'standard' ? 8 : 9;
    for (const s of [r.baseline, r.flaggedOut, ...Object.values(r.absences), ...Object.values(r.byes)]) {
      assert.equal(s.slots.length, expected);
      const ids = s.slots.map(row => row.id).filter(Boolean);
      assert.equal(ids.length, new Set(ids).size);
    }
    for (const [id, s] of Object.entries(r.absences)) {
      assert(!s.slots.some(p => p.id === id));
      assert(!s.wire.slots.some(p => p.id === id));
      assert(s.wire.total >= s.total);
    }
  }
});
test('Rank placeholders, absent projections, and uncertainty are disclosed', () => {
  for (const text of ['not a win probability or an ESPN grade', 'not a zero-points projection',
    'not a matchup forecast', 'not a prediction', 'no independent league export', '301',
    '60%', '20%', '80/10/10', '40/40/20', '35/15/50', 'six from 60-plus']) assert(html.includes(text), text);
  assert.equal(result.players.filter(p => ['K', 'DST'].includes(p.position) && p.points === null).length, 16);
});
test('Writing pass has no stock openers or rhetorical em dashes', () => {
  const prose = Object.values(teams).flatMap(t => [t.headline, ...t.paragraphs, t.action]).join('\n');
  assert(!prose.includes('—'));
  for (const phrase of ['What matters is', 'The key takeaway', 'not just', 'at the forefront', 'caught my eye', 'utilize']) assert(!prose.includes(phrase));
});
