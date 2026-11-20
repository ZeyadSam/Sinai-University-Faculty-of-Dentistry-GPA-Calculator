import { courseCatalog } from "./courses.js";
import { calculateAcademicMetrics, GRADE_OPTIONS, GRADE_POINTS, gradeFromGpa } from "./gpa-engine.js";

const $ = (selector, root = document) => root.querySelector(selector);
const STORAGE_KEYS = Object.freeze({
  savedGrades: "savedGrades",
  history: "gradeHistory",
  state: "gpaCalculatorData",
  theme: "theme"
});

const elements = {
  previousGpa: $("#previous-gpa"),
  previousCredits: $("#previous-credits"),
  degreeCredits: $("#degree-credits"),
  targetGpa: $("#target-gpa"),
  search: $("#course-search"),
  level: $("#course-level"),
  courseList: $("#course-list"),
  selectedCourses: $("#selected-courses"),
  semesterGpa: $("#semester-gpa"),
  semesterCreditCaption: $("#semester-credit-caption"),
  cumulativeGpa: $("#cumulative-gpa"),
  cumulativeGrade: $("#cumulative-grade"),
  percentage: $("#percentage"),
  totalCreditHours: $("#total-credit-hours"),
  selectedCourseCaption: $("#selected-course-caption"),
  courseCount: $("#course-count"),
  catalogResults: $("#catalog-results"),
  selectedCount: $("#selected-count"),
  selectedTotalCredits: $("#selected-total-credits"),
  completedCredits: $("#completed-credits"),
  degreeCreditLabel: $("#degree-credit-label"),
  progressPercent: $("#progress-percent"),
  progressBar: $("#progress-bar"),
  progressTrack: $("#progress-track"),
  remainingCredits: $("#remaining-credits"),
  requiredGpa: $("#required-gpa"),
  targetStatus: $("#target-status"),
  targetLabel: $("#target-label"),
  history: $("#grade-history"),
  historyTrend: $("#history-trend"),
  toast: $("#toast"),
  storageIndicator: $("#storage-indicator"),
  themeToggle: $("#theme-toggle"),
  themeIcon: $("#theme-icon"),
  sidebar: $("#sidebar"),
  navToggle: $("#nav-toggle"),
  detailsDialog: $("#details-dialog"),
  dialogTitle: $("#dialog-title"),
  dialogBody: $("#dialog-body"),
  importInput: $("#import-json")
};

let selectedCourses = [];
let savedGrades = readStorage(STORAGE_KEYS.savedGrades, {});
let gradeHistory = sanitizeHistory(readStorage(STORAGE_KEYS.history, []));
let toastTimer = null;

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read ${key} from local storage.`, error);
    return fallback;
  }
}

function setStorageStatus(success) {
  if (!elements.storageIndicator) return;
  elements.storageIndicator.classList.toggle("error", !success);
  elements.storageIndicator.lastChild.textContent = success ? " Saved on this device" : " Storage unavailable";
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    setStorageStatus(true);
    return true;
  } catch (error) {
    console.error(`Could not save ${key} to local storage.`, error);
    setStorageStatus(false);
    showToast("Your browser could not save this data. Check storage settings.");
    return false;
  }
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function isValidGrade(grade) {
  return Object.hasOwn(GRADE_POINTS, grade);
}

function getCourseLevel(course) {
  const match = String(course.code).match(/\b([1-5])\d{3}\b/);
  return match ? match[1] : "other";
}

function getMetrics() {
  return calculateAcademicMetrics({
    previousGpa: elements.previousGpa.value,
    previousCredits: elements.previousCredits.value,
    degreeCredits: elements.degreeCredits.value,
    targetGpa: elements.targetGpa.value,
    courses: selectedCourses
  });
}

function updateInputValidity(metrics) {
  elements.previousGpa.setAttribute("aria-invalid", String(!metrics.previous.valid && !metrics.previous.gpaValid));
  elements.previousCredits.setAttribute("aria-invalid", String(!metrics.previous.valid && !metrics.previous.creditsValid));
  elements.degreeCredits.setAttribute("aria-invalid", String(!metrics.degreeValid));
  elements.targetGpa.setAttribute("aria-invalid", String(!metrics.targetValid));
}

function updateDashboard() {
  const result = getMetrics();
  updateInputValidity(result);

  const hasCurrentGrades = result.semesterCredits > 0;
  const hasCumulativeRecord = result.cumulativeCredits > 0;
  elements.semesterGpa.textContent = hasCurrentGrades ? result.semesterGpa.toFixed(2) : "—";
  elements.semesterCreditCaption.textContent = `${result.semesterCredits} graded credit hours`;
  elements.cumulativeGpa.textContent = hasCumulativeRecord ? result.cumulativeGpa.toFixed(2) : "—";
  elements.cumulativeGrade.textContent = hasCumulativeRecord ? gradeFromGpa(result.cumulativeGpa) : "N/A";
  elements.percentage.textContent = result.percentage === null ? "—" : result.percentage.toFixed(2);
  elements.totalCreditHours.textContent = String(result.semesterCredits);
  elements.completedCredits.textContent = String(result.cumulativeCredits);
  elements.degreeCreditLabel.textContent = String(result.degreeCredits);
  elements.progressPercent.textContent = `${result.progress.toFixed(1)}%`;
  elements.progressBar.style.width = `${result.progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(Math.round(result.progress)));
  elements.remainingCredits.textContent = String(result.remainingCredits);
  elements.targetLabel.textContent = `${result.targetGpa.toFixed(2)} / 4.00`;
  elements.requiredGpa.textContent = result.requiredGpa === null ? "—" : result.requiredGpa.toFixed(2);
  elements.targetStatus.textContent = result.targetMessage;
  elements.targetStatus.className = `target-status${result.targetTone ? ` ${result.targetTone}` : ""}`;
  elements.selectedCourseCaption.textContent = `${selectedCourses.length} courses selected`;
  return result;
}

