import assert from "node:assert/strict";
import test from "node:test";
import { createDraftAlerts } from "../lib/alerts";
import { SAMPLE_REQUIREMENTS, SAMPLE_TENDER } from "../lib/demo-data";
import { explicitDatesInEvidence, validateGroundedAssessment } from "../lib/grounding";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { AnalyzeRequestSchema, AssessmentSchema } from "../lib/types";

test("requests reject empty, oversized, malformed and unexpected payloads", () => {
  for (const payload of [null, {}, { tenderText: "   " }, { tenderText: 42 },
    { tenderText: "x".repeat(20001) }, { tenderText: SAMPLE_TENDER, apiKey: "should-not-be-accepted" }]) {
    assert.equal(AnalyzeRequestSchema.safeParse(payload).success, false);
  }
  assert.equal(AnalyzeRequestSchema.safeParse({ tenderText: SAMPLE_TENDER }).success, true);
});

test("sample assessment is structured, evidence-backed, and never verifies official eligibility", () => {
  const assessment = AssessmentSchema.parse(analyzeDemoTender(SAMPLE_TENDER));
  assert.equal(assessment.officialEligibilityVerified, false);
  assert.equal(assessment.overallRisk, "high");
  assert.ok(assessment.requirements.some((item) => item.status === "missing" && /experience/i.test(item.title)));
  for (const item of [...assessment.requirements, ...assessment.deadlines]) {
    assert.ok(SAMPLE_TENDER.includes(item.tenderEvidence), `Evidence not present: ${item.tenderEvidence}`);
  }
  assert.equal(assessment.alerts.length, assessment.deadlines.length * 3);
  assert.ok(assessment.alerts.every((alert) => alert.status === "draft"));
  assert.equal(AssessmentSchema.safeParse({ ...assessment, officialEligibilityVerified: true }).success, false);
});

test("sample deadlines are interpreted as Asia/Almaty instants", () => {
  const assessment = analyzeDemoTender(SAMPLE_TENDER);
  const deadlines = assessment.deadlines.map((item) => new Date(item.date).toISOString());
  assert.ok(deadlines.includes("2026-09-29T05:00:00.000Z"));
  assert.ok(deadlines.includes("2026-09-26T13:00:00.000Z"));
});

test("reminders subtract exact time offsets and remain draft records even when dates are past", () => {
  const alerts = createDraftAlerts([{
    title: "Application deadline",
    date: "2026-09-29T10:00:00+05:00",
    tenderEvidence: "Application deadline: 2026-09-29 10:00 Asia/Almaty.",
  }]);
  assert.deepEqual(alerts.map((alert) => alert.scheduledAt), [
    "2026-09-22T05:00:00.000Z",
    "2026-09-26T05:00:00.000Z",
    "2026-09-28T05:00:00.000Z",
  ]);
  assert.ok(alerts.every((alert) => alert.status === "draft"));
  assert.deepEqual(createDraftAlerts([]), []);
  assert.throws(() => createDraftAlerts([{ title: "Invalid", date: "not-a-date", tenderEvidence: "Invalid" }]));
});

test("unrelated edited text cannot silently reuse requirements or deadlines from the sample", () => {
  const text = "This fictional notice describes a concept for a community garden. Further details will be published separately.";
  const assessment = analyzeDemoTender(text);
  assert.equal(assessment.overallRisk, "unknown");
  assert.equal(assessment.requirements.length, 0);
  assert.equal(assessment.deadlines.length, 0);
  assert.equal(assessment.alerts.length, 0);
});

test("removing a requirement removes that requirement from the demo assessment", () => {
  const edited = SAMPLE_TENDER.replace(SAMPLE_REQUIREMENTS.expert, "");
  const assessment = analyzeDemoTender(edited);
  assert.equal(assessment.requirements.some((item) => item.tenderEvidence.includes(SAMPLE_REQUIREMENTS.expert)), false);
});

test("extending the submission beyond expert opinion expiry must not leave it marked met", () => {
  const edited = SAMPLE_TENDER.replace("2026-09-29 10:00", "2026-10-09 10:00");
  const assessment = analyzeDemoTender(edited);
  const expert = assessment.requirements.find((item) => item.tenderEvidence.includes(SAMPLE_REQUIREMENTS.expert));
  assert.ok(expert, "The expert opinion requirement should still be extracted");
  assert.notEqual(expert.status, "met");
});

test("ambiguous or impossible dates cannot become guessed deadline timestamps", () => {
  for (const evidence of [
    "Application deadline: 2026-09-29 10:00.",
    "Application deadline: next Tuesday.",
    "Application deadline: 2026-02-30 10:00 Asia/Almaty.",
    "Application deadline: 2026-09-29 25:00 Asia/Almaty.",
  ]) {
    assert.deepEqual(explicitDatesInEvidence(evidence), []);
  }
});

test("grounding rejects invented evidence and deadline dates unrelated to the evidence", () => {
  const inventedEvidence = structuredClone(analyzeDemoTender(SAMPLE_TENDER));
  inventedEvidence.requirements[0].tenderEvidence = "The bidder must submit a document that is not in this tender.";
  assert.throws(() => validateGroundedAssessment(inventedEvidence, SAMPLE_TENDER));

  const inventedDate = structuredClone(analyzeDemoTender(SAMPLE_TENDER));
  inventedDate.deadlines[0].date = "2030-01-01T00:00:00Z";
  assert.throws(() => validateGroundedAssessment(inventedDate, SAMPLE_TENDER));

  const inventedCompanyEvidence = structuredClone(analyzeDemoTender(SAMPLE_TENDER));
  inventedCompanyEvidence.requirements[0].companyEvidence = "Official registry verified this license.";
  assert.throws(() => validateGroundedAssessment(inventedCompanyEvidence, SAMPLE_TENDER));
});

test("a missing document or unknown fact cannot be hidden behind a low-risk summary", () => {
  const assessment = structuredClone(analyzeDemoTender(SAMPLE_TENDER));
  assessment.overallRisk = "low";
  assert.equal(validateGroundedAssessment(assessment, SAMPLE_TENDER).overallRisk, "high");
  assessment.requirements = assessment.requirements.filter((item) => item.status !== "missing");
  assessment.overallRisk = "low";
  assert.equal(validateGroundedAssessment(assessment, SAMPLE_TENDER).overallRisk, "unknown");
});
