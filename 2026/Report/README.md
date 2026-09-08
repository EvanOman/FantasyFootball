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

## Draft Lab

Evan requested a scrub-able draft history, lineup comparisons, and an Elo-style head-to-head angle, with other choices delegated. All player-performance inputs remain published ESPN projections or rankings. No new player-performance model is fitted.

The complete snake board keeps managers in fixed columns and marks the reverse order in even rounds. Scrub all 129 states, jump rounds, click a pick, play/pause in eight-pick increments, highlight positions including K/D/ST, and follow a roster with its cumulative lineup curve. No animation is needed to use the page.

The matchup desk compares any two legal lineups, including specialists, and shows all 56 ordered head-to-head projection gaps. The common controls cover 2-WR/3-WR formats, individual absences, every bye week, documented unavailable players, and an optimistic one-pickup sensitivity. Pickup scenarios are independent; the same free agent can appear on more than one hypothetical roster. The weighting view contrasts all four score presets with the unchanged legacy metric.

The Elo-style power scale is `1500 + 400 * log10(P / G)`, where `P` is a legal lineup's published point total and `G` is the baseline cohort's geometric mean. The reference stays fixed within a format when scenarios change. It is a transparent display transform, not an outcome-trained Elo model. Its logistic share is exactly `P1 / (P1 + P2)`, **not a fantasy win probability**. No weekly variance, injury probabilities, correlations, or new player forecasts are invented. The US Chess standard expectancy formula is linked as mathematical background, not an endorsement of this fantasy application.

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

The exported-scenario tests independently sum the selected players, check roster ownership, and verify bye and availability exclusions. After opening the locally served report in an `agent-browser` session, run these at desktop and mobile widths:

```sh
agent-browser --session draft-grades eval --stdin < tests/browser-audit.js
agent-browser --session draft-grades eval --stdin < tests/browser-lab-audit.js
```

The report audit compares all eight scoreboard rows and all 80 displayed lineup rows to the export. The Lab audit exercises every control, all 129 scrub states, and 216 displayed lineups across formats and scenarios, including every bye week. It checks keyboard tab focus, source navigation, resets, and page overflow. Browser interactions supplement the independent exhaustive optimizer and power-scale model tests; a screenshot alone does not establish arithmetic correctness.

Deployment target: `https://evanoman.github.io/FantasyFootball/2026/Report/`. Publish through a normal pull request into `gh-pages`, then verify the live artifact and interactions. The original `2026/Draft/` content must remain byte-identical.

Editorial pass: team assessments and Lab explanations were revised using Evan's prose guidance. Letter grades are editorial opinions, model scores are labeled relative, and dated injury reports are not translated into invented medical probabilities. The report identifies its analysis as AI-written.
