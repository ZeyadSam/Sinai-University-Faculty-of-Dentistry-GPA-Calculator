export const GRADE_POINTS = Object.freeze({
  "A+": 4.0,
  A: 3.8,
  "A-": 3.6,
  "B+": 3.3,
  B: 3.0,
  "C+": 2.7,
  C: 2.4,
  D: 2.0,
  F: 0.0,
  W: 0.0,
  I: 0.0,
  CN: 0.0
});

export const GRADE_OPTIONS = Object.freeze(Object.keys(GRADE_POINTS));

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseFinite(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseAcademicRecord(gpaValue, creditsValue) {
  const gpaRaw = String(gpaValue ?? "").trim();
  const creditsRaw = String(creditsValue ?? "").trim();

  if (gpaRaw === "" && creditsRaw === "") {
    return { gpa: 0, credits: 0, valid: true, empty: true };
  }

  const gpa = parseFinite(gpaRaw);
  const credits = parseFinite(creditsRaw);
  const gpaValid = gpa !== null && Number.isFinite(gpa) && gpa >= 0 && gpa <= 4;
  const creditsValid = credits !== null && Number.isFinite(credits) && Number.isInteger(credits) && credits >= 0 && credits <= 300;

  return {
    gpa: gpaValid ? gpa : 0,
    credits: creditsValid ? credits : 0,
    valid: gpaValid && creditsValid,
    empty: false,
    gpaValid,
    creditsValid
  };
}

export function gpaToPercentage(gpa) {
  if (!Number.isFinite(gpa)) return 0;
  const value = clamp(gpa, 0, 4);
  if (value >= 4) return 95;
  if (value < 2) return (value / 2) * 60;
  if (value >= 3.8) return 90 + ((value - 3.8) / 0.2) * 5;
  if (value >= 3.6) return 85 + ((value - 3.6) / 0.2) * 5;
  if (value >= 3.3) return 80 + ((value - 3.3) / 0.3) * 5;
  if (value >= 3.0) return 75 + ((value - 3.0) / 0.3) * 5;
  if (value >= 2.7) return 70 + ((value - 2.7) / 0.3) * 5;
  if (value >= 2.4) return 65 + ((value - 2.4) / 0.3) * 5;
  return 60 + ((value - 2.0) / 0.4) * 5;
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
 * Pure GPA calculation shared by the browser UI and automated tests.
 * `courses` is an array of { course: { credits }, grade } objects.
 */
export function calculateAcademicMetrics({
  previousGpa = "",
  previousCredits = "",
  degreeCredits = 189,
  targetGpa = 3.6,
  courses = []
} = {}) {
  const previous = parseAcademicRecord(previousGpa, previousCredits);
  const degreeValue = parseFinite(degreeCredits);
  const targetValue = parseFinite(targetGpa);
  const degreeValid = degreeValue !== null && Number.isInteger(degreeValue) && degreeValue >= 1 && degreeValue <= 300;
  const targetValid = targetValue !== null && targetValue >= 0 && targetValue <= 4;
  const safeDegreeCredits = degreeValid ? degreeValue : 189;
  const safeTargetGpa = targetValid ? targetValue : 3.6;

  const gradedCourses = courses.filter(item =>
    item && item.course && Number.isFinite(Number(item.course.credits)) &&
    Number(item.course.credits) > 0 && Object.hasOwn(GRADE_POINTS, item.grade)
  );
  const selectedCredits = courses.reduce((sum, item) => {
    const credits = Number(item?.course?.credits);
    return sum + (Number.isFinite(credits) && credits > 0 ? credits : 0);
  }, 0);
  const semesterCredits = gradedCourses.reduce((sum, item) => sum + Number(item.course.credits), 0);
  const semesterPoints = gradedCourses.reduce((sum, item) =>
    sum + GRADE_POINTS[item.grade] * Number(item.course.credits), 0);
  const semesterGpa = semesterCredits > 0 ? semesterPoints / semesterCredits : 0;
  const cumulativeCredits = previous.credits + semesterCredits;
  const cumulativePoints = previous.gpa * previous.credits + semesterPoints;
  const cumulativeGpa = cumulativeCredits > 0 ? cumulativePoints / cumulativeCredits : 0;
  const percentage = cumulativeCredits > 0 ? gpaToPercentage(cumulativeGpa) : null;
  const remainingCredits = Math.max(0, safeDegreeCredits - cumulativeCredits);
  const progress = clamp((cumulativeCredits / safeDegreeCredits) * 100, 0, 100);

  let requiredGpa = null;
  let targetMessage = "Enter your previous academic record to calculate a reliable target.";
  let targetTone = "";

  if (!previous.valid) {
    targetMessage = "Enter both a valid previous GPA and its completed credit hours, or leave both fields empty.";
    targetTone = "bad";
  } else if (!degreeValid || !targetValid) {
    targetMessage = "Check the degree credit requirement and target GPA values.";
    targetTone = "bad";
  } else if (cumulativeCredits >= safeDegreeCredits) {
    if (cumulativeGpa >= safeTargetGpa) {
      requiredGpa = 0;
      targetMessage = "Your target GPA has been achieved.";
      targetTone = "good";
    } else {
      targetMessage = "All degree credits are accounted for, but the target has not been reached.";
      targetTone = "bad";
    }
  } else if (cumulativeGpa >= safeTargetGpa) {
    requiredGpa = 0;
    targetMessage = "Your current cumulative GPA already meets the target.";
    targetTone = "good";
  } else {
    const needed = (safeTargetGpa * safeDegreeCredits - cumulativePoints) / remainingCredits;
    if (needed > 4) {
      targetMessage = "This target is no longer attainable with a maximum remaining GPA of 4.00.";
      targetTone = "bad";
    } else {
      requiredGpa = clamp(needed, 0, 4);
      targetMessage = "Average this GPA across your remaining degree credits to reach your target.";
      targetTone = "warning";
    }
  }

  return {
    previous,
    degreeValid,
    targetValid,
    degreeCredits: safeDegreeCredits,
    targetGpa: safeTargetGpa,
    gradedCourses,
    semesterCredits,
    selectedCredits,
    semesterPoints,
    semesterGpa,
    cumulativeCredits,
    cumulativePoints,
    cumulativeGpa,
    percentage,
    remainingCredits,
    progress,
    requiredGpa,
    targetMessage,
    targetTone
  };
}
