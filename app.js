import { courseCatalog, ELECTIVE_COURSE_LIMIT } from "./courses.js";
import { calculateAcademicMetrics, GRADING_SCALES, DEFAULT_GRADE_SCALE, SPECIAL_GRADES, gradeFromGpa, gradeFromMark, gradePointsFor, getGradeOptionsForScale, normalizeGrade, isValidGrade as engineIsValidGrade } from "./gpa-engine.js";

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
  previousEarnedCredits: $("#previous-earned-credits"),
  previousPercentage: $("#previous-percentage"),
  gradeScale: $("#grade-scale"),
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

function getScaleId() {
  return elements.gradeScale && GRADING_SCALES[elements.gradeScale.value] ? elements.gradeScale.value : DEFAULT_GRADE_SCALE;
}

function isValidGrade(grade, scaleId = getScaleId()) {
  return engineIsValidGrade(grade, scaleId);
}

function normalizeCourseSelections(items, scaleId = getScaleId()) {
  const seen = new Set();
  let electiveCount = 0;
  return (Array.isArray(items) ? items : []).map(saved => {
    const course = courseCatalog.find(item => item.code === saved?.code);
    if (!course || seen.has(course.code)) return null;
    if (course.elective && electiveCount >= ELECTIVE_COURSE_LIMIT) return null;
    seen.add(course.code);
    if (course.elective) electiveCount += 1;
    const mark = saved.mark === "" || saved.mark === null || saved.mark === undefined ? null : Number(saved.mark);
    const markValid = Number.isFinite(mark) && mark >= 0 && mark <= 100;
    const grade = markValid ? gradeFromMark(mark, scaleId) : normalizeGrade(saved.grade);
    const priorGrade = normalizeGrade(saved.priorGrade);
    return {
      course,
      grade: isValidGrade(grade, scaleId) ? grade : "",
      mark: markValid ? mark : null,
      priorGrade: priorGrade && isValidGrade(priorGrade, scaleId) ? priorGrade : "",
      repeatNumber: Number(saved.repeatNumber) >= 2 ? 2 : 1
    };
  }).filter(Boolean);
}

function getCourseLevel(course) {
  const match = String(course.code).match(/\b([1-5])\d{3}\b/);
  return match ? match[1] : "other";
}

function getMetrics() {
  return calculateAcademicMetrics({
    previousGpa: elements.previousGpa.value,
    previousGpaHours: elements.previousCredits.value,
    previousEarnedCredits: elements.previousEarnedCredits.value,
    previousPercentage: elements.previousPercentage.value,
    degreeCredits: elements.degreeCredits.value,
    targetGpa: elements.targetGpa.value,
    gradingScale: getScaleId(),
    courses: selectedCourses
  });
}

function updateInputValidity(metrics) {
  elements.previousGpa.setAttribute("aria-invalid", String(!metrics.previous.valid && !metrics.previous.gpaValid));
  elements.previousCredits.setAttribute("aria-invalid", String(!metrics.previous.valid && !metrics.previous.gpaHoursValid));
  elements.previousEarnedCredits.setAttribute("aria-invalid", String(!metrics.previous.valid && !metrics.previous.earnedHoursValid));
  elements.previousPercentage.setAttribute("aria-invalid", String(!metrics.previous.valid && !metrics.previous.percentageValid));
  elements.degreeCredits.setAttribute("aria-invalid", String(!metrics.degreeValid));
  elements.targetGpa.setAttribute("aria-invalid", String(!metrics.targetValid));
}