function renderCourses() {
  const searchTerm = elements.search.value.trim().toLocaleLowerCase();
  const selectedLevel = elements.level.value;
  const selectedCodes = new Set(selectedCourses.map(item => item.course.code));
  const available = courseCatalog.filter(course => {
    const searchable = `${course.title} ${course.code}`.toLocaleLowerCase();
    const matchesText = searchable.includes(searchTerm);
    const matchesLevel = selectedLevel === "all" || getCourseLevel(course) === selectedLevel;
    const notSelected = !selectedCodes.has(course.code);
    return matchesText && matchesLevel && notSelected;
  });

  elements.courseList.replaceChildren();
  elements.courseCount.textContent = `${courseCatalog.length} courses`;
  elements.catalogResults.textContent = `Showing ${available.length} available`;

  if (!available.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = searchTerm ? "No courses match your search." : "All courses in this filter have been selected.";
    elements.courseList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const course of available) {
    const row = document.createElement("div");
    row.className = "course-item";
    const info = document.createElement("div");
    info.className = "course-item-info";
    const title = document.createElement("span");
    title.className = "course-item-title";
    title.textContent = course.title;
    const meta = document.createElement("span");
    meta.className = "course-item-meta";
    meta.textContent = `${course.code} · ${course.credits} credit hours`;
    info.append(title, meta);

    const add = document.createElement("button");
    add.className = "add-button";
    add.type = "button";
    add.textContent = "+";
    add.dataset.addCode = course.code;
    add.setAttribute("aria-label", `Add ${course.title}`);
    row.append(info, add);
    fragment.append(row);
  }
  elements.courseList.append(fragment);
}

