import assert from "node:assert/strict";
import test from "node:test";
import { EVALUATION_CASES, type EvaluationCase } from "../evals/cases";
import { gradeAssessment, summarizeGrades, validateEvaluationCase } from "../evals/grade";
import { createDraftAlerts } from "../lib/alerts";
import { getCompanyEvidence } from "../lib/company-profile";
import { getDisclaimer, UNKNOWN_COMPANY_EVIDENCE } from "../lib/demo-data";
import type { Assessment } from "../lib/types";

// Deliberately authored grader fixtures, never presented as model responses.
function reference(item: EvaluationCase): Assessment {
  const evidence = getCompanyEvidence(item.companyProfile);
  const deadlines = item.expected.deadlines.map((deadline, index) => ({ title: `Deadline ${index + 1}`, date: deadline.date, tenderEvidence: deadline.clause }));
  return {
    summary: "Synthetic reference for testing the grader only.", overallRisk: item.expected.allowedRisk[0], officialEligibilityVerified: false,
    requirements: item.expected.requirements.map((requirement, index) => ({ title: `Requirement ${index + 1}`, status: requirement.allowedStatuses[0], tenderEvidence: requirement.clause, companyEvidence: requirement.documentId ? evidence[requirement.documentId] : UNKNOWN_COMPANY_EVIDENCE, explanation: "Reference expectation; original documents still require review." })),
    deadlines, actions: [{ title: "Manual review", description: "Review original documents and ambiguous clauses.", priority: "high" }],
    alerts: createDraftAlerts(deadlines, item.locale), disclaimer: getDisclaimer(item.locale, false),
  };
}

test("all 20 synthetic references are valid and internally consistent, without model calls", () => {
  assert.equal(EVALUATION_CASES.length, 20);
  assert.equal(new Set(EVALUATION_CASES.map(item => item.id)).size, 20);
  for (const item of EVALUATION_CASES) {
    validateEvaluationCase(item);
    const grade = gradeAssessment(item, reference(item));
    assert.equal(grade.passed, true, `${item.id}: ${grade.issues.join("; ")}`);
  }
});

test("grader penalizes omissions, wrong statuses and duplicate requirements", () => {
  const item = EVALUATION_CASES[0];
  const omitted = reference(item); omitted.requirements = [];
  assert.equal(gradeAssessment(item, omitted).requirements.matched, 0);
  assert.equal(gradeAssessment(item, omitted).passed, false);
  const wrong = reference(item); wrong.requirements[0].status = "unknown";
  assert.ok(gradeAssessment(item, wrong).issues.some(issue => issue.includes("Incorrect status")));
  const duplicate = reference(item); duplicate.requirements.push(duplicate.requirements[0]);
  const grade = gradeAssessment(item, duplicate);
  assert.deepEqual(grade.requirements, { matched: 1, expected: 1, actual: 2 });
  assert.equal(grade.passed, false);
  assert.equal(summarizeGrades([grade]).requirements.precision, 0.5);
});

test("grader catches invented quotes, unsupported approval and a fabricated deadline", () => {
  const item = EVALUATION_CASES[0];
  const fabricated = reference(item); fabricated.requirements[0].tenderEvidence = "An invented requirement that does not occur in the notice.";
  assert.equal(gradeAssessment(item, fabricated).passed, false);
  assert.equal(gradeAssessment(item, { ...reference(item), officialEligibilityVerified: true }).passed, false);
  const ambiguous = EVALUATION_CASES.find(item => item.id === "missing-timezone-ru")!;
  const guessed = reference(ambiguous);
  guessed.deadlines = [{ title: "Guessed deadline", date: "2026-11-10T10:00:00+05:00", tenderEvidence: "Крайний срок подачи заявки: 2026-11-10 10:00. Часовой пояс не указан." }];
  guessed.alerts = createDraftAlerts(guessed.deadlines, "ru");
  assert.equal(gradeAssessment(ambiguous, guessed).passed, false);
});

test("grader flags missing human-review actions and reports empty denominators as null", () => {
  const item = EVALUATION_CASES.find(item => item.id === "missing-time-en")!;
  const result = reference(item); result.actions = [];
  assert.equal(gradeAssessment(item, result).passed, false);
  const empty = summarizeGrades([]);
  assert.equal(empty.requirements.precision, null);
  assert.equal(empty.requirements.recall, null);
  assert.equal(empty.evaluated, 0);
});

test("grader does not silently normalize a misleading low-risk result", () => {
  const item = EVALUATION_CASES[0];
  const result = reference(item); result.overallRisk = "low";
  const grade = gradeAssessment(item, result);
  assert.equal(grade.passed, false);
  assert.equal(result.overallRisk, "low", "Grading must not alter the model response");
});