function updateDashboard() {
  const result = getMetrics();
  updateInputValidity(result);

  const hasCurrentGrades = result.semesterGpaHours > 0;
  const hasCumulativeRecord = result.cumulativeGpa !== null;
  elements.semesterGpa.textContent = hasCurrentGrades ? result.semesterGpa.toFixed(2) : "—";
  elements.semesterCreditCaption.textContent = result.semesterGpaHours + " GPA-counted hours";
  elements.cumulativeGpa.textContent = hasCumulativeRecord ? result.cumulativeGpa.toFixed(2) : "—";
  elements.cumulativeGrade.textContent = hasCumulativeRecord ? gradeFromGpa(result.cumulativeGpa, result.gradingScale) : "N/A";
  elements.percentage.textContent = result.cumulativeWeightedPercentage === null ? "—" : result.cumulativeWeightedPercentage.toFixed(2);
  elements.totalCreditHours.textContent = String(result.semesterGpaHours);
  elements.completedCredits.textContent = String(result.cumulativeEarnedHours);
  elements.degreeCreditLabel.textContent = String(result.degreeCredits);
  elements.progressPercent.textContent = `${result.progress.toFixed(1)}%`;
  elements.progressBar.style.width = `${result.progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(Math.round(result.progress)));
  elements.remainingCredits.textContent = String(result.remainingDegreeCredits);
  elements.targetLabel.textContent = `${result.targetGpa.toFixed(2)} / 4.00`;
  elements.requiredGpa.textContent = result.requiredGpa === null ? "—" : result.requiredGpa.toFixed(2);
  elements.targetStatus.textContent = [result.targetMessage, ...(result.repeatNotices || [])].filter(Boolean).join(" ");
  elements.targetStatus.className = `target-status${result.targetTone ? ` ${result.targetTone}` : ""}`;
  elements.selectedCourseCaption.textContent = `${selectedCourses.length} courses selected · ${selectedCourses.filter(item => item.course.elective).length}/${ELECTIVE_COURSE_LIMIT} electives`;
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
    meta.textContent = `${course.code} · ${course.credits} credit hours${course.elective ? " · Elective option" : ""}`;
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
  const scaleId = getScaleId();
  const scaleOptions = getGradeOptionsForScale(scaleId);
  elements.selectedCourses.replaceChildren();
  elements.selectedCount.textContent = `${selectedCourses.length} selected`;
  elements.selectedCourseCaption.textContent = `${selectedCourses.length} courses selected · ${selectedCourses.filter(item => item.course.elective).length}/${ELECTIVE_COURSE_LIMIT} electives`;
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
    meta.textContent = `${item.course.code} · ${item.course.credits} credits${item.course.elective ? " · Elective" : ""}`;
    info.append(title, meta);

    const select = document.createElement("select");
    select.className = "grade-select";
    select.dataset.gradeCode = item.course.code;
    select.setAttribute("aria-label", `Current grade for ${item.course.title}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select grade";
    select.append(placeholder);
    for (const grade of scaleOptions) {
      const option = document.createElement("option");
      option.value = grade;
      const points = gradePointsFor(grade, scaleId);
      option.textContent = points === null ? `${grade} · ${SPECIAL_GRADES[grade]}` : `${grade} · ${points.toFixed(1)}`;
      select.append(option);
    }
    select.value = item.grade || "";

    const markInput = document.createElement("input");
    markInput.className = "mark-input";
    markInput.type = "number";
    markInput.min = "0";
    markInput.max = "100";
    markInput.step = "0.01";
    markInput.inputMode = "decimal";
    markInput.placeholder = "Mark %";
    markInput.value = item.mark ?? "";
    markInput.dataset.markCode = item.course.code;
    markInput.setAttribute("aria-label", `Actual mark for ${item.course.title}`);
    const gradeControls = document.createElement("div");
    gradeControls.className = "grade-controls";
    gradeControls.append(select, markInput);

    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.dataset.removeCode = item.course.code;
    remove.setAttribute("aria-label", `Remove ${item.course.title}`);

    const repeatControls = document.createElement("div");
    repeatControls.className = "repeat-controls";
    const priorWrap = document.createElement("label");
    priorWrap.className = "repeat-field";
    const priorLabel = document.createElement("span");
    priorLabel.textContent = "Previous transcript grade · optional";
    const priorSelect = document.createElement("select");
    priorSelect.className = "prior-grade-select";
    priorSelect.dataset.priorGradeCode = item.course.code;
    priorSelect.setAttribute("aria-label", `Previous transcript grade for ${item.course.title}`);
    const priorPlaceholder = document.createElement("option");
    priorPlaceholder.value = "";
    priorPlaceholder.textContent = "New course / not repeated";
    priorSelect.append(priorPlaceholder);
    for (const grade of scaleOptions) {
      const option = document.createElement("option");
      option.value = grade;
      const points = gradePointsFor(grade, scaleId);
      option.textContent = points === null ? `${grade} · ${SPECIAL_GRADES[grade]}` : `${grade} · ${points.toFixed(1)}`;
      priorSelect.append(option);
    }
    priorSelect.value = item.priorGrade || "";
    priorWrap.append(priorLabel, priorSelect);

    const repeatWrap = document.createElement("label");
    repeatWrap.className = "repeat-field";
    const repeatLabel = document.createElement("span");
    repeatLabel.textContent = "Repeat number";
    const repeatSelect = document.createElement("select");
    repeatSelect.className = "repeat-number-select";
    repeatSelect.dataset.repeatNumberCode = item.course.code;
    repeatSelect.setAttribute("aria-label", `Repeat number for ${item.course.title}`);
    repeatSelect.innerHTML = '<option value="1">First repeat</option><option value="2">Second or later repeat</option>';
    repeatSelect.value = String(item.repeatNumber || 1);
    repeatSelect.disabled = !item.priorGrade;
    repeatWrap.append(repeatLabel, repeatSelect);
    repeatControls.append(priorWrap, repeatWrap);

    const repeatDetails = document.createElement("details");
    repeatDetails.className = "repeat-details";
    repeatDetails.open = Boolean(item.priorGrade);
    const repeatSummary = document.createElement("summary");
    repeatSummary.textContent = item.priorGrade ? "Retake details" : "Retake options";
    repeatDetails.append(repeatSummary, repeatControls);

    row.append(info, gradeControls, remove, repeatDetails);
    fragment.append(row);
  }
  elements.selectedCourses.append(fragment);
}

