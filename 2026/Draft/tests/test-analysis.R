# Run from 2026/Draft: Rscript tests/test-analysis.R
source("R/analysis.R")
board <- read.csv("data/draft-board-2026.csv", check.names = FALSE, stringsAsFactors = FALSE)
ranking_source <- jsonlite::fromJSON("data/board-calls-rankings.json")
aliases <- read.csv("data/name-aliases.csv", stringsAsFactors = FALSE)
result <- build_analysis(board, ranking_source, aliases)
d <- result$ledger
checks <- 0L
check <- function(condition) {
  stopifnot(isTRUE(condition))
  checks <<- checks + 1L
}
expect_error <- function(expression, pattern) {
  message <- tryCatch({ force(expression); NULL }, error = function(error) conditionMessage(error))
  if (is.null(message) || !grepl(pattern, message)) {
    stop(paste("Expected error matching", pattern, "but received", message))
  }
  checks <<- checks + 1L
}

# Known snake boundaries and user-confirmed empty-cell correction.
check(identical(d$PickNumber, 1:128))
check(identical(d$Team[c(1, 8, 9, 16, 17, 77, 128)],
                c("Flames", "Think Tank", "Think Tank", "Flames", "Flames", "Fauxgendaz", "Flames")))
check(identical(d$Player[c(1, 8, 9, 16, 17, 77, 128)],
                c("Jahmyr Gibbs", "James Cook", "Jonathan Taylor", "Kyler Murray", "Najee Harris", "Odell Beckham Jr.", "Chicago Bears")))
check(d$Round[77] == 10L && d$TeamSlot[77] == 4L && d$PickInRound[77] == 5L)
check(all(table(d$Team) == 16L) && all(table(d$Round) == 8L))
for (i in seq_len(nrow(d))) {
  check(identical(d$RawLabel[i], board[[d$Team[i]]][d$Round[i]]))
}

# Every match has explicit provenance; all four absent identities stay missing.
check(nrow(result$rankings) == 300L && sum(d$Ranked) == 124L)
check(setequal(d$CanonicalPlayer[!d$Ranked],
               c("Odell Beckham Jr.", "Tyler Bass", "Bears D/ST", "Vikings D/ST")))
check(all(is.na(d$Rank[!d$Ranked])) && all(d$RankFloor[!d$Ranked] == 301L))
check(all(is.na(d$Surplus[!d$Ranked])))
check(sum(d$MatchMethod == "alias") == 19L && all(nzchar(d$MatchReason)))
check(d$CanonicalPlayer[d$Player == "Kenneth Gainwell"] == "Kenny Gainwell")
check(d$Rank[d$Player == "James Cook"] == 18L)
check(d$Rank[d$Player == "Kyle Pitts"] == 74L)
check(d$Position[128] == "DST" && d$RawLabel[128] == "DEF - Chicago Bears")
check(d$Player[84] == "Travis Etienne Jr." && d$Rank[84] == 45L && d$Surplus[84] == 39L)
check(!any(d$Player == "Trevor Etienne"))
check(!"Travis Etienne Jr." %in% result$undrafted$CanonicalPlayer)
check(nrow(result$undrafted) == 176L)
check(!any(identity_key(result$undrafted$Position, result$undrafted$CanonicalPlayer) %in%
           identity_key(d$Position, d$CanonicalPlayer)))

# Independent arithmetic expectations: a late elite QB has positive surplus.
check(d$Surplus[1] == -3L)
check(d$Surplus[d$Player == "Patrick Mahomes"] == 44L)
check(d$Surplus[d$Player == "Jeremiyah Love"] == 48L)
check(d$Surplus[d$Player == "David Njoku"] == -190L)
check(d$SurplusFloor[77] == -224L)
check(d$LegacyScore[77] == 224L)
check(all(d$Surplus[d$Ranked] == d$PickNumber[d$Ranked] - d$Rank[d$Ranked]))
check(all(d$LegacyScore == -d$SurplusFloor))
check(sum(result$teams$Picks) == 112L && sum(result$teams$Scored) == 111L && sum(result$teams$Missing) == 1L)
check(all(result$teams$Picks == 14L) && all(result$all_teams$Picks == 16L))
check(sum(result$all_teams$Scored) == 124L && sum(result$all_teams$Missing) == 4L)
# Independent totals, with Fauxgendaz increased by 301 - 45 = 256 for the Etienne correction.
check(identical(result$teams$Team, c("Rome Reigns", "Purple Rain", "Think Tank", "Magic Skol Bus",
                                  "Clint Bilton", "NKFL", "Fauxgendaz", "Flames")))
check(isTRUE(all.equal(result$teams$TotalFloorSurplus, c(167, 73, 39, -97, -165, -436, -687, -696))))
check(isTRUE(all.equal(result$all_teams$MeanFloorSurplus[1:3], c(-2.5, -4.625, -5.125))))
faux <- result$teams[result$teams$Team == "Fauxgendaz", ]
faux_ranked <- d$Surplus[d$Team == "Fauxgendaz" & d$Position %in% skill_positions & d$Ranked]
check(faux$Scored == 13L && faux$Missing == 1L && faux$MeanRankedSurplus == mean(faux_ranked))
check(faux$MedianRankedSurplus == median(faux_ranked))
check(all(result$teams$SurplusHits + result$teams$EvenPicks + result$teams$NegativePicks == result$teams$Scored))
check(all(rowSums(result$positions[draft_positions]) == 16L))
check(sum(result$first_eight$Missing) == 0L && all(result$first_eight$Scored == 8L))
s <- result$sensitivity
check(nrow(s) == 80L && all(table(s$Scope, s$Scenario) == 8L))
faux301 <- s$MeanSurplus[s$Scope == "Skill" & s$Team == "Fauxgendaz" & s$Scenario == "Floor 301"]
faux400 <- s$MeanSurplus[s$Scope == "Skill" & s$Team == "Fauxgendaz" & s$Scenario == "Floor 400"]
check(abs((faux301 - faux400) - 99 / 14) < 1e-12)
check(s$MeanSurplus[s$Scope == "Skill" & s$Team == "Fauxgendaz" & s$Scenario == "Ranked only"] == faux$MeanRankedSurplus)

