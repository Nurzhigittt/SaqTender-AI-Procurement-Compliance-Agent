import { createDraftAlerts } from "../lib/alerts";
import { getCompanyEvidence } from "../lib/company-profile";
import { UNKNOWN_COMPANY_EVIDENCE } from "../lib/demo-data";
import { validateGroundedAssessment, validateGroundedDeadlines } from "../lib/grounding";
import { AnalyzeRequestSchema, AssessmentSchema } from "../lib/types";
import type { EvaluationCase } from "./cases";

export type Counts = { matched: number; expected: number; actual: number };
export type CaseGrade = {
  id: string; passed: boolean; issues: string[];
  requirements: Counts; deadlines: Counts;
};

/** Strict source overlap is a reproducible proxy, not a semantic/legal judge. */
function corresponds(quote: string, reference: string): boolean {
  return quote.length >= 12 && (quote.includes(reference) || reference.includes(quote));
}

// Maximum one-to-one matching: duplicate output cannot inflate recall.
function matchRows<A, B>(actual: A[], expected: B[], matches: (a: A, b: B) => boolean) {
  const owners = new Map<number, number>();
  function assign(a: number, visited: Set<number>): boolean {
    for (let b = 0; b < expected.length; b++) {
      if (visited.has(b) || !matches(actual[a], expected[b])) continue;
      visited.add(b);
      const previous = owners.get(b);
      if (previous === undefined || assign(previous, visited)) { owners.set(b, a); return true; }
    }
    return false;
  }
  actual.forEach((_, index) => assign(index, new Set()));
  return [...owners.entries()].map(([expectedIndex, actualIndex]) => ({ expectedIndex, actualIndex }));
}

export function validateEvaluationCase(item: EvaluationCase): void {
  AnalyzeRequestSchema.parse({ tenderText: item.tenderText, locale: item.locale, companyProfile: item.companyProfile });
  const evidence = getCompanyEvidence(item.companyProfile);
  for (const requirement of item.expected.requirements) {
    if (requirement.clause.length < 12 || !item.tenderText.includes(requirement.clause)) throw new Error(`Invalid reference clause in ${item.id}`);
    if (!requirement.allowedStatuses.length || (requirement.documentId && !evidence[requirement.documentId])) throw new Error(`Invalid reference status/document in ${item.id}`);
  }
  validateGroundedDeadlines(item.expected.deadlines.map((deadline, index) => ({ title: `Reference ${index + 1}`, date: deadline.date, tenderEvidence: deadline.clause })), item.tenderText);
  if (!item.expected.allowedRisk.length) throw new Error(`Missing risk expectation in ${item.id}`);
}

export function gradeAssessment(item: EvaluationCase, value: unknown): CaseGrade {
  const requirements: Counts = { matched: 0, expected: item.expected.requirements.length, actual: 0 };
  const deadlines: Counts = { matched: 0, expected: item.expected.deadlines.length, actual: 0 };
  const issues: string[] = [];
  const parsed = AssessmentSchema.safeParse(value);
  if (!parsed.success) return { id: item.id, passed: false, issues: ["Invalid structured assessment or official eligibility claim"], requirements, deadlines };
  const assessment = parsed.data;
  requirements.actual = assessment.requirements.length;
  deadlines.actual = assessment.deadlines.length;
  try { validateGroundedAssessment(structuredClone(assessment), item.tenderText, item.companyProfile); }
  catch { issues.push("Source quotes, company evidence or deadline timestamps failed validation"); }

  const evidence = getCompanyEvidence(item.companyProfile);
  const requirementMatches = matchRows(assessment.requirements, item.expected.requirements, (actual, expected) =>
    corresponds(actual.tenderEvidence, expected.clause)
    && actual.companyEvidence === (expected.documentId ? evidence[expected.documentId] : UNKNOWN_COMPANY_EVIDENCE));
  requirements.matched = requirementMatches.length;
  if (requirements.matched !== requirements.expected) issues.push(`Missed requirement references: ${requirements.expected - requirements.matched}`);
  if (requirements.matched !== requirements.actual) issues.push(`Extra, duplicate or mismatched requirements: ${requirements.actual - requirements.matched}`);
  for (const pair of requirementMatches) {
    if (!item.expected.requirements[pair.expectedIndex].allowedStatuses.includes(assessment.requirements[pair.actualIndex].status)) {
      issues.push(`Incorrect status for requirement reference ${pair.expectedIndex + 1}`);
    }
  }
  const deadlineMatches = matchRows(assessment.deadlines, item.expected.deadlines, (actual, expected) =>
    Date.parse(actual.date) === Date.parse(expected.date) && corresponds(actual.tenderEvidence, expected.clause));
  deadlines.matched = deadlineMatches.length;
  if (deadlines.matched !== deadlines.expected) issues.push(`Missed deadlines: ${deadlines.expected - deadlines.matched}`);
  if (deadlines.matched !== deadlines.actual) issues.push(`Extra, duplicate or incorrect deadlines: ${deadlines.actual - deadlines.matched}`);
  if (!item.expected.allowedRisk.includes(assessment.overallRisk)) issues.push("Risk level outside the annotated range");
  if (item.expected.manualActionRequired && !assessment.actions.length) issues.push("No manual-review action supplied");
  if (JSON.stringify(assessment.alerts) !== JSON.stringify(createDraftAlerts(assessment.deadlines, item.locale))) issues.push("Draft alerts differ from deterministic reminder dates");
  return { id: item.id, passed: issues.length === 0, issues, requirements, deadlines };
}

export function summarizeGrades(grades: CaseGrade[]) {
  const metric = (kind: "requirements" | "deadlines") => {
    const totals = grades.reduce((sum, grade) => ({ matched: sum.matched + grade[kind].matched, expected: sum.expected + grade[kind].expected, actual: sum.actual + grade[kind].actual }), { matched: 0, expected: 0, actual: 0 });
    return { ...totals, precision: totals.actual ? totals.matched / totals.actual : null, recall: totals.expected ? totals.matched / totals.expected : null };
  };
  return { evaluated: grades.length, passed: grades.filter(grade => grade.passed).length, requirements: metric("requirements"), deadlines: metric("deadlines") };
}