function saveDraft() {
  const draft = {
    version: 5,
    gradingScale: getScaleId(),
    previousGpa: elements.previousGpa.value,
    previousCredits: elements.previousCredits.value,
    previousEarnedCredits: elements.previousEarnedCredits.value,
    previousPercentage: elements.previousPercentage.value,
    degreeCredits: elements.degreeCredits.value,
    targetGpa: elements.targetGpa.value,
    selectedCourses: selectedCourses.map(item => ({
      code: item.course.code, grade: normalizeGrade(item.grade) || "", mark: item.mark ?? null,
      priorGrade: item.priorGrade || "", repeatNumber: item.repeatNumber || 1
    }))
  };
  return writeStorage(STORAGE_KEYS.state, draft);
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(entry => entry && typeof entry === "object" && Array.isArray(entry.courses))
    .map(entry => {
      const gradingScale = GRADING_SCALES[entry.gradingScale] ? entry.gradingScale : DEFAULT_GRADE_SCALE;
      const courses = entry.courses.filter(item => item && item.course).map(item => {
        const mark = item.mark === "" || item.mark === null || item.mark === undefined ? null : Number(item.mark);
        const markValid = Number.isFinite(mark) && mark >= 0 && mark <= 100;
        const grade = markValid ? gradeFromMark(mark, gradingScale) : normalizeGrade(item.grade);
        const priorGrade = normalizeGrade(item.priorGrade);
        return {
          course: item.course,
          grade: isValidGrade(grade, gradingScale) ? grade : "",
          mark: markValid ? mark : null,
          priorGrade: priorGrade && isValidGrade(priorGrade, gradingScale) ? priorGrade : "",
          repeatNumber: Number(item.repeatNumber) >= 2 ? 2 : 1
        };
      });
      const metrics = calculateAcademicMetrics({
        previousGpa: entry.previousGpa ?? "",
        previousGpaHours: entry.previousGpaHours ?? entry.previousCredits ?? "",
        previousEarnedCredits: entry.previousEarnedCredits ?? entry.previousCredits ?? "",
        previousPercentage: entry.previousPercentage ?? "",
        gradingScale,
        courses
      });
      return {
        ...entry,
        gradingScale,
        semesterGpa: metrics.semesterGpa?.toFixed(2) ?? "—",
        cumulativeGpa: metrics.cumulativeGpa?.toFixed(2) ?? "—",
        percentage: metrics.cumulativeWeightedPercentage?.toFixed(2) ?? null,
        weightedPercentage: metrics.cumulativeWeightedPercentage?.toFixed(2) ?? null,
        semesterWeightedPercentage: metrics.semesterWeightedPercentage?.toFixed(2) ?? null,
        credits: metrics.semesterGpaHours,
        gpaHours: metrics.semesterGpaHours,
        earnedHours: metrics.semesterEarnedHours,
        courses
      };
    })
    .slice(0, 20);
}

