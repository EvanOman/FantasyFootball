source("../Draft/R/analysis.R")
result <- analyze_draft("../Draft")
jsonlite::write_json(list(teams = draft_team_order, ledger = result$ledger,
                         rankings = result$rankings, source = result$source),
                     "data/draft.json", pretty = TRUE, auto_unbox = TRUE, na = "null")
cat("Exported the audited 128-pick draft without changing the original report.\n")
