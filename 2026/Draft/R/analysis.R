# Deterministic analysis of the supplied 8-team, 16-round snake draft.
# Only exact, position-qualified names and documented aliases may join.

draft_team_order <- c(
  "Flames", "Clint Bilton", "NKFL", "Fauxgendaz", "Purple Rain",
  "Rome Reigns", "Magic Skol Bus", "Think Tank"
)
draft_positions <- c("QB", "RB", "WR", "TE", "K", "DST")
skill_positions <- c("QB", "RB", "WR", "TE")

assert_analysis <- function(condition, message) {
  if (!isTRUE(condition)) stop(message, call. = FALSE)
}

identity_key <- function(position, player) paste(position, player, sep = "|")

unranked_allowlist <- function() {
  data.frame(
    Position = c("WR", "K", "DST", "DST"),
    CanonicalPlayer = c(
      "Odell Beckham Jr.", "Tyler Bass",
      "Bears D/ST", "Vikings D/ST"
    ),
    Reason = c(
      "User-confirmed Fauxgendaz round-10 selection; absent from this source Top 300.",
      "Supplied kicker is absent from this source Top 300.",
      "Chicago defensive unit is absent from this source Top 300.",
      "Minnesota defensive unit is absent from this source Top 300."
    ),
    stringsAsFactors = FALSE
  )
}

validate_rankings <- function(source) {
  assert_analysis(is.list(source) && is.data.frame(source$players),
                  "Ranking JSON must contain a players table.")
  p <- source$players
  required <- c("rank", "name", "position", "positionRank", "team", "salaryValue", "bye")
  assert_analysis(all(required %in% names(p)), "Ranking schema is missing required fields.")
  assert_analysis(nrow(p) == 300L, "Expected exactly 300 source ranking rows.")
  assert_analysis(is.numeric(p$rank) && !anyNA(p$rank), "Ranks must be numeric and nonmissing.")
  assert_analysis(!anyDuplicated(p$rank), "Duplicate source ranks.")
  assert_analysis(identical(sort(as.integer(p$rank)), 1:300) && all(p$rank == as.integer(p$rank)),
                  "Source ranks must be the integers 1 through 300.")
  assert_analysis(!anyNA(p$name) && all(nzchar(trimws(p$name))) && all(p$name == trimws(p$name)),
                  "Source player names must be nonempty and have no surrounding whitespace.")
  assert_analysis(!anyNA(p$position) && all(p$position %in% draft_positions),
                  "Invalid source position.")
  assert_analysis(!anyDuplicated(identity_key(p$position, p$name)),
                  "Duplicate source position/name keys.")
  assert_analysis(!anyDuplicated(p$name), "Duplicate source player names across positions.")
  assert_analysis(is.numeric(p$positionRank) && !anyNA(p$positionRank) &&
                    all(p$positionRank >= 1 & p$positionRank == as.integer(p$positionRank)),
                  "Position ranks must be positive integers.")
  assert_analysis(!anyDuplicated(identity_key(p$position, p$positionRank)),
                  "Duplicate source positional ranks.")
  assert_analysis(!anyNA(p$team) && all(nzchar(p$team)), "Missing source NFL team.")
  assert_analysis(is.numeric(p$salaryValue) && all(is.finite(p$salaryValue)),
                  "Invalid source salary value.")
  assert_analysis(is.numeric(p$bye) && all(is.finite(p$bye)) &&
                    all(p$bye == as.integer(p$bye) & p$bye >= 1 & p$bye <= 18),
                  "Invalid source bye week.")
  rankings <- p[required]
  names(rankings) <- c("Rank", "CanonicalPlayer", "Position", "PositionRank", "NFLTeam", "SalaryValue", "Bye")
  rankings <- rankings[order(rankings$Rank), ]
  rownames(rankings) <- NULL
  rankings
}