function persistHistory() {
  return writeStorage(STORAGE_KEYS.history, gradeHistory);
}

function saveGrades() {
  const result = updateDashboard();
  if (!result.previous.valid || !result.degreeValid || !result.targetValid || !result.repeatValid) {
    showToast("Correct the highlighted GPA, degree and repeat-course details before saving.");
    return;
  }
  const recorded = selectedCourses.filter(item => isValidGrade(item.grade, getScaleId()));
  if (!recorded.length) {
    showToast("Choose a grade or transcript notation for at least one course before saving.");
    return;
  }
  savedGrades = Object.fromEntries(recorded.map(item => [item.course.code, {
    grade: normalizeGrade(item.grade), mark: item.mark ?? null,
    priorGrade: item.priorGrade || "", repeatNumber: item.repeatNumber || 1
  }]));
  const gradesSaved = writeStorage(STORAGE_KEYS.savedGrades, savedGrades);
  const draftSaved = saveDraft();
  const snapshot = {
    timestamp: new Date().toISOString(),
    gradingScale: result.gradingScale,
    semesterGpa: result.semesterGpa?.toFixed(2) ?? "—",
    cumulativeGpa: result.cumulativeGpa?.toFixed(2) ?? "—",
    percentage: result.cumulativeWeightedPercentage?.toFixed(2) ?? null,
    weightedPercentage: result.cumulativeWeightedPercentage?.toFixed(2) ?? null,
    semesterWeightedPercentage: result.semesterWeightedPercentage?.toFixed(2) ?? null,
    credits: result.semesterGpaHours,
    gpaHours: result.semesterGpaHours,
    earnedHours: result.semesterEarnedHours,
    previousGpa: result.previous.gpa,
    previousCredits: result.previous.gpaHours,
    previousEarnedCredits: result.previous.earnedHours,
    previousPercentage: result.previous.weightedPercentage,
    courses: recorded.map(item => ({
      course: { ...item.course }, grade: normalizeGrade(item.grade), mark: item.mark ?? null,
      priorGrade: item.priorGrade || "", repeatNumber: item.repeatNumber || 1
    }))
  };
  gradeHistory = [snapshot, ...gradeHistory].slice(0, 20);
  const historySaved = persistHistory();
  renderHistory();
  showToast(gradesSaved && draftSaved && historySaved
    ? "Grades and semester snapshot saved."
    : "Some data could not be saved. Check browser storage.");
}

function restoreDraft() {
  const draft = readStorage(STORAGE_KEYS.state, null);
  if (!draft || typeof draft !== "object") return false;
  elements.previousGpa.value = String(draft.previousGpa ?? "");
  elements.previousCredits.value = String(draft.previousGpaHours ?? draft.previousCredits ?? "");
  elements.previousEarnedCredits.value = String(draft.previousEarnedCredits ?? draft.previousGpaHours ?? draft.previousCredits ?? "");
  elements.previousPercentage.value = String(draft.previousPercentage ?? "");
  elements.gradeScale.value = GRADING_SCALES[draft.gradingScale] ? draft.gradingScale : DEFAULT_GRADE_SCALE;
  elements.degreeCredits.value = String(draft.degreeCredits ?? "189");
  elements.targetGpa.value = String(draft.targetGpa ?? "3.60");
  selectedCourses = normalizeCourseSelections(draft.selectedCourses, getScaleId());
  return true;
}

