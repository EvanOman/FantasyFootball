# 2026 draft grades and Draft Lab

Purpose: help the eight managers understand why their grades differ when we compare draft prices, legal starting lineups, and the bench's ability to cover absences.

This is a separate report. `../Draft/` remains the original knitr page and must not change.

## Evidence and assumptions

- The supplied 128-pick snake draft and documented Travis Etienne correction come from `../Draft/data/`.
- Use the frozen September 2 ESPN PPR superflex rankings, including their positional ranks and salary values. They assume ten teams; this league has eight.
- Evan confirmed QB, 2 RB, 2 WR, TE, FLEX, SUPERFLEX, K, and D/ST. Six bench slots remain. ESPN's standard PPR rules supply the default scoring, including four-point passing TDs. A custom league-settings export was not supplied.
- Mike Clay's September 7 projections supply a separate points-based comparison. Season totals divided by 17 are per-game equivalents, not Week 1 forecasts. Do not treat ordinal ranks or auction dollars as projected points.
- Injury/availability facts require dated sources. Uniform starter-out scenarios measure resilience, not the probability that a player gets hurt. Do not double-discount known missed games already present in Clay's totals.
- K and D/ST belong in every displayed full lineup. The projection guide has no comparable published PPR point totals for those positions, so offensive comparison totals explicitly exclude them. Their ESPN position ranks are assessed separately.

## Draft Lab design checkpoint

Proposed intuitions: a bargain can sit on the bench; RB1/RB2 and superflex slots change the value of depth; a roster's response to an absence matters separately from injury probability. Contrast each view with the old average rank-difference result.

Proposed persistent state: the complete snake board, selected roster, and comparison metrics. Operations: scrub/step/replay picks, select teams, change lineup format, remove a starter, and reset. Animate the current pick and its resulting changes only. These targets and the state/operation inventory were sent to Evan for confirmation; the Draft Lab UI is gated pending his response.

Presentation direction: a sports annual with cream paper, dark ink, red editorial accents, large serif headlines, and compact data graphics. No frontend framework or package install is needed. A standalone tested analysis module owns the calculations; browser event handlers only select inputs and render results. Static hosting on the existing GitHub Pages site is retained.

## Source import

Download the source URL recorded in `data/projections.json` to a temporary file, then run `node import-projections.mjs /path/to/file.pdf`. Import requires the recorded SHA-256; a changed live PDF requires an explicit source review. `pdftotext` is the only external import utility. Numerical extracts are committed; the complete source publication is linked rather than redistributed.

## Rebuild and verify

Run from this directory:

```sh
Rscript export-input.R
node build.mjs
node --test tests/*.test.mjs
```

The R export uses the original report's audited joins without rewriting that report. The new module joins all 112 offensive selections to published PPR projections, with position-qualified aliases. The four unranked selections inherit byes from their NFL team's other ESPN ranking entries; this inference is flagged in the model. It does not invent individual ranks.

The model tests include an independent exhaustive-subset optimizer for all eight teams, two formats, and two metrics. Scenario tests cover starter exclusions, byes, partial rosters, empty slots, and the actual available board at every pick. A SHA-256 guard proves the original knitr HTML is unchanged.

Current stage: the report is drafted and rendered locally. The analysis export already contains 129 replay states and the lineup/absence sensitivities. The Draft Lab is an explicit unfinished placeholder pending its design checkpoint; do not publish or mark the overall task complete yet.

Editorial pass: team assessments were revised using the prose runbook and writing-coach principles. The prose uses zero rhetorical em dashes; the dash in unavailable numeric table cells is a data marker. Letter grades are editorial opinions, model scores are labeled relative, and dated injury reports are not translated into invented medical probabilities.
