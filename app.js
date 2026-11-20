import { courseCatalog } from "./courses.js";

const $ = (selector, root = document) => root.querySelector(selector);
const gradePoints = Object.freeze({
  "A+": 4.0, A: 3.8, "A-": 3.6, "B+": 3.3, B: 3.0,
  "C+": 2.7, C: 2.4, D: 2.0, F: 0.0, W: 0.0, I: 0.0, CN: 0.0
});
const gradeOptions = ["A+", "A", "A-", "B+", "B", "C+", "C", "D", "F", "W", "I", "CN"];
const STORAGE_KEYS = Object.freeze({
  savedGrades: "savedGrades",
  history: "gradeHistory",
  state: "gpaCalculatorData"
});

let selectedCourses = [];
let savedGrades = readStorage(STORAGE_KEYS.savedGrades, {});
let gradeHistory = readStorage(STORAGE_KEYS.history, []);
let toastTimer = null;

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
  remainingCredits: $("#remaining-credits"),
  requiredGpa: $("#required-gpa"),
  targetStatus: $("#target-status"),
  targetLabel: $("#target-label"),
  history: $("#grade-history"),
  toast: $("#toast"),
  themeToggle: $("#theme-toggle"),
  themeIcon: $("#theme-icon"),
  sidebar: $("#sidebar"),
  navToggle: $("#nav-toggle"),
  detailsDialog: $("#details-dialog"),
  dialogTitle: $("#dialog-title"),
  dialogBody: $("#dialog-body")
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn("Could not read saved calculator data:", error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Could not save calculator data:", error);
    showToast("Your browser could not save this data. Check storage settings.");
    return false;
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPreviousRecord() {
  const rawGpa = elements.previousGpa.value.trim();
  const rawCredits = elements.previousCredits.value.trim();
  const gpa = rawGpa === "" ? 0 : asNumber(rawGpa, NaN);
  const credits = rawCredits === "" ? 0 : asNumber(rawCredits, NaN);
  const gpaValid = Number.isFinite(gpa) && gpa >= 0 && gpa <= 4;
  const creditsValid = Number.isFinite(credits) && credits >= 0 && Number.isInteger(credits);
  elements.previousGpa.setAttribute("aria-invalid", String(!gpaValid));
  elements.previousCredits.setAttribute("aria-invalid", String(!creditsValid));
  return {
    gpa: gpaValid ? gpa : 0,
    credits: creditsValid ? credits : 0,
    valid: gpaValid && creditsValid,
    needsGpa: creditsValid && credits > 0 && rawGpa === ""
  };
}

function getDegreeSettings() {
  const degreeCredits = clamp(Math.round(asNumber(elements.degreeCredits.value, 189)), 1, 300);
  const targetGpa = clamp(asNumber(elements.targetGpa.value, 3.6), 0, 4);
  return { degreeCredits, targetGpa };
}

function getCourseLevel(course) {
  const match = course.code.match(/\b([1-5])\d{3}\b/);
  return match ? match[1] : "other";
}

function gpaToPercentage(gpa) {
  if (!Number.isFinite(gpa) || gpa <= 0) return 0;
  if (gpa >= 4) return 95;
  if (gpa < 2) return (gpa / 2) * 60;
  if (gpa >= 3.8) return 90 + ((gpa - 3.8) / 0.2) * 5;
  if (gpa >= 3.6) return 85 + ((gpa - 3.6) / 0.2) * 5;
  if (gpa >= 3.3) return 80 + ((gpa - 3.3) / 0.3) * 5;
  if (gpa >= 3.0) return 75 + ((gpa - 3.0) / 0.3) * 5;
  if (gpa >= 2.7) return 70 + ((gpa - 2.7) / 0.3) * 5;
  if (gpa >= 2.4) return 65 + ((gpa - 2.4) / 0.3) * 5;
  return 60 + ((gpa - 2.0) / 0.4) * 5;
}

function gradeFromGpa(gpa) {
  if (gpa >= 4) return "A+";
  if (gpa >= 3.8) return "A";
  if (gpa >= 3.6) return "A−";
  if (gpa >= 3.3) return "B+";
  if (gpa >= 3.0) return "B";
  if (gpa >= 2.7) return "C+";
  if (gpa >= 2.4) return "C";
  if (gpa >= 2.0) return "D";
  return "F";
}

function calculate() {
  const previous = getPreviousRecord();
  const settings = getDegreeSettings();
  const gradedCourses = selectedCourses.filter(item => Object.hasOwn(gradePoints, item.grade));
  const semesterCredits = gradedCourses.reduce((sum, item) => sum + item.course.credits, 0);
  const selectedCredits = selectedCourses.reduce((sum, item) => sum + item.course.credits, 0);
  const semesterPoints = gradedCourses.reduce((sum, item) => sum + gradePoints[item.grade] * item.course.credits, 0);
  const semesterGpa = semesterCredits ? semesterPoints / semesterCredits : 0;
  const cumulativeCredits = previous.credits + semesterCredits;
  const cumulativePoints = previous.gpa * previous.credits + semesterPoints;
  const cumulativeGpa = cumulativeCredits ? cumulativePoints / cumulativeCredits : 0;
  const percentage = cumulativeCredits ? gpaToPercentage(cumulativeGpa) : 0;
  const completedCredits = cumulativeCredits;
  const remainingCredits = Math.max(0, settings.degreeCredits - completedCredits);
  const progress = clamp((completedCredits / settings.degreeCredits) * 100, 0, 100);
  let requiredGpa = null;
  let targetMessage = "Add your previous academic record to calculate your target.";
  let targetTone = "";

  if (!previous.valid) {
    targetMessage = "Check your previous GPA and credit-hour values.";
    targetTone = "bad";
  } else if (previous.needsGpa) {
    targetMessage = "Enter your previous GPA to calculate a reliable target.";
    targetTone = "warning";
  } else if (cumulativeCredits >= settings.degreeCredits) {
    if (cumulativeGpa >= settings.targetGpa) {
      targetMessage = "Your target GPA has been achieved.";
      targetTone = "good";
      requiredGpa = 0;
    } else {
      targetMessage = "All degree credits are accounted for, but the target has not been reached.";
      targetTone = "bad";
    }
  } else if (cumulativeGpa >= settings.targetGpa) {
    targetMessage = "Your current cumulative GPA already meets the target.";
    targetTone = "good";
    requiredGpa = 0;
  } else {
    const needed = (settings.targetGpa * settings.degreeCredits - cumulativePoints) / remainingCredits;
    if (needed > 4) {
      targetMessage = "This target is no longer attainable with a maximum remaining GPA of 4.00.";
      targetTone = "bad";
    } else {
      requiredGpa = clamp(needed, 0, 4);
      targetMessage = "Average this GPA across the remaining degree credits to reach your target.";
      targetTone = "warning";
    }
  }

  return {
    previous, settings, gradedCourses, semesterCredits, selectedCredits,
    semesterPoints, semesterGpa, cumulativeCredits, cumulativePoints,
    cumulativeGpa, percentage, completedCredits, remainingCredits,
    progress, requiredGpa, targetMessage, targetTone
  };
}

function renderCourses() {
  const searchTerm = elements.search.value.trim().toLocaleLowerCase();
  const selectedLevel = elements.level.value;
  const available = courseCatalog.filter(course => {
    const searchable = (course.title + " " + course.code).toLocaleLowerCase();
    const matchesText = searchable.includes(searchTerm);
    const matchesLevel = selectedLevel === "all" || getCourseLevel(course) === selectedLevel;
    const notSelected = !selectedCourses.some(item => item.course.code === course.code);
    return matchesText && matchesLevel && notSelected;
  });

  elements.courseList.replaceChildren();
  elements.courseCount.textContent = courseCatalog.length + " courses";
  elements.catalogResults.textContent = "Showing " + available.length + " available";

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
    meta.textContent = course.code + " · " + course.credits + " credit hours";
    info.append(title, meta);
    const add = document.createElement("button");
    add.className = "add-button";
    add.type = "button";
    add.textContent = "+";
    add.dataset.addCode = course.code;
    add.setAttribute("aria-label", "Add " + course.title);
    row.append(info, add);
    fragment.append(row);
  }
  elements.courseList.append(fragment);
}