function loadSavedGrades() {
  const stored = readStorage(STORAGE_KEYS.savedGrades, {});
  savedGrades = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const entries = Object.entries(savedGrades).filter(([code, entry]) => {
    const grade = typeof entry === "string" ? entry : entry?.grade;
    return courseCatalog.some(course => course.code === code) && isValidGrade(grade, getScaleId());
  });
  if (!entries.length) {
    showToast("No saved course grades were found on this device.");
    return;
  }
  selectedCourses = normalizeCourseSelections(entries.map(([code, entry]) => ({
    code,
    grade: typeof entry === "string" ? entry : entry?.grade,
    mark: typeof entry === "object" && entry !== null ? entry.mark : null,
    priorGrade: typeof entry === "object" && entry !== null ? entry.priorGrade : "",
    repeatNumber: typeof entry === "object" && entry !== null ? entry.repeatNumber : 1
  })), getScaleId());
  renderCourses();
  renderSelectedCourses();
  updateDashboard();
  saveDraft();
  showToast("Saved course grades loaded. No more than two elective options are allowed by the study plan.");
}

function resetCalculator() {
  if (!window.confirm("Reset the selected courses and previous academic record? Saved history will remain unchanged.")) return;
  selectedCourses = [];
  elements.previousGpa.value = "";
  elements.previousCredits.value = "";
  elements.previousEarnedCredits.value = "";
  elements.previousPercentage.value = "";
  elements.gradeScale.value = DEFAULT_GRADE_SCALE;
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
    ["Grading scale", GRADING_SCALES[result.gradingScale].label],
    ["Previous GPA", result.previous.gpa],
    ["Previous GPA hours", result.previous.gpaHours],
    ["Previous earned credits", result.previous.earnedHours],
    ["Previous weighted mark", result.previous.weightedPercentage ?? "—"],
    ["Semester GPA", result.semesterGpa === null ? "—" : result.semesterGpa.toFixed(2)],
    ["Cumulative GPA", result.cumulativeGpa === null ? "—" : result.cumulativeGpa.toFixed(2)],
    ["Semester GPA hours", result.semesterGpaHours],
    ["Semester earned hours", result.semesterEarnedHours],
    ["Outstanding failed hours", result.outstandingFailures],
    ["Future GPA-counted hours", result.futureGpaHours],
    ["Actual cumulative weighted mark", result.cumulativeWeightedPercentage === null ? "—" : result.cumulativeWeightedPercentage.toFixed(2) + "%"],
    [],
    ["Course code", "Course title", "Credits", "Previous grade", "Repeat number", "Current grade", "Effective CGPA grade", "Grade points", "Actual mark (%)"]
  ];
  for (const item of selectedCourses) {
    const grade = normalizeGrade(item.grade);
    const courseResult = result.courses.find(entry => entry.course.code === item.course.code);
    const effectiveGrade = courseResult?.effectiveGrade ?? grade;
    const points = gradePointsFor(effectiveGrade, result.gradingScale);
    rows.push([
      item.course.code, item.course.title, item.course.credits, item.priorGrade || "",
      item.priorGrade ? (item.repeatNumber >= 2 ? "2+" : "1") : "",
      grade || "Not graded", effectiveGrade || "",
      points === null ? "" : points.toFixed(2), item.mark ?? ""
    ]);
  }
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  downloadFile("Sinai_Dental_GPA_Report.csv", csv, "text/csv;charset=utf-8");
  showToast("CSV report exported.");
}

