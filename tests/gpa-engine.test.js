import test from "node:test";
import assert from "node:assert/strict";
import {
  GRADE_POINTS, GRADING_SCALES, calculateAcademicMetrics, gradeFromGpa, gradeFromMark, gradePointsFor, isValidGrade, normalizeGrade
} from "../gpa-engine.js";
import { courseCatalog, ELECTIVE_COURSE_LIMIT } from "../courses.js";

const course = (credits, grade, mark = null) => ({ course: { credits }, grade, mark });
const closeTo = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) < epsilon, String(actual) + " != " + String(expected));

test("matches all official letter-grade point values", () => {
  assert.deepEqual(GRADE_POINTS, {"A+":4,A:3.8,"A-":3.6,"B+":3.3,B:3,"C+":2.7,C:2.4,D:2,F:0});
});

test("calculates credit-weighted semester GPA", () => {
  const r = calculateAcademicMetrics({courses:[course(3,"A+"),course(2,"B")]});
  assert.equal(r.semesterGpaHours,5); assert.equal(r.semesterPoints,18); assert.equal(r.semesterEarnedHours,5); closeTo(r.semesterGpa,3.6);
});

test("F contributes zero points and remains in the GPA denominator, but is not earned credit", () => {
  const r = calculateAcademicMetrics({courses:[course(3,"A"),course(2,"F")]});
  assert.equal(r.semesterGpaHours,5); assert.equal(r.semesterEarnedHours,3); closeTo(r.semesterGpa,2.28);
});

test("P is earned credit but does not affect GPA", () => {
  const r = calculateAcademicMetrics({courses:[course(3,"A"),course(2,"P")]});
  assert.equal(r.semesterGpaHours,3); assert.equal(r.semesterEarnedHours,5); closeTo(r.semesterGpa,3.8);
});

test("I, NC and W are excluded from GPA and earned credits", () => {
  for (const grade of ["I","NC","W"]) {
    const r = calculateAcademicMetrics({courses:[course(3,"A"),course(2,grade)]});
    assert.equal(r.semesterGpaHours,3,grade); assert.equal(r.semesterEarnedHours,3,grade); closeTo(r.semesterGpa,3.8);
  }
});

test("legacy CN notation is normalized to NC, not treated as a zero grade", () => {
  assert.equal(normalizeGrade("CN"),"NC"); assert.equal(isValidGrade("CN"),true);
  const r = calculateAcademicMetrics({courses:[course(2,"CN")]});
  assert.equal(r.semesterGpaHours,0); assert.equal(r.semesterEarnedHours,0);
});

test("combines previous GPA-hours and new GPA-hours without confusing earned hours", () => {
  const r = calculateAcademicMetrics({previousGpa:"3.20",previousGpaHours:"60",previousEarnedCredits:"57",courses:[course(3,"A+"),course(2,"F")]});
  assert.equal(r.cumulativeGpaHours,65); assert.equal(r.cumulativeEarnedHours,60); closeTo(r.cumulativeGpa,(192+12)/65);
});

test("legacy previous-credit field remains a fallback for GPA-hours and earned-hours", () => {
  const r = calculateAcademicMetrics({previousGpa:"3.25",previousCredits:"68"});
  assert.equal(r.previous.gpaHours,68); assert.equal(r.previous.earnedHours,68); assert.equal(r.previous.usedEarnedHoursFallback,true);
});

test("future required GPA accounts for earned remaining hours and existing GPA-hours", () => {
  const r = calculateAcademicMetrics({previousGpa:"3.00",previousGpaHours:"30",previousEarnedCredits:"27",degreeCredits:"90",targetGpa:"3.50"});
  assert.equal(r.remainingDegreeCredits,63);
  closeTo(r.requiredGpa,(3.5*(30+60)-90)/63);
});

test("required future GPA is not incorrectly set to zero merely because current GPA meets target", () => {
  const r = calculateAcademicMetrics({previousGpa:"4.00",previousGpaHours:"30",previousEarnedCredits:"30",degreeCredits:"90",targetGpa:"3.50"});
  closeTo(r.requiredGpa,(3.5*90-120)/60);
  assert.ok(r.requiredGpa>0 && r.requiredGpa<3.5);
});

