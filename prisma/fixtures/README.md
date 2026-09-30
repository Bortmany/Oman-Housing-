# Market-stats CSV test fixtures

Made for Align Step 3 (real data machinery). Spec: `docs/specs/oman-property/align-3-real-data.md`. Columns and level rules: `docs/decisions/official-data-sources.md`.

All figures are invented. Every `source_note` says "TEST FIXTURE — not real data" so nobody imports one into production by mistake. Source links point at the real pages named in the decision file (NCSI home page, MOHUP real-estate transaction page); the agency files use a made-up `bayestates.example` address. Places are the seeded ones only: governorates `muscat`, `dhofar`; cities `seeb`, `bawshar`, `muttrah`, `salalah`; neighbourhoods `qurum`, `al-khuwair`, `al-mouj`, `hawana-salalah`, `bausher` and others.

Line numbers below are as seen in Excel (header = line 1, first data row = line 2). "Official mode" means the admin importer with the "This source names the neighbourhood" box NOT ticked unless stated.

| File | What it is | Expected result |
|---|---|---|
| `market-stats-official-good.csv` | 12 valid rows: Muscat and Dhofar governorate averages (sale, rent, price per sqm; apartment, villa, all types) plus Seeb and Salalah monthly `transactionCount`. Two rows say `quarter`, one row has `confidence` 0.85, the rest blank. | Accepted. 12 figures in 8 groups, no problems. |
| `market-stats-official-bad-header.csv` | Header has `vaule` (typo) and `notes`, and no `source_url`. 3 data rows. | File errors: `missingColumn` for `value` and for `source_url`. Warnings: `ignoredColumn` for `notes` and also for `vaule` (the typo is an unused extra column too). Nothing importable. |
| `market-stats-official-arabic-names.csv` | Same 12 rows as the good file with Arabic place names (two rows use the slug instead), plus line 14 (city `بوشر`, Bawshar) and line 15 (neighbourhood `بوشر`, Bausher). Saved with a byte-order mark. | Lines 2-13 accepted with the same numbers as the good file. Line 15 rejected `neighborhoodNotAllowed` (column `area_level`) unless the box is ticked; ticked, lines 14 and 15 resolve to two different places (Bawshar city, Bausher neighbourhood). |
| `market-stats-official-mixed-digits.csv` | Same 12 figures as the good file, written with Arabic-Indic digits (`٣٤٥٫٥٠٠`), Eastern Arabic-Indic digits (`۲۱۰٫۵`), Latin digits, one mixed-script value (`٦٩0.٥` = 690.5), quoted thousands separators (`"118,400.000"`, `"1,250"`), Arabic-digit dates and confidence (`٠٫٨٥`). | Accepted; every number and date identical to the good file. |
| `market-stats-official-neighborhood-row.csv` | 5 valid governorate/city rows plus 2 neighbourhood rows (`qurum` line 7, `al-khuwair` line 8). | Box not ticked: lines 7 and 8 rejected `neighborhoodNotAllowed`, 5 rows fine. Box ticked: all 7 accepted. |
| `market-stats-official-mixed-errors.csv` | One row per row-level error code (each row has exactly one fault), plus a duplicate pair and a conflicting-source pair. | The problems listed in `market-stats-official-mixed-errors.expected.txt`. Nothing importable. |
| `market-stats-official-mixed-errors.expected.txt` | Machine-readable list for the parser test: `line,column,code` per problem; `#` lines are comments; blank column = whole-line error. | (input to the test) |
| `market-stats-official-formula.csv` | 3 valid rows whose `source_note` starts with `=HYPERLINK(...)`, `+1+1`, `@SUM(A1)` (then the TEST FIXTURE text, so the "not real data" marker is still present). | Accepted. The cells stay plain text, never calculated. |
| `market-stats-official-semicolons.csv` | The good file separated by semicolons. | File error `wrongDelimiter`. |
| `market-stats-official-empty.csv` | Header line only. | File error `empty`. |
| `market-stats-agency-good.csv` | 8 valid rows in agency style: Seeb and Muttrah city rows, Qurum, Al Khuwair, Al Mouj and Hawana Salalah neighbourhood rows, source links on the agency's own site, `confidence` column filled in (0.7 to 1). | Agency mode: all 8 accepted (neighbourhood rows allowed); confidence column ignored, saved as user-submitted at 0.5. |
| `market-stats-agency-too-many.csv` | 101 valid rows (11 neighbourhoods x 3 months x 3 metrics for apartments, plus 2 city rows), no duplicates. | Agency mode: refused with `tooManyRows` (limit 100) before any row is read. |

## Notes for the parser tests

- The mixed-errors expected list assumes the parser reports one error per faulty row and that `duplicateRow` marks BOTH repeated lines (lines 15 and 16), as the spec says; `duplicateRow` has no column in its message, so the column is left blank. `conflictingGroup` is on line 18 (the later line), column `source_url`.
- Not covered by a fixture (by design): `areaAmbiguous` (unit test with an invented place list), `neighborhoodNotAllowed` in the errors file (covered by the neighbourhood-row file), `notCsv`, `notUtf8`, `duplicateColumn`, and the 500 KB / 2,001-row limits (built in memory by the test).
- The Arabic-names file starts with a UTF-8 byte-order mark; if your editor strips it on save, re-add it (the test may also prepend `﻿` itself).
- Official-mode quarterly rows use `2026-04-01` (Q2 2026). Rows with a blank `period_type` default to `month`.