function renderSelectedCourses() {
  elements.selectedCourses.replaceChildren();
  elements.selectedCount.textContent = `${selectedCourses.length} selected`;
  elements.selectedCourseCaption.textContent = `${selectedCourses.length} courses selected`;
  elements.selectedTotalCredits.textContent = String(selectedCourses.reduce((sum, item) => sum + item.course.credits, 0));

  if (!selectedCourses.length) {
    const empty = document.createElement("div");
    empty.className = "selected-empty";
    const symbol = document.createElement("span");
    symbol.className = "empty-symbol";
    symbol.textContent = "+";
    const message = document.createElement("strong");
    message.textContent = "Your semester is empty";
    const hint = document.createElement("div");
    hint.textContent = "Add courses from the catalogue to start calculating.";
    empty.append(symbol, message, hint);
    elements.selectedCourses.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of selectedCourses) {
    const row = document.createElement("div");
    row.className = "selected-item";
    const info = document.createElement("div");
    info.className = "selected-info";
    const title = document.createElement("span");
    title.className = "selected-title";
    title.textContent = item.course.title;
    const meta = document.createElement("span");
    meta.className = "selected-meta";
    meta.textContent = `${item.course.code} · ${item.course.credits} credits`;
    info.append(title, meta);

    const select = document.createElement("select");
    select.className = "grade-select";
    select.dataset.gradeCode = item.course.code;
    select.setAttribute("aria-label", `Grade for ${item.course.title}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select grade";
    select.append(placeholder);
    for (const grade of GRADE_OPTIONS) {
      const option = document.createElement("option");
      option.value = grade;
      option.textContent = `${grade} · ${GRADE_POINTS[grade].toFixed(1)}`;
      select.append(option);
    }
    select.value = item.grade || "";

    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.dataset.removeCode = item.course.code;
    remove.setAttribute("aria-label", `Remove ${item.course.title}`);
    row.append(info, select, remove);
    fragment.append(row);
  }  elements.selectedCourses.append(fragment);
}

function saveDraft() {
  const draft = {
    version: 3,
    previousGpa: elements.previousGpa.value,
    previousCredits: elements.previousCredits.value,
    degreeCredits: elements.degreeCredits.value,
    targetGpa: elements.targetGpa.value,
    selectedCourses: selectedCourses.map(item => ({ code: item.course.code, grade: item.grade || "" }))
  };
  return writeStorage(STORAGE_KEYS.state, draft);
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && typeof entry === "object" && Array.isArray(entry.courses)).slice(0, 20);
}

function persistHistory() {
  return writeStorage(STORAGE_KEYS.history, gradeHistory);
}

function saveGrades() {
  const result = updateDashboard();
  if (!result.previous.valid || !result.degreeValid || !result.targetValid) {
    showToast("Please correct the highlighted academic settings before saving.");
    return;
  }
  const graded = selectedCourses.filter(item => isValidGrade(item.grade));
  if (!graded.length) {
    showToast("Choose at least one course grade before saving a semester snapshot.");
    return;
  }

  savedGrades = Object.fromEntries(graded.map(item => [item.course.code, item.grade]));
  const gradesSaved = writeStorage(STORAGE_KEYS.savedGrades, savedGrades);
  const draftSaved = saveDraft();
  const snapshot = {
    timestamp: new Date().toISOString(),
    semesterGpa: result.semesterGpa.toFixed(2),
    cumulativeGpa: result.cumulativeGpa.toFixed(2),
    percentage: result.percentage?.toFixed(2) ?? "—",
    credits: result.semesterCredits,
    previousGpa: result.previous.gpa,
    previousCredits: result.previous.credits,
    courses: graded.map(item => ({ course: { ...item.course }, grade: item.grade }))
  };
  gradeHistory = [snapshot, ...gradeHistory].slice(0, 20);
  const historySaved = persistHistory();
  renderHistory();
  showToast(gradesSaved && draftSaved && historySaved ? "Grades and semester snapshot saved." : "Some data could not be saved. Check browser storage.");
}

function restoreDraft() {
  const draft = readStorage(STORAGE_KEYS.state, null);
  if (!draft || typeof draft !== "object") return false;

  elements.previousGpa.value = String(draft.previousGpa ?? "");
  elements.previousCredits.value = String(draft.previousCredits ?? "");
  elements.degreeCredits.value = String(draft.degreeCredits ?? "189");
  elements.targetGpa.value = String(draft.targetGpa ?? "3.60");

  if (Array.isArray(draft.selectedCourses)) {
    const seen = new Set();
    selectedCourses = draft.selectedCourses.map(saved => {
      const course = courseCatalog.find(item => item.code === saved?.code);
      if (!course || seen.has(course.code)) return null;
      seen.add(course.code);
      return { course, grade: isValidGrade(saved.grade) ? saved.grade : "" };
    }).filter(Boolean);
  }
  return true;
}

function loadSavedGrades() {
  const stored = readStorage(STORAGE_KEYS.savedGrades, {});
  savedGrades = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const entries = Object.entries(savedGrades).filter(([code, grade]) =>
    courseCatalog.some(course => course.code === code) && isValidGrade(grade)
  );
  if (!entries.length) {
    showToast("No saved course grades were found on this device.");
    return;
  }

  selectedCourses = entries.map(([code, grade]) => {
    const course = courseCatalog.find(item => item.code === code);
    return course ? { course, grade } : null;
  }).filter(Boolean);
  renderCourses();
  renderSelectedCourses();
  updateDashboard();
  saveDraft();
  showToast("Saved course grades loaded.");
}

function resetCalculator() {
  if (!window.confirm("Reset the selected courses and previous academic record? Saved history will remain unchanged.")) return;
  selectedCourses = [];
  elements.previousGpa.value = "";
  elements.previousCredits.value = "";
  elements.search.value = "";
  elements.level.value = "all";
  renderCourses();
  renderSelectedCourses();
  updateDashboard();
  saveDraft();
  showToast("Calculator reset. Your saved history remains available.");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportCsv() {
  const result = updateDashboard();
  if (!selectedCourses.length) {
    showToast("Add courses before exporting a report.");
    return;
  }
  const rows = [
    ["Sinai University Faculty of Dentistry - GPA Report"],
    ["Generated", new Date().toLocaleString()],
    ["Previous GPA", result.previous.gpa],
    ["Previous credits", result.previous.credits],
    ["Semester GPA", result.semesterCredits ? result.semesterGpa.toFixed(2) : "—"],
    ["Cumulative GPA", result.cumulativeCredits ? result.cumulativeGpa.toFixed(2) : "—"],
    ["Estimated percentage", result.percentage === null ? "—" : `${result.percentage.toFixed(2)}%`],
    ["Graded credit hours", result.semesterCredits],
    [],
    ["Course code", "Course title", "Credits", "Grade", "Grade points"]
  ];
  for (const item of selectedCourses) {
    rows.push([
      item.course.code,
      item.course.title,
      item.course.credits,
      item.grade || "Not graded",
      isValidGrade(item.grade) ? GRADE_POINTS[item.grade].toFixed(2) : ""
    ]);
  }
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile("Sinai_Dental_GPA_Report.csv", csv, "text/csv;charset=utf-8");
  showToast("CSV report exported.");
}

function exportBackup() {
  const payload = {
    app: "Sinai Dental GPA Studio",
    version: 3,
    exportedAt: new Date().toISOString(),
    draft: {
      version: 3,
      previousGpa: elements.previousGpa.value,
      previousCredits: elements.previousCredits.value,
      degreeCredits: elements.degreeCredits.value,
      targetGpa: elements.targetGpa.value,
      selectedCourses: selectedCourses.map(item => ({ code: item.course.code, grade: item.grade || "" }))
    },
    savedGrades,
    history: gradeHistory,
    theme: document.documentElement.dataset.theme
  };
  downloadFile("Sinai_Dental_GPA_Backup.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast("Backup file exported.");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const raw = await file.text();
    const data = JSON.parse(raw);
    if (!data || data.app !== "Sinai Dental GPA Studio" || !data.draft || typeof data.draft !== "object") {
      throw new Error("Unsupported backup format");
    }
    if (!window.confirm("Importing this backup will replace the current calculator data on this device. Continue?")) return;

    const draft = data.draft;
    const normalizedDraft = {
      version: 3,
      previousGpa: String(draft.previousGpa ?? ""),
      previousCredits: String(draft.previousCredits ?? ""),
      degreeCredits: String(draft.degreeCredits ?? "189"),
      targetGpa: String(draft.targetGpa ?? "3.60"),
      selectedCourses: Array.isArray(draft.selectedCourses)
        ? draft.selectedCourses.filter(item => item && courseCatalog.some(course => course.code === item.code))
          .map(item => ({ code: item.code, grade: isValidGrade(item.grade) ? item.grade : "" }))
        : []
    };
    const importedGrades = data.savedGrades && typeof data.savedGrades === "object" && !Array.isArray(data.savedGrades)
      ? Object.fromEntries(Object.entries(data.savedGrades).filter(([code, grade]) => courseCatalog.some(course => course.code === code) && isValidGrade(grade)))
      : {};
    const importedHistory = sanitizeHistory(data.history);

    const allSaved = [
      writeStorage(STORAGE_KEYS.state, normalizedDraft),
      writeStorage(STORAGE_KEYS.savedGrades, importedGrades),
      writeStorage(STORAGE_KEYS.history, importedHistory)
    ].every(Boolean);
    if (!allSaved) throw new Error("Local storage write failed");

    savedGrades = importedGrades;
    gradeHistory = importedHistory;
    restoreDraft();
    if (data.theme === "dark" || data.theme === "light") setTheme(data.theme);
    renderCourses();
    renderSelectedCourses();
    renderHistory();
    updateDashboard();
    showToast("Backup imported successfully.");
  } catch (error) {
    console.error("Backup import failed.", error);
    showToast("This backup file is invalid or could not be imported.");
  } finally {
    elements.importInput.value = "";
  }
}

function renderHistory() {
  elements.history.replaceChildren();
  renderHistoryTrend();
  if (!gradeHistory.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No saved semesters yet. Save a set of graded courses to create your first snapshot.";
    elements.history.append(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "history-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["#", "Saved date", "Semester GPA", "Cumulative GPA", "Credits", "Percentage", ""]) {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  }
  thead.append(headerRow);
  const tbody = document.createElement("tbody");

  gradeHistory.forEach((entry, index) => {
    const row = document.createElement("tr");
    const date = entry.timestamp ? new Date(entry.timestamp) : null;
    const dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : String(entry.timestamp || "Earlier record");
    const values = [
      String(gradeHistory.length - index),
      dateText,
      entry.semesterGpa ?? "—",
      entry.cumulativeGpa ?? "—",
      String(entry.credits ?? 0),
      `${entry.percentage ?? "—"}%`
    ];
    values.forEach((value, valueIndex) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (valueIndex === 2 || valueIndex === 3) cell.className = "table-gpa";
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const detail = document.createElement("button");
    detail.type = "button";
    detail.className = "table-detail";
    detail.textContent = "View details";
    detail.dataset.historyIndex = String(index);
    actionCell.append(detail);
    row.append(actionCell);
    tbody.append(row);
  });
  table.append(thead, tbody);
  elements.history.append(table);
}

function renderHistoryTrend() {
  elements.historyTrend.replaceChildren();
  if (!gradeHistory.length) {
    const empty = document.createElement("div");
    empty.className = "trend-empty";
    empty.textContent = "Your saved cumulative GPA trend will appear here.";
    elements.historyTrend.append(empty);
    return;
  }
  const chronological = [...gradeHistory].slice(0, 6).reverse();
  chronological.forEach((entry, index) => {
    const value = Number(entry.cumulativeGpa);
    if (!Number.isFinite(value)) return;
    const item = document.createElement("div");
    item.className = "trend-item";
    const label = document.createElement("span");
    label.className = "trend-value";
    label.textContent = value.toFixed(2);
    const track = document.createElement("div");
    track.className = "trend-track";
    const bar = document.createElement("div");
    bar.className = "trend-bar";
    bar.style.height = `${Math.max(3, Math.min(100, value / 4 * 100))}%`;
    track.append(bar);
    const caption = document.createElement("span");
    caption.className = "trend-label";
    caption.textContent = `#${index + 1}`;
    item.append(label, track, caption);
    elements.historyTrend.append(item);
  });
}