test("detects an unattainable target above the remaining 4.00 ceiling", () => {
  const r = calculateAcademicMetrics({previousGpa:"2.00",previousGpaHours:"80",previousEarnedCredits:"80",degreeCredits:"100",targetGpa:"3.90"});
  assert.equal(r.requiredGpa,null); assert.equal(r.targetTone,"bad"); assert.match(r.targetMessage,/unattainable/i);
});

test("returns zero required GPA when existing points are sufficient even with zero future GPA", () => {
  const r = calculateAcademicMetrics({previousGpa:"4.00",previousGpaHours:"80",previousEarnedCredits:"80",degreeCredits:"100",targetGpa:"3.10"});
  assert.equal(r.requiredGpa,0); assert.equal(r.targetTone,"good");
});

test("degree progress uses earned credits, not failed or withdrawn attempted credits", () => {
  const r = calculateAcademicMetrics({degreeCredits:100,courses:[course(30,"F"),course(20,"W"),course(10,"P"),course(15,"B")]});
  assert.equal(r.cumulativeEarnedHours,25); assert.equal(r.remainingDegreeCredits,75); assert.equal(r.progress,25);
});

test("supports P-only credits with no GPA hours", () => {
  const r = calculateAcademicMetrics({degreeCredits:10,courses:[course(4,"P")]});
  assert.equal(r.cumulativeGpa,null); assert.equal(r.cumulativeGpaHours,0); assert.equal(r.cumulativeEarnedHours,4); closeTo(r.requiredGpa,3.6);
});

test("validates paired prior GPA and hours and all numeric bounds", () => {
  assert.equal(calculateAcademicMetrics({previousGpa:"3.2",previousGpaHours:""}).previous.valid,false);
  assert.equal(calculateAcademicMetrics({previousGpa:"",previousGpaHours:"10"}).previous.valid,false);
  assert.equal(calculateAcademicMetrics({previousGpa:"3.2",previousGpaHours:"10.5"}).previous.valid,false);
  assert.equal(calculateAcademicMetrics({previousGpa:"4.2",previousGpaHours:"10"}).previous.valid,false);
  assert.equal(calculateAcademicMetrics({previousGpa:"3.2",previousGpaHours:"10",previousEarnedCredits:"11"}).previous.valid,true);
  assert.equal(calculateAcademicMetrics({previousGpa:"3.2",previousGpaHours:"10",previousPercentage:"101"}).previous.valid,false);
  assert.equal(calculateAcademicMetrics({degreeCredits:"0",targetGpa:"4.5"}).degreeValid,false);
});

test("does not invent a percentage from GPA grade points alone", () => {
  const r = calculateAcademicMetrics({previousGpa:"3.7",previousGpaHours:"30",previousEarnedCredits:"30",courses:[course(3,"A-")]});
  assert.equal(r.cumulativeWeightedPercentage,null); assert.equal(r.percentage,null);
});

test("calculates actual weighted percentages only when all GPA hours have marks", () => {
  const r = calculateAcademicMetrics({previousGpa:"3.2",previousGpaHours:"10",previousEarnedCredits:"10",previousPercentage:"80",courses:[course(3,"A",92),course(2,"B",78)]});
  closeTo(r.semesterWeightedPercentage,(92*3+78*2)/5);
  closeTo(r.cumulativeWeightedPercentage,(80*10+92*3+78*2)/15);
});

test("withholds weighted percentage if any GPA-bearing course has no actual mark", () => {
  const r = calculateAcademicMetrics({courses:[course(3,"A",92),course(2,"B")]});
  assert.equal(r.semesterWeightedPercentage,null); assert.equal(r.cumulativeWeightedPercentage,null);
});

