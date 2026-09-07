#!/usr/bin/env Rscript
# Run from any directory: Rscript /path/to/2026/Draft/render.R
args <- commandArgs(trailingOnly = FALSE)
script <- sub("^--file=", "", args[grepl("^--file=", args)])
if (length(script)) setwd(dirname(normalizePath(script)))
required <- c("jsonlite", "knitr", "rmarkdown", "ggplot2", "DT", "dplyr")
missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) stop("Missing R dependencies: ", paste(missing, collapse = ", "))
if (!rmarkdown::pandoc_available()) stop("Pandoc is required to render the report")
source("tests/test-analysis.R")
source("R/analysis.R")
result <- analyze_draft(".")
export_analysis(result, ".")
rmarkdown::render("index.Rmd", output_file = "index.html", envir = new.env(), quiet = FALSE)
cat("Rendered 2026/Draft/index.html with all analysis checks passing.\n")