function openHistoryDetails(index) {
  const entry = gradeHistory[index];
  if (!entry) return;

  elements.dialogTitle.textContent = "Semester details";
  elements.dialogBody.replaceChildren();
  const summary = document.createElement("div");
  summary.className = "dialog-summary";
  const stats = [
    ["Semester GPA", entry.semesterGpa ?? "—"],
    ["Cumulative GPA", entry.cumulativeGpa ?? "—"],
    ["Percentage", `${entry.percentage ?? "—"}%`]
  ];
  for (const [label, value] of stats) {
    const stat = document.createElement("div");
    stat.className = "dialog-stat";
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    stat.append(small, strong);
    summary.append(stat);
  }
  elements.dialogBody.append(summary);

  const courses = Array.isArray(entry.courses) ? entry.courses : [];
  if (!courses.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No course details were stored for this snapshot.";
    elements.dialogBody.append(empty);
  } else {
    for (const item of courses) {
      const row = document.createElement("div");
      row.className = "dialog-course";
      const courseName = document.createElement("strong");
      courseName.textContent = `${item.course?.title || "Course"} (${item.course?.code || "—"})`;
      const grade = document.createElement("span");
      const points = isValidGrade(item.grade) ? GRADE_POINTS[item.grade].toFixed(1) : "—";
      grade.textContent = `${item.grade || "—"} · ${points} points`;
      row.append(courseName, grade);
      elements.dialogBody.append(row);
    }
  }

  if (typeof elements.detailsDialog.showModal === "function") elements.detailsDialog.showModal();
  else showToast("Your browser does not support the details dialog.");
}

