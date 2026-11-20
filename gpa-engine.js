export const GRADE_POINTS = Object.freeze({
  "A+": 4.0,
  A: 3.8,
  "A-": 3.6,
  "B+": 3.3,
  B: 3.0,
  "C+": 2.7,
  C: 2.4,
  D: 2.0,
  F: 0.0
});

// Transcript notations are not zero-point letter grades.
export const SPECIAL_GRADES = Object.freeze({
  I: "Incomplete",
  P: "Pass",
  NC: "No Credit",
  W: "Withdrawal"
});

export const GRADE_OPTIONS = Object.freeze([
  ...Object.keys(GRADE_POINTS),
  ...Object.keys(SPECIAL_GRADES)
]);

export function normalizeGrade(grade) {
  const value = String(grade ?? "").trim().toUpperCase();
  return value === "CN" ? "NC" : value;
}

export function isValidGrade(grade) {
  return GRADE_OPTIONS.includes(normalizeGrade(grade));
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function parseHours(value, { allowEmpty = false, maximum = 300 } = {}) {
  const parsed = parseNumber(value);
  if (parsed === null && allowEmpty) return { value: null, valid: true };
  const valid = parsed !== null && Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum;
  return { value: valid ? parsed : 0, valid };
}

function parsePreviousRecord({ gpaValue, gpaHoursValue, earnedHoursValue, percentageValue }) {
  const gpaRaw = String(gpaValue ?? "").trim();
  const gpaHoursRaw = String(gpaHoursValue ?? "").trim();
  const earnedHoursRaw = String(earnedHoursValue ?? "").trim();
  const percentageRaw = String(percentageValue ?? "").trim();

  if (!gpaRaw && !gpaHoursRaw && !earnedHoursRaw && !percentageRaw) {
    return {
      gpa: 0, gpaHours: 0, earnedHours: 0, weightedPercentage: null, points: 0,
      valid: true, empty: true, gpaValid: true, gpaHoursValid: true,
      earnedHoursValid: true, percentageValid: true, usedEarnedHoursFallback: false
    };
  }

  const gpa = parseNumber(gpaRaw);
  const gpaHours = parseHours(gpaHoursRaw);
  const earnedHoursInput = parseHours(earnedHoursRaw, { allowEmpty: true });
  const percentage = parseNumber(percentageRaw);

  const gpaHoursValid = gpaHours.valid;
  const gpaValid = gpaHours.value === 0
    ? (gpaRaw === "" || (gpa !== null && Number.isFinite(gpa) && gpa === 0))
    : (gpa !== null && Number.isFinite(gpa) && gpa >= 0 && gpa <= 4);
  // Backward compatibility: older versions had one "previous credits" field.
  // When the new earned-credit field is empty, assume all prior GPA hours were earned.
  const earnedHours = earnedHoursInput.value === null ? gpaHours.value : earnedHoursInput.value;
  const earnedHoursValid = earnedHoursInput.valid && earnedHours >= 0;
  const percentageValid = percentageRaw === "" ||
    (percentage !== null && Number.isFinite(percentage) && percentage >= 0 && percentage <= 100);

  return {
    gpa: gpaValid && gpa !== null ? gpa : 0,
    gpaHours: gpaHours.value,
    earnedHours: earnedHoursValid ? earnedHours : 0,
    weightedPercentage: percentageRaw === "" || !percentageValid ? null : percentage,
    points: gpaValid && gpa !== null ? gpa * gpaHours.value : 0,
    valid: gpaValid && gpaHoursValid && earnedHoursValid && percentageValid,
    empty: false,
    gpaValid,
    gpaHoursValid,
    earnedHoursValid,
    percentageValid,
    usedEarnedHoursFallback: earnedHoursInput.value === null
  };
}

export function gradeFromMark(mark) {
  const value = parseNumber(mark);
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100) return "";
  if (value >= 95) return "A+";
  if (value >= 90) return "A";
  if (value >= 85) return "A-";
  if (value >= 80) return "B+";
  if (value >= 75) return "B";
  if (value >= 70) return "C+";
  if (value >= 65) return "C";
  if (value >= 60) return "D";
  return "F";
}

