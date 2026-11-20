export const GRADING_SCALES = Object.freeze({
  uploadedKey: Object.freeze({
    label: "Uploaded GPA key",
    gradePoints: Object.freeze({
      "A+": 4.0, A: 3.8, "A-": 3.6, "B+": 3.3, B: 3.0, "C+": 2.7, C: 2.4, D: 2.0, F: 0.0
    }),
    thresholds: Object.freeze([
      [95, "A+"], [90, "A"], [85, "A-"], [80, "B+"], [75, "B"], [70, "C+"], [65, "C"], [60, "D"], [0, "F"]
    ])
  }),
  university2023: Object.freeze({
    label: "Sinai University 2023 regulations",
    gradePoints: Object.freeze({
      A: 4.0, "A-": 3.7, "B+": 3.3, B: 3.0, "B-": 2.7, "C+": 2.3, C: 2.0, "C-": 1.7, "D+": 1.3, D: 1.0, F: 0.0
    }),
    // The published PDF prints "76.5 to <70" for C, which is impossible.
    // 67.5 is used as the contiguous lower boundary between C+ and C-.
    thresholds: Object.freeze([
      [90, "A"], [85, "A-"], [80, "B+"], [75, "B"], [72.5, "B-"],
      [70, "C+"], [67.5, "C"], [65, "C-"], [62.5, "D+"], [60, "D"], [0, "F"]
    ])
  })
});

export const DEFAULT_GRADE_SCALE = "uploadedKey";
export const GRADE_POINTS = GRADING_SCALES[DEFAULT_GRADE_SCALE].gradePoints;

export const SPECIAL_GRADES = Object.freeze({
  I: "Incomplete",
  P: "Pass",
  NC: "No Credit",
  W: "Withdrawal",
  FW: "Forced withdrawal"
});

export const GRADE_OPTIONS = Object.freeze([
  ...new Set([
    ...Object.keys(GRADING_SCALES.uploadedKey.gradePoints),
    ...Object.keys(GRADING_SCALES.university2023.gradePoints),
    ...Object.keys(SPECIAL_GRADES)
  ])
]);

export function getGradeOptionsForScale(scaleId = DEFAULT_GRADE_SCALE) {
  const scale = GRADING_SCALES[scaleId] || GRADING_SCALES[DEFAULT_GRADE_SCALE];
  return [...Object.keys(scale.gradePoints), ...Object.keys(SPECIAL_GRADES)];
}

export function normalizeGrade(grade) {
  const value = String(grade ?? "").trim().toUpperCase();
  if (value === "CN") return "NC";
  if (value === "A−") return "A-";
  if (value === "B−") return "B-";
  if (value === "C−") return "C-";
  if (value === "D−") return "D-";
  return value;
}

export function isValidGrade(grade, scaleId = DEFAULT_GRADE_SCALE) {
  return getGradeOptionsForScale(scaleId).includes(normalizeGrade(grade));
}

export function gradePointsFor(grade, scaleId = DEFAULT_GRADE_SCALE) {
  const normalized = normalizeGrade(grade);
  const scale = GRADING_SCALES[scaleId] || GRADING_SCALES[DEFAULT_GRADE_SCALE];
  if (Object.hasOwn(scale.gradePoints, normalized)) return scale.gradePoints[normalized];
  if (normalized === "FW") return 0;
  return null;
}

export function isGpaCountedGrade(grade, scaleId = DEFAULT_GRADE_SCALE) {
  const normalized = normalizeGrade(grade);
  return Object.hasOwn((GRADING_SCALES[scaleId] || GRADING_SCALES[DEFAULT_GRADE_SCALE]).gradePoints, normalized)
    || normalized === "FW";
}

export function isEarnedGrade(grade, scaleId = DEFAULT_GRADE_SCALE) {
  const normalized = normalizeGrade(grade);
  const points = gradePointsFor(normalized, scaleId);
  return (points !== null && points > 0) || normalized === "P";
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

export function gradeFromMark(mark, scaleId = DEFAULT_GRADE_SCALE) {
  const value = parseNumber(mark);
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100) return "";
  const scale = GRADING_SCALES[scaleId] || GRADING_SCALES[DEFAULT_GRADE_SCALE];
  for (const [minimum, grade] of scale.thresholds) {
    if (value >= minimum) return grade;
  }
  return "F";
}