function clearHistory() {
  if (!gradeHistory.length) {
    showToast("There is no saved history to clear.");
    return;
  }
  if (!window.confirm("Delete all saved grade-history snapshots? This cannot be undone.")) return;
  const previousHistory = gradeHistory;
  gradeHistory = [];
  if (persistHistory()) {
    renderHistory();
    showToast("Grade history cleared.");
  } else {
    gradeHistory = previousHistory;
  }
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  const isDark = nextTheme === "dark";
  elements.themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeIcon.innerHTML = isDark
    ? '<path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42"/><circle cx="12" cy="12" r="4"/>'
    : '<path d="M20.3 15.1A8.5 8.5 0 0 1 8.9 3.7 8.5 8.5 0 1 0 20.3 15.1Z"/>';
  // Keep this preference as a plain string for backward compatibility with v1.
  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  } catch (error) {
    console.warn("Could not save the theme preference.", error);
  }
}

function readTheme() {
  // Older releases stored the theme without JSON encoding.
  try {
    return window.localStorage.getItem(STORAGE_KEYS.theme) === "dark" ? "dark" : "light";
  } catch (error) {
    console.warn("Could not read the theme preference.", error);
    return "light";
  }
}

function addCourse(code) {
  if (selectedCourses.some(item => item.course.code === code)) return;
  const course = courseCatalog.find(item => item.code === code);
  if (!course) return;
  selectedCourses.push({ course, grade: "" });
  renderCourses();
  renderSelectedCourses();
  updateDashboard();
  saveDraft();
}