export function gradeFromGpa(gpa) {
  if (!Number.isFinite(gpa)) return "N/A";
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

/**
 * Sinai GPA calculation:
 * - A+ through F affect GPA. F contributes zero points and stays in the GPA denominator.
 * - P earns degree credit but does not contribute GPA points or GPA hours.
 * - I, NC and W are excluded from GPA and earned-credit totals.
 * - GPA hours and earned degree credits are tracked separately.
 * - Percentages are never reverse-engineered from GPA. They require actual marks.
 */
export function calculateAcademicMetrics({
  previousGpa = "",
  previousCredits = "",
  previousGpaHours = previousCredits,
  previousEarnedCredits = "",
  previousPercentage = "",
  degreeCredits = 189,
  targetGpa = 3.6,
  courses = []
} = {}) {
  const previous = parsePreviousRecord({
    gpaValue: previousGpa,
    gpaHoursValue: previousGpaHours,
    earnedHoursValue: previousEarnedCredits,
    percentageValue: previousPercentage
  });

  const degreeValue = parseNumber(degreeCredits);
  const targetValue = parseNumber(targetGpa);
  const degreeValid = degreeValue !== null && Number.isInteger(degreeValue) && degreeValue >= 1 && degreeValue <= 300;
  const targetValid = targetValue !== null && targetValue >= 0 && targetValue <= 4;
  const safeDegreeCredits = degreeValid ? degreeValue : 189;
  const safeTargetGpa = targetValid ? targetValue : 3.6;
  const courseList = Array.isArray(courses) ? courses : [];

  const normalizedCourses = courseList.map(item => ({
    ...item,
    grade: normalizeGrade(item?.grade),
    credits: parseNumber(item?.course?.credits),
    mark: item?.mark === "" || item?.mark === null || item?.mark === undefined ? null : parseNumber(item.mark)
  }));
  const validCourses = normalizedCourses.filter(item =>
    item.course && item.credits !== null && Number.isFinite(item.credits) && item.credits > 0
  );
  const gpaCourses = validCourses.filter(item => Object.hasOwn(GRADE_POINTS, item.grade));
  const specialCourses = validCourses.filter(item => Object.hasOwn(SPECIAL_GRADES, item.grade));
  const selectedCredits = validCourses.reduce((sum, item) => sum + item.credits, 0);
  const semesterGpaHours = gpaCourses.reduce((sum, item) => sum + item.credits, 0);
  const semesterPoints = gpaCourses.reduce((sum, item) => sum + GRADE_POINTS[item.grade] * item.credits, 0);
  const semesterGpa = semesterGpaHours > 0 ? semesterPoints / semesterGpaHours : null;
  const semesterEarnedHours = validCourses.reduce((sum, item) => {
    const passingLetter = Object.hasOwn(GRADE_POINTS, item.grade) && item.grade !== "F";
    const passNotation = item.grade === "P";
    return sum + (passingLetter || passNotation ? item.credits : 0);
  }, 0);

  const cumulativeGpaHours = previous.gpaHours + semesterGpaHours;
  const cumulativePoints = previous.points + semesterPoints;
  const cumulativeGpa = cumulativeGpaHours > 0 ? cumulativePoints / cumulativeGpaHours : null;
  const cumulativeEarnedHours = previous.earnedHours + semesterEarnedHours;
  const remainingDegreeCredits = Math.max(0, safeDegreeCredits - cumulativeEarnedHours);
  const progress = clamp((cumulativeEarnedHours / safeDegreeCredits) * 100, 0, 100);

  const currentMarksValid = gpaCourses.every(item =>
    item.mark !== null && Number.isFinite(item.mark) && item.mark >= 0 && item.mark <= 100
  );
  const previousMarksValid = previous.gpaHours === 0 || previous.weightedPercentage !== null;
  const allMarksAvailable = currentMarksValid && previousMarksValid && cumulativeGpaHours > 0;
  const semesterMarksAvailable = gpaCourses.length > 0 && currentMarksValid;
  const semesterWeightedPercentage = semesterMarksAvailable
    ? gpaCourses.reduce((sum, item) => sum + item.mark * item.credits, 0) / semesterGpaHours
    : null;
  const cumulativeWeightedPercentage = allMarksAvailable
    ? ((previous.weightedPercentage ?? 0) * previous.gpaHours +
      gpaCourses.reduce((sum, item) => sum + item.mark * item.credits, 0)) / cumulativeGpaHours
    : null;

  let requiredGpa = null;
  let targetMessage = "Enter your previous record to calculate the GPA you need.";
  let targetTone = "";

  if (!previous.valid) {
    targetMessage = "Check the previous GPA, GPA hours, earned credits and percentage values.";
    targetTone = "bad";
  } else if (!degreeValid || !targetValid) {
    targetMessage = "Check the degree credit requirement and target GPA values.";
    targetTone = "bad";
  } else if (remainingDegreeCredits === 0) {
    if (cumulativeGpa !== null && cumulativeGpa >= safeTargetGpa) {
      requiredGpa = 0;
      targetMessage = "The required degree credits are complete and your target GPA has been achieved.";
      targetTone = "good";
    } else {
      targetMessage = "The required degree credits are complete, but the target GPA has not been reached.";
      targetTone = "bad";
    }
  } else {
    // Future GPA hours are the remaining earned degree credits. Current failed,
    // withdrawn and incomplete attempts remain in the existing GPA-hour total.
    const futureGpaHours = cumulativeGpaHours + remainingDegreeCredits;
    const needed = (safeTargetGpa * futureGpaHours - cumulativePoints) / remainingDegreeCredits;
    if (needed > 4 + 1e-10) {
      targetMessage = "This target is mathematically unattainable with a maximum future GPA of 4.00.";
      targetTone = "bad";
    } else {
      requiredGpa = clamp(needed, 0, 4);
      if (needed <= 0) {
        targetMessage = "Your current grade points provide enough margin; even a 0.00 future GPA would preserve the target.";
        targetTone = "good";
      } else if (cumulativeGpa !== null && cumulativeGpa >= safeTargetGpa) {
        targetMessage = "You are currently above your target. Maintain at least this average over the remaining degree credits.";
        targetTone = "good";
      } else {
        targetMessage = "You need to average this GPA across the remaining degree credits to reach your target.";
        targetTone = "warning";
      }
    }
  }

  return {
    previous,
    degreeValid,
    targetValid,
    degreeCredits: safeDegreeCredits,
    targetGpa: safeTargetGpa,
    courses: validCourses,
    gradedCourses: validCourses.filter(item => item.grade),
    gpaCourses,
    specialCourses,
    semesterGpaHours,
    semesterCredits: semesterGpaHours,
    semesterPoints,
    semesterGpa,
    semesterEarnedHours,
    cumulativeGpaHours,
    cumulativeCredits: cumulativeGpaHours,
    cumulativePoints,
    cumulativeGpa,
    cumulativeEarnedHours,
    remainingDegreeCredits,
    remainingCredits: remainingDegreeCredits,
    selectedCredits,
    progress,
    semesterWeightedPercentage,
    cumulativeWeightedPercentage,
    percentage: cumulativeWeightedPercentage,
    requiredGpa,
    targetMessage,
    targetTone
  };
}