# Fail closed on malformed input and join mistakes instead of hiding losses.
bad <- board
bad[10, "Fauxgendaz"] <- ""
expect_error(build_analysis(bad, ranking_source, aliases), "malformed")
bad <- board
bad$Round[16] <- 15
expect_error(build_analysis(bad, ranking_source, aliases), "rounds 1 through 16")
bad <- board[-16, ]
expect_error(build_analysis(bad, ranking_source, aliases), "rounds 1 through 16")
bad <- board[c("Round", rev(draft_team_order))]
expect_error(build_analysis(bad, ranking_source, aliases), "schema")
bad <- board
bad[16, "Flames"] <- "DEF - Chicago Beers"
expect_error(build_analysis(bad, ranking_source, aliases), "not explicitly allowed")
bad <- board
bad[11, "Fauxgendaz"] <- "RB - Trever Etienne"
expect_error(build_analysis(bad, ranking_source, aliases), "not explicitly allowed")
bad <- board
bad[1, "Flames"] <- "WR - Jahmyr Gibbs"
expect_error(build_analysis(bad, ranking_source, aliases), "position mismatch")
bad <- board
bad[1, "Think Tank"] <- "TE - James Cook"
expect_error(build_analysis(bad, ranking_source, aliases), "position mismatch")
bad <- board
bad[11, "Fauxgendaz"] <- "WR - Travis Etienne Jr."
expect_error(build_analysis(bad, ranking_source, aliases), "position mismatch")
bad <- board
bad[3, "Flames"] <- bad[1, "Flames"]
expect_error(build_analysis(bad, ranking_source, aliases), "Duplicate draft")
bad <- board
bad[3, "Flames"] <- "RB - James Cook III"
expect_error(build_analysis(bad, ranking_source, aliases), "canonical identities")
bad <- ranking_source
bad$players$rank[2] <- 1L
expect_error(build_analysis(board, bad, aliases), "Duplicate source ranks")
bad <- ranking_source
bad$players$name[2] <- bad$players$name[1]
expect_error(build_analysis(board, bad, aliases), "Duplicate source position/name")
bad <- ranking_source
bad$players <- bad$players[-300, ]
expect_error(build_analysis(board, bad, aliases), "exactly 300")
bad <- ranking_source
bad$players$rank[300] <- 300.5
expect_error(build_analysis(board, bad, aliases), "integers 1 through 300")
bad <- ranking_source
bad$players$position[1] <- "RB"
expect_error(build_analysis(board, bad, aliases), "Duplicate source positional ranks")
bad <- rbind(aliases, aliases[1, ])
expect_error(build_analysis(board, ranking_source, bad), "Duplicate alias")
bad <- aliases
bad$CanonicalPlayer[1] <- "James Cook II"
expect_error(build_analysis(board, ranking_source, bad), "Alias target")
bad <- rbind(aliases, data.frame(Position = "RB", InputPlayer = "Jahmyr Gibbs", CanonicalPlayer = "Bijan Robinson", Reason = "Bad override"))
expect_error(build_analysis(board, ranking_source, bad), "shadows an exact")

# Row/ranking order must never drive joins, and exports round-trip missing ranks.
reordered <- ranking_source
reordered$players <- reordered$players[300:1, ]
check(identical(build_analysis(board, reordered, aliases)$ledger, d))
out <- tempfile("draft-analysis-test-")
dir.create(file.path(out, "data"), recursive = TRUE)
export_analysis(result, out)
roundtrip <- read.csv(file.path(out, "data", "draft-ledger.csv"), stringsAsFactors = FALSE)
check(nrow(roundtrip) == 128L && sum(is.na(roundtrip$Rank)) == 4L)
check(identical(roundtrip$RawLabel, d$RawLabel))

# The original page consumes these exports and must compute the same scores.
legacy_draft <- read.csv(file.path(out, "data", "Draft2026.csv"), stringsAsFactors = FALSE)
legacy_ranks <- read.csv(file.path(out, "data", "espn_superflex_ppr_2026.csv"), stringsAsFactors = FALSE)
legacy_rank <- legacy_ranks$Rank[match(legacy_draft$Player, legacy_ranks$Player)]
check(sum(is.na(legacy_rank)) == 4L)
legacy_rank[is.na(legacy_rank)] <- 301L
check(identical(legacy_draft$OverallPick, d$PickNumber))
check(all(legacy_rank - legacy_draft$OverallPick == d$LegacyScore))
check(legacy_draft$Player[84] == "Travis Etienne Jr." && legacy_rank[84] == 45L)

# The requested page preserves exactly the prior five ggplot expressions.
prior_report <- readLines("../../2025/Draft/index.Rmd", warn = FALSE)
current_report <- readLines("index.Rmd", warn = FALSE)
prior_plots <- prior_report[grepl("^ggplot\\(", prior_report)]
current_plots <- current_report[grepl("^ggplot\\(", current_report)]
check(length(current_plots) == 5L && identical(current_plots, prior_plots))
check(!any(grepl("report.css|toc_float|theme_set|geom_col|metric-strip", current_report)))
cat(sprintf("PASS: %d analysis assertions; 128 picks, 124 ranked, 4 explicitly unranked, 19 aliases.\n", checks))
