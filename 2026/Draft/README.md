# 2026 Draft Analysis

[Read the knitr report](https://evanoman.github.io/FantasyFootball/2026/Draft/).

Uses the 2025 report's original layout, five plots, summary tables, and searchable ledger with the 2026 draft and Board Calls' September 2 ESPN PPR Superflex rankings.

The draft has 128 picks. Fauxgendaz's round-11 selection is treated as Travis Etienne Jr. (rank 45), based on Evan's recollection that the higher-ranked Etienne was drafted. Only one Etienne entry appears in the supplied table; no separate Trevor selection is inferred.

From the repository root:

```sh
Rscript 2026/Draft/render.R
```

The build checks the input and joins, exports `data/Draft2026.csv` and `data/espn_superflex_ppr_2026.csv` in the prior report's format, and renders `index.Rmd`. Required packages are jsonlite, knitr, rmarkdown, ggplot2, DT, and dplyr, plus Pandoc. All are installed on the build machine.

The four unmatched selections retain the previous page's 301 comparison convention. The underlying audit exports preserve missing actual ranks separately. Names use explicit aliases; the Etienne correction is recorded in `data/provenance.json`.