parse_draft <- function(board) {
  assert_analysis(is.data.frame(board) && identical(names(board), c("Round", draft_team_order)),
                  "Board schema must be Round plus the eight supplied teams in draft-slot order.")
  assert_analysis(nrow(board) == 16L && is.numeric(board$Round) &&
                    !anyNA(board$Round) && identical(as.numeric(board$Round), as.numeric(1:16)),
                  "Board must contain exactly rounds 1 through 16 in order.")
  draft <- do.call(rbind, lapply(seq_len(16L), function(round) {
    raw <- as.character(unlist(board[round, draft_team_order], use.names = FALSE))
    assert_analysis(!anyNA(raw) && all(grepl("^(QB|RB|WR|TE|K|DEF|DST) - .+", raw)),
                    paste("Missing or malformed player label in round", round))
    player <- sub("^[A-Z]+ - ", "", raw)
    assert_analysis(all(nzchar(trimws(player))) && all(player == trimws(player)),
                    paste("Empty or padded player name in round", round))
    position <- sub(" - .*", "", raw)
    position[position == "DEF"] <- "DST"
    slot <- seq_len(8L)
    pick_in_round <- if (round %% 2L == 1L) slot else 9L - slot
    data.frame(
      Round = round, Team = draft_team_order, TeamSlot = slot,
      PickInRound = pick_in_round, PickNumber = (round - 1L) * 8L + pick_in_round,
      RawLabel = raw, Player = player, Position = position,
      stringsAsFactors = FALSE
    )
  }))
  assert_analysis(nrow(draft) == 128L && identical(sort(draft$PickNumber), 1:128),
                  "Draft must preserve exactly 128 distinct picks.")
  assert_analysis(!anyDuplicated(identity_key(draft$Position, draft$Player)),
                  "Duplicate draft position/name identities.")
  draft <- draft[order(draft$PickNumber), ]
  rownames(draft) <- NULL
  draft
}

validate_aliases <- function(aliases, rankings, allowlist) {
  assert_analysis(is.data.frame(aliases) &&
                    identical(names(aliases), c("Position", "InputPlayer", "CanonicalPlayer", "Reason")),
                  "Alias schema must be Position, InputPlayer, CanonicalPlayer, Reason.")
  assert_analysis(!anyNA(aliases) && all(vapply(aliases, function(x) all(nzchar(trimws(x))), logical(1))),
                  "Alias fields must be nonempty.")
  assert_analysis(all(aliases$Position %in% draft_positions), "Invalid alias position.")
  key <- identity_key(aliases$Position, aliases$InputPlayer)
  assert_analysis(!anyDuplicated(key), "Duplicate alias input keys.")
  source_key <- identity_key(rankings$Position, rankings$CanonicalPlayer)
  assert_analysis(!any(key %in% source_key), "Alias shadows an exact source identity.")
  targets <- identity_key(aliases$Position, aliases$CanonicalPlayer)
  allowed <- identity_key(allowlist$Position, allowlist$CanonicalPlayer)
  assert_analysis(all(targets %in% c(source_key, allowed)),
                  "Alias target is neither a source identity nor an explicitly allowed unranked identity.")
  invisible(TRUE)
}