function renderSelectedCourses() {
  elements.selectedCourses.replaceChildren();
  elements.selectedCount.textContent = selectedCourses.length + " selected";
  elements.selectedCourseCaption.textContent = selectedCourses.length + " courses selected";
  elements.selectedTotalCredits.textContent = String(
    selectedCourses.reduce((sum, item) => sum + item.course.credits, 0)
  );

  if (!selectedCourses.length) {
    const empty = document.createElement("div");
    empty.className = "selected-empty";
    const symbol = document.createElement("span");
    symbol.className = "empty-symbol";
    symbol.textContent = "＋";
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
    meta.textContent = item.course.code + " · " + item.course.credits + " credits";
    info.append(title, meta);

    const select = document.createElement("select");
    select.className = "grade-select";
    select.dataset.gradeCode = item.course.code;
    select.setAttribute("aria-label", "Grade for " + item.course.title);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select grade";
    select.append(placeholder);
    for (const grade of gradeOptions) {
      const option = document.createElement("option");
      option.value = grade;
      option.textContent = grade + "  ·  " + gradePoints[grade].toFixed(1);
      select.append(option);
    }
    select.value = item.grade || "";

    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.dataset.removeCode = item.course.code;
    remove.setAttribute("aria-label", "Remove " + item.course.title);
    row.append(info, select, remove);
    fragment.append(row);
  }
  elements.selectedCourses.append(fragment);
}

