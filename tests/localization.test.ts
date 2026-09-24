import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { SAMPLE_TENDER, SAMPLE_TENDER_RU } from "../lib/demo-data";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { AnalyzeRequestSchema, AssessmentSchema } from "../lib/types";

test("Russian sample preserves four quoted requirements, two actual deadlines and six draft reminders", () => {
  const assessment = AssessmentSchema.parse(analyzeDemoTender(SAMPLE_TENDER_RU, "ru"));
  assert.equal(assessment.requirements.length, 4);
  assert.equal(assessment.deadlines.length, 2);
  assert.equal(assessment.alerts.length, 6);
  assert.equal(assessment.overallRisk, "high");
  assert.equal(assessment.officialEligibilityVerified, false);
  assert.deepEqual(assessment.requirements.map((item) => item.status).sort(), ["met", "met", "missing", "unknown"]);
  for (const item of [...assessment.requirements, ...assessment.deadlines]) {
    assert.match(item.tenderEvidence, /[А-Яа-яЁё]/u);
    assert.ok(SAMPLE_TENDER_RU.includes(item.tenderEvidence), "Russian evidence must remain an exact source quote");
  }
  assert.deepEqual(assessment.deadlines.map((item) => new Date(item.date).toISOString()).sort(), [
    "2026-09-26T13:00:00.000Z",
    "2026-09-29T05:00:00.000Z",
  ]);
  assert.ok(assessment.alerts.every((item) => item.status === "draft" && /[А-Яа-яЁё]/u.test(item.title)));
});

test("Russian output for an English tender preserves English source quotes and company evidence", () => {
  const english = analyzeDemoTender(SAMPLE_TENDER, "en");
  const russian = analyzeDemoTender(SAMPLE_TENDER, "ru");
  assert.match(russian.summary, /[А-Яа-яЁё]/u);
  assert.match(russian.disclaimer, /[А-Яа-яЁё]/u);
  assert.ok(russian.requirements.every((item) => /[А-Яа-яЁё]/u.test(item.explanation)));
  assert.deepEqual(russian.requirements.map((item) => item.tenderEvidence), english.requirements.map((item) => item.tenderEvidence));
  assert.deepEqual(russian.requirements.map((item) => item.companyEvidence), english.requirements.map((item) => item.companyEvidence));
  assert.deepEqual(russian.deadlines.map((item) => item.tenderEvidence), english.deadlines.map((item) => item.tenderEvidence));
  assert.deepEqual(russian.alerts.map((item) => item.scheduledAt).sort(), english.alerts.map((item) => item.scheduledAt).sort());
});

test("editing Russian tender dates makes conclusions unknown and never reuses sample validity claims", () => {
  const edited = SAMPLE_TENDER_RU.replace("2026-09-29 10:00", "2026-10-09 10:00");
  assert.notEqual(edited, SAMPLE_TENDER_RU, "The test must change the actual application deadline");
  const assessment = analyzeDemoTender(edited, "ru");
  assert.equal(assessment.overallRisk, "unknown");
  assert.ok(assessment.requirements.length > 0, "Russian requirement candidates should still be detected");
  assert.ok(assessment.requirements.every((item) => item.status === "unknown"));
  assert.ok(assessment.requirements.every((item) => edited.includes(item.tenderEvidence)));
  assert.ok(assessment.deadlines.some((item) => new Date(item.date).toISOString() === "2026-10-09T05:00:00.000Z"));
  assert.equal(assessment.deadlines.some((item) => new Date(item.date).toISOString() === "2026-09-29T05:00:00.000Z"), false);
});

test("unrelated Russian text cannot acquire sample requirements, deadlines or reminders", () => {
  const assessment = analyzeDemoTender("Это вымышленное описание будущего городского сада. Подробности проекта появятся позднее.", "ru");
  assert.equal(assessment.overallRisk, "unknown");
  assert.equal(assessment.requirements.length, 0);
  assert.equal(assessment.deadlines.length, 0);
  assert.equal(assessment.alerts.length, 0);
  assert.match(assessment.summary, /[А-Яа-яЁё]/u);
});

test("API locale accepts Russian or English, rejects malformed values and preserves English default", () => {
  assert.equal(AnalyzeRequestSchema.parse({ tenderText: SAMPLE_TENDER }).locale, "en");
  for (const locale of ["ru", "en"]) {
    assert.equal(AnalyzeRequestSchema.safeParse({ tenderText: SAMPLE_TENDER, locale }).success, true);
  }
  for (const locale of ["RU", "kk", "", null, true, 1, ["ru"]]) {
    assert.equal(AnalyzeRequestSchema.safeParse({ tenderText: SAMPLE_TENDER, locale }).success, false);
  }
});

test("live SDK receives Russian output instructions while preserving English tender evidence", { timeout: 30000 }, () => {
  const fixture = path.join(process.cwd(), "tests/fixtures/agent-transport.ts");
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", fixture, "russian"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 25000,
    env: { ...process.env, OPENAI_API_KEY: "test-key-never-sent", OPENAI_MODEL: "gpt-4.1-mini", DEMO_MODE: "false" },
  });
  assert.equal(result.status, 0, `Offline Russian agent scenario failed: ${result.stderr || result.stdout || result.error?.message}`);
  assert.equal(result.stderr.includes("test-key-never-sent"), false);
});
