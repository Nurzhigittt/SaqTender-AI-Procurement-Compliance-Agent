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
