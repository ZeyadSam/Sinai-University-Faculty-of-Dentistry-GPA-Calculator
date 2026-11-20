# Sinai Dental · GPA Studio

A modern, responsive, zero-dependency GPA calculator for the Faculty of Dentistry at Sinai University.

## Run locally

The app uses native JavaScript ES modules. Run it from a static web server rather than opening `index.html` directly:

```bash
npx serve .
```

Then open the local URL printed by the server.

## Features

- Two selectable point schemes: the uploaded GPA key and Sinai University's 2023 BDS regulations. Select the one printed on your transcript.
- Credit-weighted semester and cumulative GPA calculations with separate GPA hours and earned degree credits.
- Correct handling of F, FW, P, I, NC and W as different GPA/earned-credit cases.
- Repeated-course replacement, best-grade retention, the 2023 three-course improvement limit and second-or-later failed-repeat cap.
- Exact weighted percentages only when actual course marks are entered; no guessed GPA-to-percentage conversion.
- Previous GPA hours, earned credits and optional previous actual weighted mark.
- Target-GPA planning that accounts for the current GPA-hour denominator and remaining earned degree credits.
- Degree-credit progress tracking based on earned hours, plus a remaining-average estimate.
- Five elective options with a limit of two selected options (4 elective credits), matching the supplied study plan.
- Searchable course catalogue and grade history.
- CSV export, JSON backup/restore, and print-to-PDF.
- Light/dark theme and responsive layouts.
- Local-only data storage; grades are not uploaded to a server.

## Data and compatibility

The existing localStorage keys (`savedGrades`, `gradeHistory`, `gpaCalculatorData`, and `theme`) are retained. Legacy `CN` entries are normalized to `NC`. Older saves had one previous-credit field; it is migrated as both GPA hours and earned credits until corrected. Historical GPA snapshots are recalculated under the corrected rules; percentages from older releases are not treated as verified marks. The catalogue has five elective alternatives and permits two selections (4 credits).

**Curriculum caveat:** the supplied 189-credit course catalogue differs from the 192-credit total stated in the University's 2023 BDS regulations. Keep the degree-credit target that applies to your cohort and confirm it with Student Affairs. The 2023 regulations PDF also contains an internally impossible C-grade threshold (`76.5 to below 70`); the calculator uses 67.5 as a contiguous boundary between C+ and C, which should be verified with the Faculty.

**Primary source:** [Sinai University BDS internal regulations (2023)](https://www.su.edu.eg/wp-content/uploads/2024/10/1-%D8%A7%D9%84%D9%84%D8%A7%D8%A6%D8%AD%D8%A9-%D8%A7%D9%84%D8%AF%D8%A7%D8%AE%D9%84%D9%8A%D8%A9-%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9-%D8%A8%D9%83%D8%A7%D9%84%D9%88%D8%B1%D9%8A%D9%88%D8%B3-%D8%B7%D8%A8-%D9%88%D8%AC%D8%B1%D8%A7%D8%AD%D8%A9-%D8%A7%D9%84%D9%81%D9%85-%D9%88%D8%A7%D9%84%D8%A7%D8%B3%D9%86%D8%A7%D9%86-2023.pdf).

## Quality checks

```bash
npm run check
npm test
```

The GPA calculation engine is a pure ES module and is covered by Node's built-in test runner. GitHub Actions runs the same checks on pushes and pull requests to `main`.
