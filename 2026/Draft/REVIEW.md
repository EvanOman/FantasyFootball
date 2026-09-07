# 2026 Analysis Verification

The current page uses the 2025 report's original five plot expressions, default knitr HTML styling, section order, printed tables, and searchable ledger. It computes `RankDiff = Rank - PickNumber`; lower is better against the source ordering.

The September 2 ESPN PPR Superflex sheet ranks Travis Etienne Jr. 45th. Fauxgendaz's round-11 selection, overall pick 84, is treated as Travis based on Evan's recollection that the higher-ranked Etienne was selected. The supplied table contains only one Etienne entry. Its identity is not independently confirmed against a league draft export.

Current inputs contain 128 picks: 124 ranked matches and four known unmatched selections (Odell Beckham Jr., Tyler Bass, Chicago D/ST, and Minnesota D/ST). The report uses the historical 301 comparison value for those four.

Tests cover snake order, all 128 cells, exact identity joins, explicit aliases, duplicate rejection, corrected Etienne arithmetic (45 - 84 = -39), and consistency between the audited ledger and the prior-format CSV exports. A report-parity check requires exactly the same five ggplot expressions as 2025 and rejects the custom styling introduced in the replaced version.

An independent reviewer verified all 128 rendered ledger records, the corrected arithmetic, and parity with the 2025 R code blocks apart from year-specific filenames. The 197 checks pass. Review also corrected the original page's reversed earlier/later wording; no substantive findings remain.

Source provenance is in `data/provenance.json`. The fixed ranking snapshot remains unchanged.