test("maps raw marks to official grade bands, including every boundary", () => {
  const cases=[[95,"A+"],[94.99,"A"],[90,"A"],[89.99,"A-"],[85,"A-"],[84.99,"B+"],[80,"B+"],[79.99,"B"],[75,"B"],[74.99,"C+"],[70,"C+"],[69.99,"C"],[65,"C"],[64.99,"D"],[60,"D"],[59.99,"F"],[0,"F"]];
  for (const [mark,grade] of cases) assert.equal(gradeFromMark(mark),grade,"mark " + mark);
  assert.equal(gradeFromMark(100.1),""); assert.equal(gradeFromMark(""),"");
});

test("keeps overall grade labels aligned with the GPA key", () => {
  assert.equal(gradeFromGpa(4),"A+"); assert.equal(gradeFromGpa(3.8),"A"); assert.equal(gradeFromGpa(3.6),"A−"); assert.equal(gradeFromGpa(3.59),"B+"); assert.equal(gradeFromGpa(Number.NaN),"N/A");
});

test("study-plan mandatory courses total exactly 189 credits after corrections", () => {
  const optionalAlternatives = new Set(["SSG E01", "SSG E03", "BAD E01"]);
  const requiredPlanHours = courseCatalog
    .filter(item => !optionalAlternatives.has(item.code))
    .reduce((sum, item) => sum + item.credits, 0);
  assert.equal(requiredPlanHours, 189);
  assert.equal(ELECTIVE_COURSE_LIMIT, 2);
  assert.equal(courseCatalog.filter(item => item.elective).length, 5);
});

test("Level 4 medical and surgical courses match the official 3-credit values", () => {
  const expected = ["DEM 4108","DED 4101","DED 4102","DEM 4109","DEM 4208","DED 4201","DED 4202","DEM 4209"];
  for (const code of expected) {
    const item = courseCatalog.find(course => course.code === code);
    assert.ok(item, "missing course " + code);
    assert.equal(item.credits, 3, code);
  }
});

test("course catalogue contains no duplicate course codes after normalization", () => {
  const codes = courseCatalog.map(item => item.code);
  assert.equal(new Set(codes).size, codes.length);
});


test("supports the different point values in the published 2023 regulation", () => {
  assert.equal(GRADING_SCALES.university2023.gradePoints.A,4.0);
  assert.equal(GRADING_SCALES.university2023.gradePoints["A-"],3.7);
  assert.equal(GRADING_SCALES.university2023.gradePoints["B-"],2.7);
  assert.equal(gradeFromMark(89,"university2023"),"A-");
  assert.equal(gradeFromMark(74,"university2023"),"B-");
  assert.equal(gradeFromMark(70,"university2023"),"C+");
  assert.equal(gradeFromMark(67.5,"university2023"),"C");
  assert.equal(gradeFromMark(65,"university2023"),"C-");
  assert.equal(gradeFromMark(64.9,"university2023"),"D+");
  assert.equal(gradeFromGpa(3.7,"university2023"),"A-");
  assert.equal(isValidGrade("A+","university2023"),false);
  assert.equal(gradePointsFor("A+","uploadedKey"),4.0);
});

test("FW is a zero-point failed attempt counted in GPA hours, unlike ordinary W", () => {
  const forced = calculateAcademicMetrics({courses:[course(3,"A"),course(2,"FW")]});
  assert.equal(forced.semesterGpaHours,5);
  assert.equal(forced.semesterEarnedHours,3);
  closeTo(forced.semesterGpa,2.28);
  const ordinary = calculateAcademicMetrics({courses:[course(3,"A"),course(2,"W")]});
  assert.equal(ordinary.semesterGpaHours,3);
  assert.equal(ordinary.semesterEarnedHours,3);
  closeTo(ordinary.semesterGpa,4.0);
});

test("repeating a previously failed course replaces the old CGPA contribution without adding another GPA hour", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00", previousGpaHours:"30", previousEarnedCredits:"27",
    degreeCredits:40, targetGpa:3.0,
    courses:[{course:{code:"DER 4101",credits:3},priorGrade:"F",repeatNumber:1,grade:"A+"}]
  });
  assert.equal(r.cumulativeGpaHours,30);
  assert.equal(r.cumulativeEarnedHours,30);
  closeTo(r.cumulativeGpa,3.4);
  closeTo(r.semesterGpa,4.0);
  assert.equal(r.outstandingFailures,0);
});