function exportBackup() {
  const draft = {
    version: 5,
    gradingScale: getScaleId(),
    previousGpa: elements.previousGpa.value,
    previousCredits: elements.previousCredits.value,
    previousEarnedCredits: elements.previousEarnedCredits.value,
    previousPercentage: elements.previousPercentage.value,
    degreeCredits: elements.degreeCredits.value,
    targetGpa: elements.targetGpa.value,
    selectedCourses: selectedCourses.map(item => ({
      code: item.course.code, grade: normalizeGrade(item.grade) || "", mark: item.mark ?? null,
      priorGrade: item.priorGrade || "", repeatNumber: item.repeatNumber || 1
    }))
  };
  const payload = { app: "Sinai Dental GPA Studio", version: 5, exportedAt: new Date().toISOString(), draft, savedGrades, history: gradeHistory, theme: document.documentElement.dataset.theme };
  downloadFile("Sinai_Dental_GPA_Backup.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast("Backup file exported.");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "Sinai Dental GPA Studio" || !data.draft || typeof data.draft !== "object") throw new Error("Unsupported backup format");
    if (!window.confirm("Importing this backup will replace the current calculator data on this device. Continue?")) return;
    const draft = data.draft;
    const scaleId = GRADING_SCALES[draft.gradingScale] ? draft.gradingScale : DEFAULT_GRADE_SCALE;
    elements.gradeScale.value = scaleId;
    const oldCredits = String(draft.previousGpaHours ?? draft.previousCredits ?? "");
    const normalizedDraft = {
      version: 5,
      gradingScale: scaleId,
      previousGpa: String(draft.previousGpa ?? ""),
      previousCredits: oldCredits,
      previousEarnedCredits: String(draft.previousEarnedCredits ?? oldCredits),
      previousPercentage: String(draft.previousPercentage ?? ""),
      degreeCredits: String(draft.degreeCredits ?? "189"),
      targetGpa: String(draft.targetGpa ?? "3.60"),
      selectedCourses: normalizeCourseSelections(draft.selectedCourses, scaleId).map(item => ({
        code: item.course.code, grade: item.grade, mark: item.mark,
        priorGrade: item.priorGrade, repeatNumber: item.repeatNumber
      }))
    };
    const importedGrades = data.savedGrades && typeof data.savedGrades === "object" && !Array.isArray(data.savedGrades)
      ? Object.fromEntries(Object.entries(data.savedGrades).filter(([code, value]) => {
          const grade = typeof value === "string" ? value : value?.grade;
          return courseCatalog.some(course => course.code === code) && isValidGrade(grade, scaleId);
        }).map(([code, value]) => {
          const gradeValue = typeof value === "string" ? value : value?.grade;
          const mark = typeof value === "object" && value !== null && value.mark !== null && value.mark !== undefined ? Number(value.mark) : null;
          const validMark = Number.isFinite(mark) && mark >= 0 && mark <= 100;
          return [code, {
            grade: validMark ? gradeFromMark(mark, scaleId) : normalizeGrade(gradeValue),
            mark: validMark ? mark : null,
            priorGrade: typeof value === "object" && value !== null ? normalizeGrade(value.priorGrade) : "",
            repeatNumber: typeof value === "object" && value !== null && Number(value.repeatNumber) >= 2 ? 2 : 1
          }];
        })) : {};
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
  for (const label of ["#", "Saved date", "Semester GPA", "Cumulative GPA", "GPA hours", "Weighted mark", ""]) {
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
      String(entry.gpaHours ?? entry.credits ?? 0),
      entry.weightedPercentage === null || entry.weightedPercentage === undefined ? "—" : String(entry.weightedPercentage) + "%"
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
    if (entry.cumulativeGpa === null || entry.cumulativeGpa === undefined || entry.cumulativeGpa === "") return;
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
    ["Actual weighted mark", entry.weightedPercentage === null || entry.weightedPercentage === undefined ? "—" : String(entry.weightedPercentage) + "%"]
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
      const gradeCode = normalizeGrade(item.grade);
      const pointsValue = gradePointsFor(gradeCode, entry.gradingScale || DEFAULT_GRADE_SCALE);
      const points = pointsValue === null ? (SPECIAL_GRADES[gradeCode] || "No grade") : pointsValue.toFixed(1) + " GPA points";
      grade.textContent = (gradeCode || "—") + " · " + points;
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
  if (course.elective && selectedCourses.filter(item => item.course.elective).length >= ELECTIVE_COURSE_LIMIT) {
    showToast("The degree plan requires 4 elective credits: choose only two 2-credit elective options. Remove one selected elective to replace it.");
    return;
  }
  selectedCourses.push({ course, grade: "", mark: null, priorGrade: "", repeatNumber: 1 });
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
  const scaleId = getScaleId();
  selected.grade = isValidGrade(grade, scaleId) ? normalizeGrade(grade) : "";
  selected.mark = null;
  updateDashboard();
  renderSelectedCourses();
  saveDraft();
}

function updateMark(code, rawMark) {
  const selected = selectedCourses.find(item => item.course.code === code);
  if (!selected) return;
  if (rawMark === "") {
    selected.mark = null;
  } else {
    const mark = Number(rawMark);
    if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
      showToast("The actual mark must be between 0 and 100.");
      renderSelectedCourses();
      return;
    }
    selected.mark = mark;
    selected.grade = gradeFromMark(mark, getScaleId());
  }
  updateDashboard();
  renderSelectedCourses();
  saveDraft();
}

function updatePriorGrade(code, grade) {
  const selected = selectedCourses.find(item => item.course.code === code);
  if (!selected) return;
  const scaleId = getScaleId();
  selected.priorGrade = grade && isValidGrade(grade, scaleId) ? normalizeGrade(grade) : "";
  if (!selected.priorGrade) selected.repeatNumber = 1;
  updateDashboard();
  renderSelectedCourses();
  saveDraft();
}

function updateRepeatNumber(code, value) {
  const selected = selectedCourses.find(item => item.course.code === code);
  if (!selected || !selected.priorGrade) return;
  selected.repeatNumber = Number(value) >= 2 ? 2 : 1;
  updateDashboard();
  renderSelectedCourses();
  saveDraft();
}

function changeGradingScale() {
  const scaleId = getScaleId();
  selectedCourses = selectedCourses.map(item => {
    const grade = item.mark !== null && item.mark !== undefined
      ? gradeFromMark(item.mark, scaleId)
      : (isValidGrade(item.grade, scaleId) ? normalizeGrade(item.grade) : "");
    const priorGrade = isValidGrade(item.priorGrade, scaleId) ? normalizeGrade(item.priorGrade) : "";
    return { ...item, grade, priorGrade, repeatNumber: priorGrade ? item.repeatNumber || 1 : 1 };
  });
  updateDashboard();
  renderSelectedCourses();
  saveDraft();
  showToast("Grading scheme changed. Make sure the previous GPA and prior grades use the selected scheme.");
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
    const markInput = event.target.closest("[data-mark-code]");
    if (markInput) updateMark(markInput.dataset.markCode, markInput.value);
    const priorGrade = event.target.closest("[data-prior-grade-code]");
    if (priorGrade) updatePriorGrade(priorGrade.dataset.priorGradeCode, priorGrade.value);
    const repeatNumber = event.target.closest("[data-repeat-number-code]");
    if (repeatNumber) updateRepeatNumber(repeatNumber.dataset.repeatNumberCode, repeatNumber.value);
  });
  elements.selectedCourses.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-code]");
    if (button) removeCourse(button.dataset.removeCode);
  });

  [elements.previousGpa, elements.previousCredits, elements.previousEarnedCredits, elements.previousPercentage, elements.degreeCredits, elements.targetGpa].forEach(input => {
    input.addEventListener("input", () => {
      updateDashboard();
      saveDraft();
    });
    input.addEventListener("change", () => {
      updateDashboard();
      saveDraft();
    });
  });

  elements.gradeScale.addEventListener("change", changeGradingScale);
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