function removeCourse(code) {
  selectedCourses = selectedCourses.filter(item => item.course.code !== code);
  renderCourses();
  renderSelectedCourses();
  updateDashboard();
  saveDraft();
}

function updateGrade(code, grade) {
  const selected = selectedCourses.find(item => item.course.code === code);
  if (!selected) return;
  selected.grade = isValidGrade(grade) ? grade : "";
  updateDashboard();
  saveDraft();
}

function setUpNavigation() {
  elements.navToggle.addEventListener("click", () => {
    const isOpen = elements.sidebar.classList.toggle("open");
    elements.navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      elements.sidebar.classList.remove("open");
      elements.navToggle.setAttribute("aria-expanded", "false");
      document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
      link.classList.add("active");
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
      });
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, .15, .4] });
    document.querySelectorAll("main > section[id]").forEach(section => observer.observe(section));
  }
}

function bindEvents() {
  elements.search.addEventListener("input", renderCourses);
  elements.level.addEventListener("change", renderCourses);
  elements.courseList.addEventListener("click", event => {
    const button = event.target.closest("[data-add-code]");
    if (button) addCourse(button.dataset.addCode);
  });
  elements.selectedCourses.addEventListener("change", event => {
    const select = event.target.closest("[data-grade-code]");
    if (select) updateGrade(select.dataset.gradeCode, select.value);
  });
  elements.selectedCourses.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-code]");
    if (button) removeCourse(button.dataset.removeCode);
  });

  [elements.previousGpa, elements.previousCredits, elements.degreeCredits, elements.targetGpa].forEach(input => {
    input.addEventListener("input", () => {
      updateDashboard();
      saveDraft();
    });
    input.addEventListener("change", () => {
      updateDashboard();
      saveDraft();
    });
  });

  $("#save-grades").addEventListener("click", saveGrades);
  $("#load-grades").addEventListener("click", loadSavedGrades);
  $("#export-csv").addEventListener("click", exportCsv);
  $("#backup-json").addEventListener("click", exportBackup);
  $("#import-json-button").addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", event => importBackup(event.target.files?.[0]));
  $("#print-report").addEventListener("click", () => window.print());
  $("#reset").addEventListener("click", resetCalculator);
  $("#clear-history").addEventListener("click", clearHistory);
  $("#dialog-close").addEventListener("click", () => elements.detailsDialog.close());
  $("#dialog-done").addEventListener("click", () => elements.detailsDialog.close());
  elements.history.addEventListener("click", event => {
    const button = event.target.closest("[data-history-index]");
    if (button) openHistoryDetails(Number(button.dataset.historyIndex));
  });
  elements.themeToggle.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
}

function initialize() {
  if (Object.values(elements).some(element => !element)) {
    console.error("GPA Studio could not initialize because a required UI element is missing.");
    return;
  }
  const theme = readTheme();
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  elements.themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeIcon.innerHTML = isDark
    ? '<path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42"/><circle cx="12" cy="12" r="4"/>'
    : '<path d="M20.3 15.1A8.5 8.5 0 0 1 8.9 3.7 8.5 8.5 0 1 0 20.3 15.1Z"/>';
  restoreDraft();
  bindEvents();
  setUpNavigation();
  renderCourses();
  renderSelectedCourses();
  renderHistory();
  updateDashboard();
}

initialize();
