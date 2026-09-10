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

The matchup desk compares any two legal lineups, including specialists, and shows all 56 ordered head-to-head projection gaps. The common controls cover 2-WR/3-WR formats, individual absences, every bye week, documented unavailable players, and an optimistic one-pickup sensitivity. Pickup scenarios are independent; the same free agent can appear on more than one hypothetical roster. The weighting view contrasts six score presets with the unchanged legacy metric.

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

## Historical diminishing-returns lens (September 10 UTC update)

The user requested a ten-season test of value concentration and a rank-to-value metric incorporated into scoring. This extension preserves the original knitr report and the existing points/lineup model. It does not fit individual player-performance forecasts.

Inputs, frozen in `data/history.json` with 40 source URLs and SHA-256 hashes:

- nflverse `stats_player_reg_YEAR.csv`, 2016–2025, using the published `fantasy_points_ppr` field. Full regular seasons include the final NFL week and exclude playoffs.
- nflverse annual rosters for season-specific positions. Current-career labels in the results files can be misleading (for example, early Jordan Matthews seasons). GSIS identities join the sources. Travis Hunter's offensive points use WR, supported by Jacksonville's [WR/DB designation](https://www.jaguars.com/news/k000227-travis-hunter-undergoes-successful-knee-surgery), despite the statistics file's CB label.
- [Fantasy Football Calculator](https://help.fantasyfootballcalculator.com/article/42-adp-rest-api), 12-team preseason two-QB and one-QB PPR mock ADP. Each sample includes its first 140 offensive players, ordered by ADP, with decimal ADP and the source date window retained. The two-QB API does not establish historical reception scoring. Neither price history is an exact eight-team ESPN PPR superflex board. Both are evaluated against the same realized full-PPR outcomes.

All 2,800 player-season/ADP-format observations are matched. Zero-production selections remain in the sample: a known GSIS identity with no regular-season results row receives zero, never an unresolved name. Name aliases, position corrections, and zero-result matches are audited. Historical API team/bye fields are ignored because they can describe the player's current team. Dates and draft counts remain in each year's metadata.

Replacement pools all eight teams' mandatory QB/2RB/2WR/TE slots, eight FLEX, and eight SUPERFLEX slots. An exact position-count optimizer selects 64 offensive starters (72 with three WR); replacement is the next unselected player at each position. Positive value is `max(0, PPR total − position replacement total) / scheduled games`, using 16 games through 2020 and 17 thereafter. This measures full-season production above a static starter baseline, with injury absences included. It is not weekly streaming value, a bench-depth waiver baseline, or literal fantasy points a roster can score simultaneously.

Ten-player preseason bands show raw mean total PPR points and positive replacement value, plus the observed range of season means (not a confidence interval). Each season has equal weight. Weighted pool-adjacent-violators provides a nonincreasing least-squares fit of the band means; linear interpolation between band centers supplies curve credits. The first band is flat before its center. Known ranks beyond 140 keep the last observed band value, avoiding a fabricated cutoff; unranked players receive zero credit. K/D/ST are excluded from this offensive model and remain displayed and assessed separately elsewhere.

For 2026, a pick's curve surplus is `credit(ESPN rank) − credit(actual pick)`. Sum across offensive draft picks to measure acquisition quality. Bench assets count as acquired assets, not simultaneous starters. The primary index now uses percentiles weighted 60% starting points, 20% coverage, 10% ESPN auction surplus, and 10% curve surplus. The original 20% value budget is split between related signals rather than doubled. `withHistoricalScores` enriches the rows without changing the existing `summarize` contract; the exact previous index remains the `espn` preset. The `history` preset uses 60/20/0/20. The history panel's sample controls are sensitivity experiments and do not rewrite the fixed-reference published grades.

Findings: the eventual top 30/40 account for 79.4%/89.9% of positive value on average, while the preseason two-QB top 40 captures 58.8%. Preseason top-ten positive value averages 4.6 versus 2.3 at ranks 31–40; the top ten beat the next ten in seven of ten seasons. Observed reversals remain visible. Magic leads ten-year curve surplus (+6.2), narrowly ahead of Rome (+5.7); 2016–2020 favors Rome while 2021–2025 favors Magic. Rome remains first on the combined index. Think Tank moves above Clint from their previous index tie. All editorial letters remain unchanged, with a historical-value paragraph added to every assessment.

Reimport using `node import-history.mjs /path/to/dedicated/cache`, then rebuild. Downloads are cached. An existing manifest rejects changed bytes or URLs; refreshing a source requires explicit review and updating its manifest. Normal builds are offline and use committed extracts. `data/value-analysis.json` contains both format calculations, per-season replacement lines, final value/position ranks, matched preseason picks, and curve bands.

The value tests cover source coverage, zero seasons, historical positions, interpolation, weighted smoothing, independent pooled-slot optimization, concentration arithmetic, immutable old scoring behavior, all new weights, and reproducible exports. After the browser reports `data-value-ready=true`, also run:

```sh
agent-browser --session draft-value eval --stdin < tests/browser-value-audit.js
```

This checks all 52 combinations of ADP source, sample and lineup format; all 14 bands; both chart measures; four cutoffs; and every one of the 128 pick rows, including excluded specialists. Run all three browser audits at desktop and mobile widths, locally and after deployment.
