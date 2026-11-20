# Sinai Dental · GPA Studio

A modern, responsive, zero-dependency GPA calculator for the Faculty of Dentistry at Sinai University.

## Run locally

The app uses native JavaScript ES modules. Run it from a static web server rather than opening `index.html` directly:

```bash
npx serve .
```

Then open the local URL printed by the server.

## Features

- Credit-weighted semester and cumulative GPA calculations.
- Previous academic record and target-GPA planning.
- Degree-credit progress tracking and remaining-average estimate.
- Searchable course catalogue and grade history.
- CSV export, JSON backup/restore, and print-to-PDF.
- Light/dark theme and responsive layouts.
- Local-only data storage; grades are not uploaded to a server.

## Data and compatibility

The existing localStorage keys (`savedGrades`, `gradeHistory`, `gpaCalculatorData`, and `theme`) are retained so existing browser data can be restored. Course catalogue values and the current GPA-point scale are preserved. The percentage is an estimate derived from the displayed GPA bands, not an official transcript conversion.

## Quality checks

```bash
npm run check
npm test
```

The GPA calculation engine is a pure ES module and is covered by Node's built-in test runner. GitHub Actions runs the same checks on pushes and pull requests to `main`.
