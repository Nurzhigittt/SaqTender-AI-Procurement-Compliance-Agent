import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_COMPANY } from "../lib/demo-data";
import { compareDocumentDates } from "../lib/document-dates";

test("expiry comparison uses Almaty calendar day, including UTC midnight crossings", () => {
  const profile = structuredClone(DEMO_COMPANY);
  profile.documents[0].expiresAt = "2026-11-10";
  const before = compareDocumentDates(profile, [{ title: "Before local midnight", date: "2026-11-10T18:59:59Z", tenderEvidence: "test" }]);
  const after = compareDocumentDates(profile, [{ title: "At local midnight", date: "2026-11-10T19:00:00Z", tenderEvidence: "test" }]);
  assert.equal(before[0].dateRelation, "covers_deadline_day");
  assert.equal(after[0].dateRelation, "expires_before");
  assert.equal(after[0].deadlineDayInAlmaty, "2026-11-11");
});

test("missing, unverified or undated records never receive a positive date conclusion", () => {
  const profile = structuredClone(DEMO_COMPANY);
  profile.documents[0].status = "missing";
  profile.documents[1].status = "not_verified";
  const checks = compareDocumentDates(profile, [{ title: "Closing", date: "2026-09-29T10:00:00+05:00", tenderEvidence: "test" }]);
  assert.ok(checks.every(item => item.dateRelation === "unknown"));
  assert.deepEqual(compareDocumentDates(profile, []), []);
  assert.throws(() => compareDocumentDates(profile, [{ title: "Invalid", date: "invalid", tenderEvidence: "test" }]));
});

test("presence and validity guidance stay separate across missing, expired, renewed and unknown records", () => {
  const profile = structuredClone(DEMO_COMPANY);
  const opinion = profile.documents.find(item => item.id === "expert-opinion")!;
  const deadline = { title: "Closing", date: "2026-11-10T18:00:00+05:00", tenderEvidence: "test" };
  for (const [status, expiresAt, presence, relation, guidance] of [
    ["active", "2026-11-09", "recorded_present", "expires_before", "at_risk"],
    ["active", "2026-11-10", "recorded_present", "covers_deadline_day", "unknown"],
    ["active", "2026-12-31", "recorded_present", "covers_deadline_day", "unknown"],
    ["active", null, "recorded_present", "unknown", "unknown"],
    ["missing", "2026-11-09", "recorded_missing", "unknown", "missing"],
    ["missing", "2026-12-31", "recorded_missing", "unknown", "missing"],
    ["not_verified", "2026-11-09", "unverified", "unknown", "unknown"],
  ] as const) {
    opinion.status = status;
    opinion.expiresAt = expiresAt;
    const check = compareDocumentDates(profile, [deadline]).find(item => item.documentId === opinion.id)!;
    assert.equal(check.recordPresence, presence);
    assert.equal(check.dateRelation, relation);
    assert.equal(check.statusForValidityRequirement, guidance);
  }
});

test("each deadline retains its own validity guidance without confusing payment and submission", () => {
  const profile = structuredClone(DEMO_COMPANY);
  profile.documents[1].expiresAt = "2026-11-09";
  const checks = compareDocumentDates(profile, [
    { title: "Payment", date: "2026-11-08T18:00:00+05:00", tenderEvidence: "payment" },
    { title: "Submission", date: "2026-11-10T10:00:00+05:00", tenderEvidence: "submission" },
  ]).filter(item => item.documentId === profile.documents[1].id);
  assert.deepEqual(checks.map(item => item.statusForValidityRequirement), ["unknown", "at_risk"]);
  assert.deepEqual(checks.map(item => item.deadlineDayInAlmaty), ["2026-11-08", "2026-11-10"]);
});
