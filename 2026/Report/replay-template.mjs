export const replayTemplate = `<section class="lab-section" id="replay" aria-labelledby="replay-title">
<div class="section-heading"><div><h2 id="replay-title">Draft replay</h2><p>Scrub to any pick, jump a round, or select a square on the board. Follow a team to see its roster at that point.</p></div></div>
<p id="replay-loading" role="status">Loading the draft…</p><div id="replay-content" hidden>
<div class="replay-controls"><div class="replay-counter"><span id="pick-counter">128 / 128</span><small id="round-counter">Draft complete</small></div>
<div class="scrubber"><label for="pick-scrub">Draft progress</label><input id="pick-scrub" type="range" min="0" max="128" step="1" value="128"><div class="range-ends"><span>Before pick 1</span><span>16 rounds</span></div></div>
<div class="transport"><button id="round-back" aria-label="Previous round">← Round</button><button id="replay-play" aria-pressed="false">Play</button><button id="round-next" aria-label="Next round">Round →</button><button id="replay-reset">Start</button><button id="replay-end">End</button></div></div>
<div class="control-row"><label>Follow a team<select id="replay-team"></select></label><label>Highlight a position<select id="replay-position"><option value="all">All positions</option><option>QB</option><option>RB</option><option>WR</option><option>TE</option><option>K</option><option value="DST">D/ST</option></select></label><span class="control-note">Columns keep their draft slots; even rounds run right to left.</span></div>
<div id="pick-detail" class="pick-detail" aria-live="polite" aria-atomic="true"></div>
<div class="position-key" aria-label="Position colors"><span class="pos-QB">QB</span><span class="pos-RB">RB</span><span class="pos-WR">WR</span><span class="pos-TE">TE</span><span class="pos-K">K</span><span class="pos-DST">D/ST</span></div>
<div class="board-scroll" tabindex="0" aria-label="Scrollable 16-round draft board"><table id="draft-board" class="draft-board"><caption>2026 snake draft · select a pick to move the cursor</caption></table></div>
<h3 class="subheading" id="replay-roster-title">Selected roster</h3><div id="replay-roster" class="roster-scroll"></div>
<p class="caption replay-source">Ranks use the frozen September 2 ESPN PPR superflex board. The Etienne entry is treated as Travis on Evan’s recollection, pending a league export. Beckham is the confirmed round-10 pick. <a href="#method">Sources and draft corrections</a>.</p>
</div></section>`;