function updateDashboard() {
  const result = calculate();
  const cumulative = result.cumulativeCredits > 0;
  elements.semesterGpa.textContent = result.semesterCredits ? result.semesterGpa.toFixed(2) : "—";
  elements.semesterCreditCaption.textContent = result.semesterCredits + " graded credit hours";
  elements.cumulativeGpa.textContent = cumulative ? result.cumulativeGpa.toFixed(2) : "—";
  elements.cumulativeGrade.textContent = cumulative ? gradeFromGpa(result.cumulativeGpa) : "N/A";
  elements.percentage.textContent = cumulative ? result.percentage.toFixed(2) : "0.00";
  elements.totalCreditHours.textContent = String(result.semesterCredits);
  elements.completedCredits.textContent = String(result.completedCredits);
  elements.degreeCreditLabel.textContent = String(result.settings.degreeCredits);
  elements.progressPercent.textContent = result.progress.toFixed(1) + "%";
  elements.progressBar.style.width = result.progress + "%";
  elements.remainingCredits.textContent = String(result.remainingCredits);
  elements.targetLabel.textContent = result.settings.targetGpa.toFixed(2) + " / 4.00";
  elements.requiredGpa.textContent = result.requiredGpa === null ? "—" : result.requiredGpa.toFixed(2);
  elements.targetStatus.textContent = result.targetMessage;
  elements.targetStatus.className = "target-status" + (result.targetTone ? " " + result.targetTone : "");
  return result;
}

function saveDraft() {
  const draft = {
    version: 2,
    previousGpa: elements.previousGpa.value,
    previousCredits: elements.previousCredits.value,
    degreeCredits: elements.degreeCredits.value,
    targetGpa: elements.targetGpa.value,
    selectedCourses: selectedCourses.map(item => ({ code: item.course.code, grade: item.grade || "" }))
  };
  writeStorage(STORAGE_KEYS.state, draft);
}

function saveGrades() {
  const result = calculate();
  if (!result.previous.valid) {
    showToast("Please correct the previous GPA and credit-hour values first.");
    return;
  }

  savedGrades = {};
  for (const item of selectedCourses) {
    if (Object.hasOwn(gradePoints, item.grade)) savedGrades[item.course.code] = item.grade;
  }

  const gradesSaved = writeStorage(STORAGE_KEYS.savedGrades, savedGrades);
  saveDraft();

  if (result.gradedCourses.length) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      semesterGpa: result.semesterGpa.toFixed(2),
      cumulativeGpa: result.cumulativeGpa.toFixed(2),
      percentage: result.percentage.toFixed(2),
      credits: result.semesterCredits,
      courses: result.gradedCourses.map(item => ({
        course: { ...item.course },
        grade: item.grade
      }))
    };
    gradeHistory = [snapshot, ...gradeHistory].slice(0, 20);
    writeStorage(STORAGE_KEYS.history, gradeHistory);
    renderHistory();
  }
  showToast(gradesSaved ? (result.gradedCourses.length ? "Grades and semester snapshot saved." : "Your calculator settings were saved.") : "Could not save your results.");
}

