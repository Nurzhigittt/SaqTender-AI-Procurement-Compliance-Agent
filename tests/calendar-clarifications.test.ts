import assert from "node:assert/strict";
import test from "node:test";
import { mergeCalendarClarifications } from "../lib/calendar-clarifications";
import { buildLiveAssessment, type LiveFindings } from "../lib/live-findings";
import { DEMO_COMPANY } from "../lib/demo-data";
import { AnalysisRunError } from "../lib/analysis-diagnostics";
import { getAnalysisDiagnostics } from "../lib/analysis-error";

const item = (tenderEvidence: string, reason: LiveFindings["unresolvedDeadlines"][number]["reason"] = "ambiguous") => ({ tenderEvidence, reason });

test("server clarification survives omitted final output and exact duplicate model reason", () => {
  const source = "Работы выполняются в течение 120 дней с даты подписания договора.";
  const retained = [item(source)];
  assert.deepEqual(mergeCalendarClarifications(retained, []), retained);
  assert.deepEqual(mergeCalendarClarifications(retained, [item(source, "missing_timezone")]), retained);
  const merged = mergeCalendarClarifications(retained, [item(source)]);
  merged[0].reason = "invalid_date";
  assert.equal(retained[0].reason, "ambiguous", "Stored items must not be mutated by later report work");
  const report = buildLiveAssessment({ requirements: [], deadlines: [], unresolvedDeadlines: mergeCalendarClarifications(retained, []) }, source, DEMO_COMPANY, "ru");
  assert.equal(report.actions.length, 1);
  assert.ok(report.actions[0].description.includes(source));
  assert.deepEqual(report.deadlines, []);
  assert.deepEqual(report.alerts, []);
  assert.equal(report.overallRisk, "unknown");
});

test("overlapping or differently formatted passages are not silently discarded", () => {
  const first = "Работы выполняются в течение 120 дней";
  const second = first + " с даты\nподписания договора.";
  const third = second.replace("\n", " ");
  assert.deepEqual(mergeCalendarClarifications([item(first)], [item(second), item(third)]).map(x => x.tenderEvidence), [first, second, third]);
});

test("a later exact deadline does not erase an earlier incomplete selected passage", () => {
  const passage = "Работы в течение 120 дней после подписания договора, подача заявки до";
  const source = passage + " 2026-11-10 10:00 +05:00.";
  const report = buildLiveAssessment({ requirements: [],
    deadlines: [{ title: "Подача", date: "2026-11-10T05:00:00Z", tenderEvidence: source }],
    unresolvedDeadlines: mergeCalendarClarifications([item(passage)], []),
  }, source, DEMO_COMPANY, "ru");
  assert.equal(report.deadlines.length, 1);
  assert.equal(report.alerts.length, 3);
  assert.equal(report.actions.length, 1);
  assert.ok(report.actions[0].description.includes("сам по себе"));
  assert.ok(report.actions[0].description.includes(passage));
});

test("thirty unique calendar clarifications fit; a larger union rejects without truncating or mutating", () => {
  const first = Array.from({ length: 20 }, (_, i) => item(`Период ${i}: 5 дней после приёмки.`));
  const second = Array.from({ length: 11 }, (_, i) => item(`Период ${i + 20}: 18 месяцев после приёмки.`));
  const snapshot = JSON.stringify([first, second]);
  assert.equal(mergeCalendarClarifications(first, second.slice(0, 10)).length, 30);
  assert.equal(mergeCalendarClarifications(first, first).length, 20);
  assert.throws(() => mergeCalendarClarifications(first, second), /Too many unresolved deadline findings/);
  assert.equal(JSON.stringify([first, second]), snapshot);
  assert.deepEqual(getAnalysisDiagnostics(new AnalysisRunError("final_received", new Error("Too many unresolved deadline findings"))), {
    stage: "final_received", reason: "unresolved_deadline_limit",
  });
});

test("merging clarifications does not bypass full-instant or original-source validation", () => {
  const source = "Подача: 2026-11-10 10:00 +05:00.";
  for (const entries of [[item(source)], [item("Выдуманная цитата.")]]) {
    assert.throws(() => buildLiveAssessment({ requirements: [], deadlines: [], unresolvedDeadlines: mergeCalendarClarifications([], entries) }, source, DEMO_COMPANY, "ru"));
  }
});
