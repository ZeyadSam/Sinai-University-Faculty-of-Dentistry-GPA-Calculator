# Sinai Dental · GPA Studio

A modern, responsive, zero-dependency GPA calculator for the Faculty of Dentistry at Sinai University.

## Run locally

The app uses native JavaScript ES modules. Run it from a static web server rather than opening `index.html` directly:

```bash
npx serve .
```

Then open the local URL printed by the server.

## Features

- Credit-weighted semester and cumulative GPA calculations using Sinai University's published grade-point key.
- Separate tracking of GPA/attempted hours and earned degree credits.
- Correct handling of F, P, I, NC and W as distinct GPA and earned-credit cases.
- Exact weighted percentages only when actual course marks are entered; no guessed GPA-to-percentage conversion.
- Previous GPA hours, earned credits and optional previous actual weighted mark.
- Target-GPA planning that accounts for the current GPA-hour denominator and remaining earned degree credits.
- Degree-credit progress tracking and remaining-average estimate.
- Searchable course catalogue and grade history.
- CSV export, JSON backup/restore, and print-to-PDF.
- Light/dark theme and responsive layouts.
- Local-only data storage; grades are not uploaded to a server.

## Data and compatibility

The existing localStorage keys (`savedGrades`, `gradeHistory`, `gpaCalculatorData`, and `theme`) are retained. Legacy `CN` entries are normalized to `NC`. Older saves had one previous-credit field; it is migrated as both GPA hours and earned credits until the student corrects it. Historical GPA snapshots are recalculated under the corrected rules. Percentages from earlier releases are not treated as verified marks.

## Quality checks

```bash
npm run check
npm test
```

The GPA calculation engine is a pure ES module and is covered by Node's built-in test runner. GitHub Actions runs the same checks on pushes and pull requests to `main`.