test("a better grade-improvement attempt replaces the old grade, not its credit-hour denominator", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00", previousGpaHours:"30", previousEarnedCredits:"30",
    courses:[{course:{code:"DES 1101",credits:3},priorGrade:"B",repeatNumber:1,grade:"A+"}]
  });
  assert.equal(r.cumulativeGpaHours,30);
  closeTo(r.cumulativeGpa,3.1);
  assert.equal(r.cumulativeEarnedHours,30);
});

test("a lower grade-improvement attempt leaves the earlier higher CGPA grade in place", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00", previousGpaHours:"30", previousEarnedCredits:"30",
    courses:[{course:{code:"DES 1101",credits:3},priorGrade:"A",repeatNumber:1,grade:"B"}]
  });
  assert.equal(r.cumulativeGpaHours,30);
  closeTo(r.cumulativeGpa,3.0);
  closeTo(r.semesterGpa,3.0);
  assert.ok(r.repeatNotices.some(x=>x.includes("lower grade")));
});

test("second-or-later repeat of a failed course is capped at D", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00", previousGpaHours:"30", previousEarnedCredits:"27",
    courses:[{course:{code:"DER 4101",credits:3},priorGrade:"F",repeatNumber:2,grade:"A+"}]
  });
  assert.equal(r.courses[0].effectiveGrade,"D");
  closeTo(r.semesterGpa,2.0);
  closeTo(r.cumulativeGpa,3.2);
  assert.ok(r.repeatNotices.some(x=>x.includes("capped at D")));
});

test("a W, I or NC retake result does not erase an earlier F/FW", () => {
  for (const grade of ["W","I","NC"]) {
    const r = calculateAcademicMetrics({
      previousGpa:"3.00", previousGpaHours:"30", previousEarnedCredits:"27",
      courses:[{course:{code:"DER 4101",credits:3},priorGrade:"F",repeatNumber:1,grade}]
    });
    assert.equal(r.cumulativeGpaHours,30,grade);
    closeTo(r.cumulativeGpa,3.0);
    assert.ok(r.repeatNotices.length>0);
  }
});

test("a second improvement attempt on an already passed course is invalid", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00", previousGpaHours:"30", previousEarnedCredits:"30",
    courses:[{course:{code:"DES 1101",credits:3},priorGrade:"B",repeatNumber:2,grade:"A+"}]
  });
  assert.equal(r.repeatValid,false);
  assert.equal(r.targetTone,"bad");
});

test("more than three passed-course improvement attempts are rejected", () => {
  const courses = [1,2,3,4].map(i => ({
    course:{code:"COURSE "+i,credits:2},priorGrade:"B",repeatNumber:1,grade:"A"
  }));
  const r = calculateAcademicMetrics({previousGpa:"3.0",previousGpaHours:"20",previousEarnedCredits:"20",courses});
  assert.equal(r.repeatValid,false);
  assert.ok(r.repeatNotices.some(x=>x.includes("three courses")));
});

test("future target average does not double-count already-attempted failed hours", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00",previousGpaHours:"30",previousEarnedCredits:"27",
    degreeCredits:40,targetGpa:3.0
  });
  assert.equal(r.remainingDegreeCredits,13);
  assert.equal(r.outstandingFailures,3);
  assert.equal(r.futureGpaHours,10);
  closeTo(r.requiredGpa,(3*40-90)/13);
});

test("an ongoing retake of an earlier failure does not create another outstanding failed hour", () => {
  const r = calculateAcademicMetrics({
    previousGpa:"3.00",previousGpaHours:"30",previousEarnedCredits:"27",
    degreeCredits:40,
    courses:[{course:{code:"DER 4101",credits:3},priorGrade:"F",repeatNumber:1,grade:"F"}]
  });
  assert.equal(r.outstandingFailures,3);
  assert.equal(r.cumulativeGpaHours,30);
  assert.equal(r.cumulativeEarnedHours,27);
});