function restoreDraft() {
  const draft = readStorage(STORAGE_KEYS.state, null);
  if (!draft || typeof draft !== "object") return false;

  elements.previousGpa.value = draft.previousGpa ?? "";
  elements.previousCredits.value = draft.previousCredits ?? "";
  elements.degreeCredits.value = draft.degreeCredits ?? "189";
  elements.targetGpa.value = draft.targetGpa ?? "3.60";

  if (Array.isArray(draft.selectedCourses)) {
    selectedCourses = draft.selectedCourses
      .map(saved => {
        const course = courseCatalog.find(item => item.code === saved.code);
        const grade = Object.hasOwn(gradePoints, saved.grade) ? saved.grade : "";
        return course ? { course, grade } : null;
      })
      .filter(Boolean);
  }
  return true;
}

function loadSavedGrades() {
  savedGrades = readStorage(STORAGE_KEYS.savedGrades, {});
  const draft = readStorage(STORAGE_KEYS.state, null);
  if (draft && typeof draft === "object") {
    elements.previousGpa.value = draft.previousGpa ?? "";
    elements.previousCredits.value = draft.previousCredits ?? "";
    elements.degreeCredits.value = draft.degreeCredits ?? "189";
    elements.targetGpa.value = draft.targetGpa ?? "3.60";
  }

  const savedEntries = Object.entries(savedGrades || {});
  if (!savedEntries.length) {
    showToast("No saved course grades were found on this device.");
    return;
  }

  selectedCourses = savedEntries.map(([code, grade]) => {
    const course = courseCatalog.find(item => item.code === code);
    return course ? { course, grade: Object.hasOwn(gradePoints, grade) ? grade : "" } : null;
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
  const text = String(value ?? "");
  return '"' + text.replaceAll('"', '""') + '"';
}

function exportCsv() {
  const result = calculate();
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
    ["Estimated percentage", result.percentage.toFixed(2) + "%"],
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
      Object.hasOwn(gradePoints, item.grade) ? gradePoints[item.grade].toFixed(2) : ""
    ]);
  }
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Sinai_Dental_GPA_Report.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("CSV report exported.");
}

function renderHistory() {
  elements.history.replaceChildren();
  if (!Array.isArray(gradeHistory) || !gradeHistory.length) {
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
      String(entry.credits ?? (Array.isArray(entry.courses) ? entry.courses.reduce((sum, c) => sum + (c.course?.credits || 0), 0) : 0)),
      String(entry.percentage ?? "—") + "%"
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
    ["Percentage", (entry.percentage ?? "—") + "%"]
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
      courseName.textContent = (item.course?.title || "Course") + " (" + (item.course?.code || "—") + ")";
      const grade = document.createElement("span");
      const points = Object.hasOwn(gradePoints, item.grade) ? gradePoints[item.grade].toFixed(1) : "—";
      grade.textContent = (item.grade || "—") + " · " + points + " points";
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
  gradeHistory = [];
  if (writeStorage(STORAGE_KEYS.history, gradeHistory)) {
    renderHistory();
    showToast("Grade history cleared.");
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
  try { localStorage.setItem("theme", nextTheme); } catch (error) { console.warn("Theme preference could not be saved.", error); }
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
  selected.grade = Object.hasOwn(gradePoints, grade) ? grade : "";
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
        link.classList.toggle("active", link.getAttribute("href") === "#" + visible.target.id);
      });
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, .15, .4] });
    document.querySelectorAll("main > section[id], main[id]").forEach(section => observer.observe(section));
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
  setTheme(readTheme());
  restoreDraft();
  bindEvents();
  setUpNavigation();
  renderCourses();
  renderSelectedCourses();
  renderHistory();
  updateDashboard();
}

function readTheme() {
  try {
    return localStorage.getItem("theme") || "light";
  } catch {
    return "light";
  }
}

initialize();
