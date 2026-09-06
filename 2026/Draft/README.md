# 2026 Draft Analysis

[Read the knitr report on GitHub Pages](https://evanoman.github.io/FantasyFootball/2026/Draft/).

The report compares Evan's complete 128-pick draft with the September 2, 2026 ESPN PPR Superflex Top 300 used by [Board Calls](https://evanoman.com/board-calls/). It includes offensive and all-position comparisons, ranked-only and unranked-penalty sensitivity, position and round charts, every team's roster, a searchable ledger, and a complete join audit.

Evan confirmed the standard eight-team snake order and Odell Beckham Jr. at Fauxgendaz's round-10 slot (overall pick 77). ESPN's source assumes 10 teams; the report treats its rankings as an external benchmark without inferring this league's lineup or projected points.

## Rebuild

From the repository root:

```sh
Rscript 2026/Draft/render.R
```

The command runs the analysis tests, exports the CSVs, and knits `index.Rmd` to a self-contained `index.html`. It uses the frozen local source; it does not fetch new rankings.

Required software: R, Pandoc, and R packages `jsonlite`, `knitr`, `rmarkdown`, `ggplot2`, `DT`, and `htmltools`, including their normal dependencies. All were already installed on the build machine. The verified build uses R 4.1.2, Pandoc 2.9.2.1, jsonlite 2.0.0, knitr 1.50, rmarkdown 2.29, ggplot2 4.0.0, and DT 0.34.0. Full package versions are in the report's R session disclosure.

On another machine, install missing R packages with:

```r
install.packages(c("jsonlite", "knitr", "rmarkdown", "ggplot2", "DT", "htmltools"))
```

Run only the data/analysis checks from `2026/Draft` with:

```sh
Rscript tests/test-analysis.R
```

## Inputs and outputs

- `data/draft-board-2026.csv` preserves every user-supplied name and team column, with the confirmed Beckham correction.
- `data/board-calls-rankings.json` freezes the live Board Calls snapshot; `data/provenance.json` records dates and source assumptions.
- `data/name-aliases.csv` documents 19 position-specific name conversions. Five genuinely unranked identities have an explicit allowlist in `R/analysis.R`.
- `data/draft-ledger.csv` preserves actual nullable `Rank` and `Surplus`; `RankFloor`/`SurplusFloor` apply the 301 boundary separately. `LegacyScore` has the older report's reversed sign.
- `data/team-summary.csv` covers QB/RB/WR/TE; `data/all-position-team-summary.csv` includes K/DST. Sensitivity, join audit, position counts, source rankings, and undrafted Top 300 entries are also exported.
- `Figs/` contains standalone chart images; the rendered HTML embeds the same figures.
- `REVIEW.md` records independent source and implementation reviews and verification evidence.

Positive surplus means a selection came after its ESPN rank. Rank differences are not point projections. A value of 301 is a comparison boundary for absent players, not an observed rank; 350/400 scenarios are hypothetical sensitivity checks.
