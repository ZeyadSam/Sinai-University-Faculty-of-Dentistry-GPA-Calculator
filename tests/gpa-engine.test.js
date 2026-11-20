import test from "node:test";
import assert from "node:assert/strict";
import {
  GRADE_POINTS,
  calculateAcademicMetrics,
  gradeFromGpa,
  gpaToPercentage
} from "../gpa-engine.js";

const course = (credits, grade) => ({ course: { credits }, grade });

test("calculates semester GPA as a credit-weighted average", () => {
  const result = calculateAcademicMetrics({
    courses: [course(3, "A+"), course(2, "B")]
  });
  assert.equal(result.semesterCredits, 5);
  assert.equal(result.semesterPoints, 18);
  assert.equal(result.semesterGpa, 3.6);
});

test("combines previous GPA points with current semester points", () => {
  const result = calculateAcademicMetrics({
    previousGpa: "3.20",
    previousCredits: "60",
    courses: [course(3, "A+")]
  });
  assert.equal(result.cumulativeCredits, 63);
  assert.ok(Math.abs(result.cumulativeGpa - (204 / 63)) < 1e-12);
});

test("excludes ungraded courses from GPA while retaining selected credits", () => {
  const result = calculateAcademicMetrics({
    courses: [course(3, "A"), course(2, "")]
  });
  assert.equal(result.selectedCredits, 5);
  assert.equal(result.semesterCredits, 3);
  assert.ok(Math.abs(result.semesterGpa - 3.8) < 1e-12);
});

test("retains the established zero-point handling for special grades", () => {
  assert.equal(GRADE_POINTS.W, 0);
  assert.equal(GRADE_POINTS.I, 0);
  assert.equal(GRADE_POINTS.CN, 0);
  const result = calculateAcademicMetrics({ courses: [course(2, "A"), course(1, "W")] });
  assert.equal(result.semesterCredits, 3);
  assert.ok(Math.abs(result.semesterGpa - (7.6 / 3)) < 1e-12);
});

test("calculates the average needed over remaining degree credits", () => {
  const result = calculateAcademicMetrics({
    previousGpa: "3.00",
    previousCredits: "30",
    degreeCredits: "90",
    targetGpa: "3.50"
  });
  assert.equal(result.remainingCredits, 60);
  assert.equal(result.requiredGpa, 3.75);
});

test("detects an unattainable target above the remaining 4.00 ceiling", () => {
  const result = calculateAcademicMetrics({
    previousGpa: "2.00",
    previousCredits: "80",
    degreeCredits: "100",
    targetGpa: "3.90"
  });
  assert.equal(result.requiredGpa, null);
  assert.equal(result.targetTone, "bad");
  assert.match(result.targetMessage, /no longer attainable/i);
});

test("rejects incomplete previous academic records and invalid settings", () => {
  const partial = calculateAcademicMetrics({ previousGpa: "3.2", previousCredits: "" });
  assert.equal(partial.previous.valid, false);
  assert.equal(partial.previous.creditsValid, false);

  const invalid = calculateAcademicMetrics({ degreeCredits: "0", targetGpa: "4.5" });
  assert.equal(invalid.degreeValid, false);
  assert.equal(invalid.targetValid, false);
});

test("treats a completely empty previous record as a valid first-semester record", () => {
  const result = calculateAcademicMetrics({ courses: [course(2, "B+")] });
  assert.equal(result.previous.valid, true);
  assert.equal(result.cumulativeGpa, 3.3);
  assert.equal(result.percentage, 80);
});

test("returns safe GPA percentage and letter-grade boundaries", () => {
  assert.equal(gpaToPercentage(4), 95);
  assert.equal(gpaToPercentage(3.8), 90);
  assert.equal(gpaToPercentage(3.6), 85);
  assert.equal(gpaToPercentage(0), 0);
  assert.equal(gradeFromGpa(3.8), "A");
  assert.equal(gradeFromGpa(3.59), "B+");
  assert.equal(gradeFromGpa(Number.NaN), "N/A");
});
