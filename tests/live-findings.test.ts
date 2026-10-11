import assert from "node:assert/strict";
import test from "node:test";
import { getCompanyEvidence } from "../lib/company-profile";
import { DEMO_COMPANY, getDisclaimer, UNKNOWN_COMPANY_EVIDENCE } from "../lib/demo-data";
import { buildLiveAssessment, LiveFindingsSchema, type LiveFindings } from "../lib/live-findings";
import { validateGroundedAssessment } from "../lib/grounding";
import { createReportHtml, escapeReportHtml } from "../lib/report-export";
import { AssessmentSchema } from "../lib/types";

const source = "The bidder must provide work experience confirmation.";
const evidence = getCompanyEvidence(DEMO_COMPANY);
function requirement(changes: Partial<LiveFindings["requirements"][number]> = {}): LiveFindings["requirements"][number] {
  return {
    title: "Work experience",
    tenderEvidence: source,
    companyEvidence: evidence["work-experience"],
    status: "missing",
    explanation: "The relevant record is marked missing.",
    clauseState: "unambiguous",
    conflictingEvidence: null,
    ...changes,
  };
}
function findings(changes: Partial<LiveFindings> = {}): LiveFindings {
  return { requirements: [], deadlines: [], unresolvedDeadlines: [], ...changes };
}

test("date clarification does not recommend unrelated missing documents or claim they are active", () => {
  const profile = structuredClone(DEMO_COMPANY);
  profile.documents.forEach(document => { document.status = "missing"; });
  const quote = "Крайний срок подачи заявки: 2026-11-10 10:00. Часовой пояс не указан.";
  const result = buildLiveAssessment(findings({ unresolvedDeadlines: [{ tenderEvidence: quote, reason: "missing_timezone" }] }), quote, profile, "ru");
  assert.equal(result.overallRisk, "unknown");
  assert.deepEqual(result.requirements, []);
  assert.deepEqual(result.deadlines, []);
  assert.deepEqual(result.alerts, []);
  assert.equal(result.actions.length, 1);
  assert.match(result.actions[0].title, /часовой пояс/);
  assert.ok(result.actions[0].description.includes(quote));
  assert.doesNotMatch(JSON.stringify(result), /Work Experience|Construction License|Manufacturer Registry|активны/);
  assert.equal(result.officialEligibilityVerified, false);
});

test("model-authored summary, actions, risk and disclaimers cannot enter the findings contract", () => {
  for (const extra of [{ summary: "All documents are active" }, { actions: [] }, { overallRisk: "low" }, { disclaimer: "Officially approved" }]) {
    assert.equal(LiveFindingsSchema.safeParse({ ...findings(), ...extra }).success, false);
  }
});

test("classified conflicts retain both exact clauses despite distance or source order and become unknown", () => {
  const first = "Раздел А: подтверждение опыта работ обязательно.";
  const second = "Раздел Б: подтверждение опыта работ не требуется.";
  for (const text of [`${first}\nМесто поставки — склад заказчика.\n${second}`, `${second}\nКонтактные сведения приведены отдельно.\n${first}`]) {
    const result = buildLiveAssessment(findings({ requirements: [requirement({
      tenderEvidence: first, conflictingEvidence: second, clauseState: "conflicting",
      status: "met", title: "All requirements satisfied", explanation: "No action required.",
    })] }), text, DEMO_COMPANY, "ru");
    assert.equal(result.requirements[0].status, "unknown");
    assert.equal(result.requirements[0].companyEvidence, evidence["work-experience"]);
    assert.ok(result.requirements[0].explanation.includes(first));
    assert.ok(result.requirements[0].explanation.includes(second));
    assert.equal(result.requirements[0].conflictingEvidence, second);
    assert.equal(result.overallRisk, "unknown");
    assert.equal(result.actions.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /All requirements satisfied|No action required/);
  }
});

test("conflict classification cannot bypass source, distinctness or company evidence validation", () => {
  const opposite = "Work experience confirmation is not required.";
  const text = `${source}\n${opposite}`;
  const base = requirement({ clauseState: "conflicting", conflictingEvidence: opposite });
  for (const bad of [
    { ...base, conflictingEvidence: null },
    { ...base, conflictingEvidence: "The invented amendment cancels this requirement." },
    { ...base, conflictingEvidence: source },
    { ...base, conflictingEvidence: " " },
    { ...base, tenderEvidence: "Invented original clause." },
    { ...base, companyEvidence: "Work Experience Confirmation: Active." },
    { ...base, clauseState: "unambiguous" },
  ]) {
    assert.throws(() => buildLiveAssessment(findings({ requirements: [bad as LiveFindings["requirements"][number]] }), text, DEMO_COMPANY, "en"));
  }
});