export function gradeFromGpa(gpa, scaleId = DEFAULT_GRADE_SCALE) {
  if (!Number.isFinite(gpa)) return "N/A";
  const scale = GRADING_SCALES[scaleId] || GRADING_SCALES[DEFAULT_GRADE_SCALE];
  return Object.entries(scale.gradePoints)
    .filter(([grade]) => grade !== "F")
    .sort((a, b) => b[1] - a[1])
    .find(([, points]) => gpa >= points)?.[0] || "F";
}

function applyRepeatCap(grade, priorGrade, repeatNumber, scaleId) {
  const normalized = normalizeGrade(grade);
  const prior = normalizeGrade(priorGrade);
  if (Number(repeatNumber) < 2 || !["F", "FW"].includes(prior)) return normalized;
  const points = gradePointsFor(normalized, scaleId);
  const cap = gradePointsFor("D", scaleId);
  if (points === null || points <= cap) return normalized;
  return "D";
}

/**
 * - Semester GPA counts current GPA-bearing attempts. F and FW add zero points but count hours.
 * - W, I, NC and P are excluded from GPA; P earns degree credit.
 * - CGPA repeats replace the earlier attempt rather than double-counting course credit hours.
 * - The best grade remains when a grade-improvement attempt is lower.
 * - From the second repeat of a failed course onward, the effective grade is capped at D.
 * - Degree progress uses earned credits, not attempted/GPA hours.
 * - Percentages require actual marks and are never inferred from GPA.
 */