join_draft <- function(draft, rankings, aliases) {
  allowlist <- unranked_allowlist()
  validate_aliases(aliases, rankings, allowlist)
  ledger <- draft
  input_key <- identity_key(ledger$Position, ledger$Player)
  known_input_key <- c(
    identity_key(rankings$Position, rankings$CanonicalPlayer),
    identity_key(aliases$Position, aliases$InputPlayer),
    identity_key(allowlist$Position, allowlist$CanonicalPlayer)
  )
  known_input_name <- c(rankings$CanonicalPlayer, aliases$InputPlayer, allowlist$CanonicalPlayer)
  input_position_mismatch <- !input_key %in% known_input_key & ledger$Player %in% known_input_name
  assert_analysis(!any(input_position_mismatch), paste(
    "Draft/source position mismatch:", paste(ledger$RawLabel[input_position_mismatch], collapse = "; ")
  ))
  alias_row <- match(input_key, identity_key(aliases$Position, aliases$InputPlayer))
  has_alias <- !is.na(alias_row)
  ledger$CanonicalPlayer <- ledger$Player
  ledger$CanonicalPlayer[has_alias] <- aliases$CanonicalPlayer[alias_row[has_alias]]
  ledger$MatchMethod <- ifelse(has_alias, "alias", "exact")
  ledger$MatchReason <- "Exact name and position match."
  ledger$MatchReason[has_alias] <- aliases$Reason[alias_row[has_alias]]
  canonical_key <- identity_key(ledger$Position, ledger$CanonicalPlayer)
  assert_analysis(!anyDuplicated(canonical_key), "Duplicate draft canonical identities after alias resolution.")
  rank_row <- match(canonical_key, identity_key(rankings$Position, rankings$CanonicalPlayer))
  absent <- is.na(rank_row)
  wrong_position <- absent & ledger$CanonicalPlayer %in% rankings$CanonicalPlayer
  assert_analysis(!any(wrong_position), paste(
    "Draft/source position mismatch:", paste(ledger$RawLabel[wrong_position], collapse = "; ")
  ))
  allow_row <- match(canonical_key, identity_key(allowlist$Position, allowlist$CanonicalPlayer))
  unknown <- absent & is.na(allow_row)
  assert_analysis(!any(unknown), paste(
    "Unmatched player is not explicitly allowed:", paste(ledger$RawLabel[unknown], collapse = "; ")
  ))
  ledger$MatchStatus <- ifelse(absent, "unranked", "ranked")
  ledger$MatchMethod[absent & !has_alias] <- "allowlist"
  ledger$MatchReason[absent] <- paste(
    ifelse(has_alias[absent], paste0(ledger$MatchReason[absent], " "), ""),
    allowlist$Reason[allow_row[absent]], sep = ""
  )
  for (column in c("Rank", "PositionRank", "NFLTeam", "SalaryValue", "Bye")) {
    ledger[[column]] <- rankings[[column]][rank_row]
  }
  ledger$Ranked <- !is.na(ledger$Rank)
  ledger$RankFloor <- ifelse(ledger$Ranked, ledger$Rank, 301L)
  ledger$Surplus <- ledger$PickNumber - ledger$Rank
  # For an absent player, 301 is the best possible rank beyond this Top 300.
  # Its resulting surplus is an optimistic upper bound, not an observed rank.
  ledger$SurplusFloor <- ledger$PickNumber - ledger$RankFloor
  ledger$LegacyScore <- -ledger$SurplusFloor
  assert_analysis(nrow(ledger) == 128L && !anyDuplicated(ledger$PickNumber), "Join dropped or duplicated picks.")
  ledger
}

team_summary <- function(ledger) {
  rows <- lapply(draft_team_order, function(team) {
    d <- ledger[ledger$Team == team, ]
    scores <- d$Surplus[d$Ranked]
    data.frame(
      Team = team, Picks = nrow(d), Scored = length(scores), Missing = sum(!d$Ranked),
      MeanRankedSurplus = if (length(scores)) mean(scores) else NA_real_,
      MedianRankedSurplus = if (length(scores)) median(scores) else NA_real_,
      TotalRankedSurplus = if (length(scores)) sum(scores) else NA_real_,
      MeanFloorSurplus = if (nrow(d)) mean(d$SurplusFloor) else NA_real_,
      TotalFloorSurplus = if (nrow(d)) sum(d$SurplusFloor) else NA_real_,
      SurplusHits = sum(scores > 0), EvenPicks = sum(scores == 0), NegativePicks = sum(scores < 0),
      stringsAsFactors = FALSE
    )
  })
  result <- do.call(rbind, rows)
  result$FloorPlace <- rank(-result$MeanFloorSurplus, ties.method = "min", na.last = "keep")
  result$RankedPlace <- rank(-result$MeanRankedSurplus, ties.method = "min", na.last = "keep")
  result <- result[order(result$FloorPlace, match(result$Team, draft_team_order)), ]
  rownames(result) <- NULL
  result
}

sensitivity_analysis <- function(ledger) {
  rows <- list()
  scenarios <- c("Floor 301", "Floor 350", "Floor 400", "Ranked only", "First 8 rounds")
  for (scope in c("Skill", "All")) {
    scoped <- if (scope == "Skill") ledger[ledger$Position %in% skill_positions, ] else ledger
    for (scenario in scenarios) {
      d <- if (scenario == "First 8 rounds") scoped[scoped$Round <= 8L, ] else scoped
      imputed_rank <- switch(scenario, "Floor 301" = 301, "Floor 350" = 350, "Floor 400" = 400, NA_real_)
      d$ScenarioSurplus <- ifelse(
        d$Ranked, d$Surplus,
        if (is.na(imputed_rank)) NA_real_ else d$PickNumber - imputed_rank
      )
      scenario_rows <- do.call(rbind, lapply(draft_team_order, function(team) {
        t <- d[d$Team == team, ]
        scores <- t$ScenarioSurplus[!is.na(t$ScenarioSurplus)]
        data.frame(
          Scope = scope, Scenario = scenario, UnrankedRank = imputed_rank, Team = team,
          Picks = nrow(t), Scored = sum(t$Ranked), Missing = sum(!t$Ranked),
          MeanSurplus = if (length(scores)) mean(scores) else NA_real_,
          TotalSurplus = if (length(scores)) sum(scores) else NA_real_,
          stringsAsFactors = FALSE
        )
      }))
      scenario_rows$Place <- rank(-scenario_rows$MeanSurplus, ties.method = "min", na.last = "keep")
      rows[[length(rows) + 1L]] <- scenario_rows[order(scenario_rows$Place), ]
    }
  }
  result <- do.call(rbind, rows)
  rownames(result) <- NULL
  result
}