test("ordinary unsupported positive claims still fail instead of being silently downgraded", () => {
  assert.throws(() => buildLiveAssessment(findings({ requirements: [requirement({ status: "met" })] }), source, DEMO_COMPANY, "en"), /Unsupported document-compliance claim/);
  assert.throws(() => buildLiveAssessment(findings({ requirements: [requirement({ status: "at_risk", companyEvidence: UNKNOWN_COMPANY_EVIDENCE })] }), source, DEMO_COMPANY, "en"), /Unsupported document risk/);
});

test("an unresolved conditional requirement cannot turn a missing profile record into a high-risk claim", () => {
  const quote = "Only category X bidders must provide work experience confirmation. The bidder category is unknown.";
  const result = buildLiveAssessment(findings({ requirements: [requirement({
    clauseState: "conditional", tenderEvidence: quote, status: "missing",
  })] }), quote, DEMO_COMPANY, "en");
  assert.equal(result.requirements[0].status, "unknown");
  assert.equal(result.requirements[0].companyEvidence, evidence["work-experience"]);
  assert.equal(result.overallRisk, "unknown");
  assert.equal(result.actions[0].priority, "medium");
  assert.match(result.actions[0].description, /applicability/);
});

test("server does not invent document findings when the extractor omits exemptions or explicitly cancelled requirements", () => {
  for (const quote of [
    "Work experience confirmation is not required.",
    `${source}\nAmendment 1 cancels the work experience requirement above; no work experience evidence is required.`,
  ]) {
    const result = buildLiveAssessment(findings(), quote, DEMO_COMPANY, "en");
    assert.deepEqual(result.requirements, []);
    assert.deepEqual(result.actions, []);
    assert.equal(result.overallRisk, "unknown");
  }
});

test("fully specified deadlines cannot be hidden in unresolved findings, even with duplicate equivalent timestamps", () => {
  for (const quote of [
    "Application deadline: 2026-11-10 10:00 +05:00.",
    "Application deadline: 2026-11-10 10:00 +05:00 (2026-11-10 05:00 Z).",
  ]) {
    for (const reason of ["missing_timezone", "missing_time", "invalid_date", "ambiguous"] as const) {
      assert.throws(() => buildLiveAssessment(findings({ unresolvedDeadlines: [{ tenderEvidence: quote, reason }] }), quote, DEMO_COMPANY, "en"), /unique explicit instant/);
    }
  }
});

test("unresolved deadlines retain exact source and use neutral wording for unsupported reasons", () => {
  const examples = [
    { tenderEvidence: "Deadline: 2026-11-10. Time is unspecified.", reason: "missing_time" },
    { tenderEvidence: "Deadline: 2026-11-10 UTC+05:00. Time is unspecified.", reason: "missing_time" },
    { tenderEvidence: "Deadline: 2026-02-30 10:00 Asia/Almaty.", reason: "invalid_date" },
    { tenderEvidence: "Deadline: 2026-11-10 10:00 +05:00 or 2026-11-11 10:00 +05:00.", reason: "ambiguous" },
  ] as const;
  for (const item of examples) {
    const result = buildLiveAssessment(findings({ unresolvedDeadlines: [item] }), item.tenderEvidence, DEMO_COMPANY, "en");
    assert.deepEqual(result.deadlines, []);
    assert.deepEqual(result.alerts, []);
    assert.equal(result.actions.length, 1);
    assert.equal(result.overallRisk, "unknown");
  }
  const quote = "Deadline: 2026-11-10 10:00. Time zone is unspecified.";
  for (const reason of ["missing_time", "invalid_date"] as const) {
    const result = buildLiveAssessment(findings({ unresolvedDeadlines: [{ tenderEvidence: quote, reason }] }), quote, DEMO_COMPANY, "en");
    assert.equal(result.actions[0].title, "Clarify the deadline");
    assert.ok(result.actions[0].description.includes(quote));
    assert.deepEqual(result.deadlines, []);
    assert.deepEqual(result.alerts, []);
    assert.equal(result.overallRisk, "unknown");
  }
  assert.throws(() => buildLiveAssessment(findings({ unresolvedDeadlines: [{ tenderEvidence: "Invented date", reason: "ambiguous" }] }), quote, DEMO_COMPANY, "en"), /Ungrounded finding evidence/);
});

test("only non-met linked requirements produce document actions and deterministic risk", () => {
  const license = "The bidder must hold an active construction license.";
  const text = `${license}\n${source}`;
  const met = requirement({ tenderEvidence: license, companyEvidence: evidence["construction-license"], status: "met" });
  const result = buildLiveAssessment(findings({ requirements: [met, requirement()] }), text, DEMO_COMPANY, "en");
  assert.equal(result.actions.length, 1);
  assert.match(result.actions[0].title, /requirement 2/);
  assert.equal(result.actions[0].priority, "critical");
  assert.equal(result.overallRisk, "high");
  assert.ok(result.actions[0].description.includes(source));
  assert.equal(buildLiveAssessment(findings({ requirements: [met] }), text, DEMO_COMPANY, "en").overallRisk, "low");
  assert.equal(buildLiveAssessment(findings({ requirements: [{ ...met, status: "at_risk" }] }), text, DEMO_COMPANY, "en").overallRisk, "medium");
  assert.equal(buildLiveAssessment(findings({ requirements: [{ ...met, status: "unknown" }] }), text, DEMO_COMPANY, "en").overallRisk, "unknown");
});