export function calculateAcademicMetrics({
  previousGpa = "",
  previousCredits = "",
  previousGpaHours = previousCredits,
  previousEarnedCredits = "",
  previousPercentage = "",
  degreeCredits = 189,
  targetGpa = 3.6,
  gradingScale = DEFAULT_GRADE_SCALE,
  courses = []
} = {}) {
  const scaleId = GRADING_SCALES[gradingScale] ? gradingScale : DEFAULT_GRADE_SCALE;
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

  const validCourses = (Array.isArray(courses) ? courses : []).map(item => {
    const grade = normalizeGrade(item?.grade);
    const priorGrade = normalizeGrade(item?.priorGrade);
    const credits = parseNumber(item?.course?.credits);
    const mark = item?.mark === "" || item?.mark === null || item?.mark === undefined ? null : parseNumber(item.mark);
    const repeatNumber = Number(item?.repeatNumber) >= 2 ? 2 : 1;
    const effectiveGrade = priorGrade
      ? applyRepeatCap(grade, priorGrade, repeatNumber, scaleId)
      : grade;
    return { ...item, grade, priorGrade, repeatNumber, effectiveGrade, credits, mark };
  }).filter(item => item.course && item.credits !== null && Number.isFinite(item.credits) && item.credits > 0);

  const semesterGpaCourses = validCourses.filter(item => isGpaCountedGrade(item.effectiveGrade, scaleId));
  const semesterGpaHours = semesterGpaCourses.reduce((sum, item) => sum + item.credits, 0);
  const semesterPoints = semesterGpaCourses.reduce((sum, item) =>
    sum + (gradePointsFor(item.effectiveGrade, scaleId) ?? 0) * item.credits, 0);
  const semesterGpa = semesterGpaHours > 0 ? semesterPoints / semesterGpaHours : null;

  let cumulativePoints = previous.points;
  let cumulativeGpaHours = previous.gpaHours;
  let additionalEarnedHours = 0;
  let resolvedPreviousFailures = 0;
  let currentOutstandingFailureHours = 0;
  let hasRepeatedCourse = false;
  const repeatNotices = [];
  let repeatValid = true;
  const improvementCourses = validCourses.filter(item => {
    const priorPoints = gradePointsFor(item.priorGrade, scaleId);
    return Boolean(item.priorGrade) && priorPoints !== null && priorPoints > 0;
  });
  if (improvementCourses.length > 3) {
    repeatValid = false;
    repeatNotices.push("The 2023 regulations limit grade improvement to three courses.");
  }

  for (const item of validCourses) {
    const grade = item.effectiveGrade;
    if (item.priorGrade && item.repeatNumber >= 2 && ["F", "FW"].includes(item.priorGrade) && grade === "D") {
      repeatNotices.push(item.course.code + ": the second-or-later repeat is capped at D.");
    }
    const prior = item.priorGrade;
    const credit = item.credits;
    const newGpaCounted = isGpaCountedGrade(grade, scaleId);
    const newPoints = newGpaCounted ? (gradePointsFor(grade, scaleId) ?? 0) : 0;
    const newEarned = isEarnedGrade(grade, scaleId);
    if (!prior) {
      if (newGpaCounted) {
        cumulativePoints += newPoints * credit;
        cumulativeGpaHours += credit;
      }
      if (newEarned) additionalEarnedHours += credit;
      if (["F", "FW"].includes(grade)) currentOutstandingFailureHours += credit;
      continue;
    }

    hasRepeatedCourse = true;
    const oldGpaCounted = isGpaCountedGrade(prior, scaleId);
    const oldPoints = oldGpaCounted ? (gradePointsFor(prior, scaleId) ?? 0) : 0;
    const oldEarned = isEarnedGrade(prior, scaleId);
    const oldFailed = ["F", "FW"].includes(prior);
    const newFailed = ["F", "FW"].includes(grade);

    // A W, I or NC outcome on the retake cannot erase the earlier F/FW.
    if (oldFailed && !newGpaCounted && grade !== "P") {
      repeatNotices.push(item.course.code + ": the previous failure remains in CGPA because the retake has no final grade.");
      continue;
    }

    if (!oldFailed && item.repeatNumber >= 2) {
      repeatValid = false;
      repeatNotices.push(item.course.code + ": improvement of a passed course is allowed only once.");
      continue;
    }

    if (!oldFailed && oldEarned) {
      const oldPointValue = oldGpaCounted ? oldPoints : -Infinity;
      const newPointValue = newGpaCounted ? newPoints : -Infinity;
      if (newPointValue < oldPointValue) {
        repeatNotices.push(item.course.code + ": the new lower grade does not replace the previous higher grade in CGPA.");
        continue;
      }
    }

    if (oldGpaCounted && cumulativeGpaHours < credit) {
      repeatValid = false;
      repeatNotices.push(item.course.code + ": prior GPA hours are insufficient to replace this earlier counted attempt.");
      continue;
    }
    if (oldGpaCounted) {
      cumulativePoints -= oldPoints * credit;
      cumulativeGpaHours -= credit;
    }
    if (newGpaCounted) {
      cumulativePoints += newPoints * credit;
      cumulativeGpaHours += credit;
    }
    if (!oldEarned && newEarned) {
      additionalEarnedHours += credit;
      if (oldFailed) resolvedPreviousFailures += credit;
    }
    if (newFailed && !oldFailed) currentOutstandingFailureHours += credit;
  }

  const semesterEarnedHours = validCourses.reduce((sum, item) => {
    if (!isEarnedGrade(item.effectiveGrade, scaleId)) return sum;
    if (item.priorGrade && isEarnedGrade(item.priorGrade, scaleId)) return sum;
    return sum + item.credits;
  }, 0);

  const cumulativeEarnedHours = previous.earnedHours + additionalEarnedHours;
  const remainingDegreeCredits = Math.max(0, safeDegreeCredits - cumulativeEarnedHours);
  const progress = clamp((cumulativeEarnedHours / safeDegreeCredits) * 100, 0, 100);

  const currentMarksValid = semesterGpaCourses.every(item =>
    item.mark !== null && Number.isFinite(item.mark) && item.mark >= 0 && item.mark <= 100
  );
  const previousMarksValid = previous.gpaHours === 0 || previous.weightedPercentage !== null;
  const allMarksAvailable = !hasRepeatedCourse && currentMarksValid && previousMarksValid && cumulativeGpaHours > 0;
  const semesterWeightedPercentage = semesterGpaCourses.length > 0 && currentMarksValid
    ? semesterGpaCourses.reduce((sum, item) => sum + item.mark * item.credits, 0) / semesterGpaHours
    : null;
  const cumulativeWeightedPercentage = allMarksAvailable
    ? ((previous.weightedPercentage ?? 0) * previous.gpaHours +
      semesterGpaCourses.reduce((sum, item) => sum + item.mark * item.credits, 0)) / cumulativeGpaHours
    : null;

  // Estimate unresolved prior failures from attempted GPA hours minus earned hours.
  // This is exact for ordinary letter-graded transcripts; P-only programmes should
  // enter earned credits carefully because pass-only hours do not enter GPA hours.
  const previousOutstandingFailures = Math.max(0, previous.gpaHours - previous.earnedHours);
  const outstandingFailures = Math.max(0, previousOutstandingFailures - resolvedPreviousFailures) + currentOutstandingFailureHours;
  const futureGpaHours = Math.max(0, remainingDegreeCredits - outstandingFailures);
  const totalFutureGpaHours = cumulativeGpaHours + futureGpaHours;

  let requiredGpa = null;
  let targetMessage = "Enter your previous record to calculate the GPA you need.";
  let targetTone = "";
  if (!previous.valid) {
    targetMessage = "Check the previous GPA, GPA hours, earned credits and percentage values.";
    targetTone = "bad";
  } else if (!degreeValid || !targetValid) {
    targetMessage = "Check the degree credit requirement and target GPA values.";
    targetTone = "bad";
  } else if (!repeatValid) {
    targetMessage = repeatNotices[0] || "Check the repeated-course details.";
    targetTone = "bad";
  } else if (remainingDegreeCredits === 0) {
    const finalGpa = cumulativeGpaHours > 0 ? cumulativePoints / cumulativeGpaHours : null;
    if (finalGpa !== null && finalGpa >= safeTargetGpa) {
      requiredGpa = 0;
      targetMessage = "The required degree credits are complete and your target GPA has been achieved.";
      targetTone = "good";
    } else {
      targetMessage = "The required degree credits are complete, but the target GPA has not been reached.";
      targetTone = "bad";
    }
  } else if (futureGpaHours === 0) {
    targetMessage = "All remaining degree credits are tied to previously attempted failures. Review the retake plan before relying on a future-average estimate.";
    targetTone = "warning";
  } else {
    const needed = (safeTargetGpa * totalFutureGpaHours - cumulativePoints) / futureGpaHours;
    if (needed > 4 + 1e-10) {
      targetMessage = "This target is mathematically unattainable with a maximum future GPA of 4.00.";
      targetTone = "bad";
    } else {
      requiredGpa = clamp(needed, 0, 4);
      if (needed <= 0) {
        targetMessage = "Your current grade points provide enough margin; even a 0.00 future GPA would preserve the target.";
        targetTone = "good";
      } else if (cumulativeGpaHours > 0 && cumulativePoints / cumulativeGpaHours >= safeTargetGpa) {
        targetMessage = "You are currently above your target. Maintain at least this average over the remaining GPA-counted hours.";
        targetTone = "good";
      } else {
        targetMessage = "You need to average this GPA across future GPA-counted hours to reach your target.";
        targetTone = "warning";
      }
    }
  }

  return {
    previous, degreeValid, targetValid, repeatValid, repeatNotices, gradingScale: scaleId,
    degreeCredits: safeDegreeCredits, targetGpa: safeTargetGpa,
    courses: validCourses,
    gradedCourses: validCourses.filter(item => item.grade),
    gpaCourses: semesterGpaCourses,
    semesterGpaHours, semesterCredits: semesterGpaHours, semesterPoints, semesterGpa,
    semesterEarnedHours, cumulativeGpaHours, cumulativeCredits: cumulativeGpaHours,
    cumulativePoints, cumulativeGpa: cumulativeGpaHours > 0 ? cumulativePoints / cumulativeGpaHours : null,
    cumulativeEarnedHours, remainingDegreeCredits, remainingCredits: remainingDegreeCredits,
    selectedCredits: validCourses.reduce((sum, item) => sum + item.credits, 0),
    progress, semesterWeightedPercentage, cumulativeWeightedPercentage,
    percentage: cumulativeWeightedPercentage, requiredGpa, targetMessage, targetTone,
    outstandingFailures, futureGpaHours
  };
}