build_analysis <- function(board, source, aliases) {
  rankings <- validate_rankings(source)
  draft <- parse_draft(board)
  ledger <- join_draft(draft, rankings, aliases)
  skill <- ledger[ledger$Position %in% skill_positions, ]
  positions <- as.data.frame.matrix(table(
    factor(ledger$Team, levels = draft_team_order),
    factor(ledger$Position, levels = draft_positions)
  ))
  positions <- data.frame(Team = rownames(positions), positions, row.names = NULL, check.names = FALSE)
  picked_keys <- identity_key(ledger$Position, ledger$CanonicalPlayer)
  undrafted <- rankings[!identity_key(rankings$Position, rankings$CanonicalPlayer) %in% picked_keys, ]
  rownames(undrafted) <- NULL
  audit <- ledger[c("PickNumber", "Round", "Team", "RawLabel", "Player", "Position", "CanonicalPlayer",
                    "MatchMethod", "MatchStatus", "Rank", "MatchReason")]
  list(
    draft = draft, rankings = rankings, ledger = ledger, aliases = aliases, audit = audit,
    teams = team_summary(skill), all_teams = team_summary(ledger), positions = positions,
    undrafted = undrafted, sensitivity = sensitivity_analysis(ledger),
    first_eight = team_summary(ledger[ledger$Round <= 8L, ]),
    unranked = unranked_allowlist(), source = source[setdiff(names(source), "players")]
  )
}

analyze_draft <- function(path = ".") {
  assert_analysis(requireNamespace("jsonlite", quietly = TRUE), "Install jsonlite before running the analysis.")
  data_path <- file.path(path, "data")
  board <- read.csv(file.path(data_path, "draft-board-2026.csv"), check.names = FALSE, stringsAsFactors = FALSE)
  source <- jsonlite::fromJSON(file.path(data_path, "board-calls-rankings.json"))
  aliases <- read.csv(file.path(data_path, "name-aliases.csv"), check.names = FALSE, stringsAsFactors = FALSE)
  build_analysis(board, source, aliases)
}

export_analysis <- function(result, path = ".") {
  # The original knitr page expects these two column layouts and exact names.
  draft_legacy <- data.frame(
    OverallPick = result$ledger$PickNumber, Round = result$ledger$Round,
    PickInRound = result$ledger$PickInRound, Player = result$ledger$CanonicalPlayer,
    NFLTeam = result$ledger$NFLTeam, Position = result$ledger$Position,
    FantasyTeam = result$ledger$Team, stringsAsFactors = FALSE
  )
  rankings_legacy <- data.frame(
    Rank = result$rankings$Rank, Player = result$rankings$CanonicalPlayer,
    Pos = result$rankings$Position, stringsAsFactors = FALSE
  )
  exports <- list(
    "Draft2026.csv" = draft_legacy,
    "espn_superflex_ppr_2026.csv" = rankings_legacy,
    "draft-ledger.csv" = result$ledger,
    "team-summary.csv" = result$teams,
    "all-position-team-summary.csv" = result$all_teams,
    "join-audit.csv" = result$audit,
    "espn-superflex-ppr-2026.csv" = result$rankings,
    "sensitivity.csv" = result$sensitivity,
    "position-counts.csv" = result$positions,
    "undrafted-top300.csv" = result$undrafted
  )
  data_path <- file.path(path, "data")
  assert_analysis(dir.exists(data_path), "Data output directory does not exist.")
  for (filename in names(exports)) {
    write.csv(exports[[filename]], file.path(data_path, filename), row.names = FALSE, na = "")
  }
  invisible(result)
}