test("server retains strict deadline grounding and owns disclaimer and draft reminders", () => {
  const quote = "Application deadline: 2026-11-10 10:00 +05:00.";
  const deadline = { title: "Application deadline", tenderEvidence: quote, date: "2026-11-10T05:00:00Z" };
  const result = buildLiveAssessment(findings({ deadlines: [deadline] }), quote, DEMO_COMPANY, "ru");
  assert.equal(result.alerts.length, 3);
  assert.ok(result.alerts.every(alert => alert.status === "draft"));
  assert.equal(result.disclaimer, getDisclaimer("ru", true));
  assert.equal(result.officialEligibilityVerified, false);
  assert.throws(() => buildLiveAssessment(findings({ deadlines: [{ ...deadline, date: "2026-11-10T10:00:00Z" }] }), quote, DEMO_COMPANY, "en"), /not grounded/);
});

test("long conflict quotes stay bounded while actions include both source snippets", () => {
  const first = `Required: ${"a".repeat(1600)}.`;
  const second = `Not required: ${"b".repeat(1600)}.`;
  const result = buildLiveAssessment(findings({ requirements: [requirement({
    tenderEvidence: first, conflictingEvidence: second, clauseState: "conflicting",
  })] }), `${first}\n${second}`, DEMO_COMPANY, "ru");
  assert.ok(result.requirements[0].explanation.length < 2000);
  assert.ok(result.actions[0].description.includes("Required:"));
  assert.ok(result.actions[0].description.includes("Not required:"));
  assert.equal(result.requirements[0].conflictingEvidence, second);
  assert.equal(AssessmentSchema.safeParse(result).success, true);
});

test("long opposing clauses preserve the decisive ending in public findings and escaped exports", () => {
  const first = "Evidence of completed contracts is mandatory.";
  const second = "Section 2 explains the conditions for this school construction procurement. ".repeat(7)
    + "Evidence of completed contracts is not required. <script>alert('source')</script>";
  assert.ok(second.indexOf("not required") > 400);
  const result = buildLiveAssessment(findings({ requirements: [requirement({
    tenderEvidence: first, conflictingEvidence: second, clauseState: "conflicting", status: "met",
  })] }), `${first}\n${second}`, DEMO_COMPANY, "en");
  assert.equal(result.requirements[0].status, "unknown");
  assert.equal(result.requirements[0].conflictingEvidence, second);
  assert.ok(result.requirements[0].explanation.length < 2000);
  for (const locale of ["en", "ru"] as const) {
    const html = createReportHtml({ assessment: result, mode: "live", analyzedAt: "2026-10-10T12:00:00Z", locale });
    assert.ok(html.includes(escapeReportHtml(second)), "The exported report must retain the complete opposing source passage");
    assert.ok(html.includes(locale === "ru" ? "Противоречивое условие" : "Conflicting clause"));
    assert.equal(html.includes("<script>"), false);
  }
});

test("public conflict evidence must be an exact distinct quote attached only to an unknown finding", () => {
  const opposite = "Work experience confirmation is not required.";
  const text = `${source}\n${opposite}`;
  const result = buildLiveAssessment(findings({ requirements: [requirement({
    conflictingEvidence: opposite, clauseState: "conflicting",
  })] }), text, DEMO_COMPANY, "en");
  assert.doesNotThrow(() => validateGroundedAssessment(result, text, DEMO_COMPANY));
  for (const changes of [
    { conflictingEvidence: "Invented opposing statement." },
    { conflictingEvidence: source },
    { conflictingEvidence: " " },
    { status: "met" as const, companyEvidence: evidence["construction-license"] },
    { status: "missing" as const },
  ]) {
    const bad = structuredClone(result);
    Object.assign(bad.requirements[0], changes);
    assert.throws(() => validateGroundedAssessment(bad, text, DEMO_COMPANY), /Invalid conflicting requirement evidence/);
  }
});

test("all 60 requirement findings and 30 unresolved deadlines retain their actions", () => {
  const requirements = Array.from({ length: 60 }, (_, index) => requirement({ tenderEvidence: `${source} Reference ${index}.` }));
  const unresolvedDeadlines = Array.from({ length: 30 }, (_, index) => ({
    tenderEvidence: `Deadline ${index}: 2026-11-10 10:00. Time zone is unspecified.`, reason: "missing_timezone" as const,
  }));
  const text = [...requirements.map(item => item.tenderEvidence), ...unresolvedDeadlines.map(item => item.tenderEvidence)].join("\n");
  const result = buildLiveAssessment(findings({ requirements, unresolvedDeadlines }), text, DEMO_COMPANY, "en");
  assert.equal(result.actions.length, 90);
  assert.equal(result.overallRisk, "high");
  assert.equal(AssessmentSchema.safeParse(result).success, true);
});
