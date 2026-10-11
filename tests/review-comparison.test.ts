import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyReview, createReviewPacket, type ReviewPacket, type ReviewPacketInput } from "../lib/assessment-review";
import { compareReviews, ReviewComparisonError, type ReviewComparisonErrorCode } from "../lib/review-comparison";
import { DEMO_COMPANY, SAMPLE_TENDER_RU } from "../lib/demo-data";
import { analyzeDemoTender } from "../lib/mock-analysis";

function fixture(): ReviewPacketInput {
  const assessment = analyzeDemoTender(SAMPLE_TENDER_RU, "ru");
  return {
    assessment,
    companyProfile: structuredClone(DEMO_COMPANY),
    mode: "demo",
    analyzedAt: "2026-10-10T18:55:00.000Z",
    reviewedAt: "2026-10-10T19:05:00.000Z",
    locale: "ru",
    review: { ...createEmptyReview(assessment), notes: "Partial team review" },
  };
}

function pair(): [ReviewPacketInput, ReviewPacketInput] {
  const left = fixture();
  const right = structuredClone(left);
  right.review.notes = "Second partial review";
  return [left, right];
}

function throwsCode(run: () => unknown, code: ReviewComparisonErrorCode): void {
  assert.throws(run, error => error instanceof ReviewComparisonError && error.code === code);
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]));
  }
  return value;
}

test("opposite verdicts are disagreements across requirement and deadline rows", () => {
  const [left, right] = pair();
  left.review.requirements[0] = { verdict: "correct", note: "" };
  right.review.requirements[0] = { verdict: "incorrect", note: "The original requires a different license." };
  left.review.deadlines[0] = { verdict: "correct", note: "" };
  right.review.deadlines[0] = { verdict: "unsure", note: "" };
  const result = compareReviews(createReviewPacket(left), createReviewPacket(right));
  const requirement = result.rows.find(row => row.kind === "requirement" && row.index === 0)!;
  const deadline = result.rows.find(row => row.kind === "deadline" && row.index === 0)!;
  assert.equal(requirement.comparison, "different");
  assert.equal(requirement.needsDiscussion, true);
  assert.equal(deadline.comparison, "different");
  assert.equal(deadline.needsDiscussion, true);
  assert.equal(result.summary.different, 2);
  assert.equal(result.summary.needsDiscussion, 2);
  assert.equal(result.summary.total, left.assessment.requirements.length + left.assessment.deadlines.length);
  assert.equal(result.summary.incomplete, result.summary.total - 2);
});

test("unreviewed rows are incomplete, even when both entries match or one is marked correct", () => {
  const [left, right] = pair();
  right.review.requirements[0].verdict = "correct";
  const result = compareReviews(createReviewPacket(left), createReviewPacket(right));
  assert.ok(result.rows.every(row => row.comparison === "incomplete"));
  assert.equal(result.summary.same, 0);
  assert.equal(result.summary.different, 0);
  assert.equal(result.summary.incomplete, result.summary.total);
  assert.equal(result.summary.needsDiscussion, 0);
  assert.equal("accuracy" in result.summary, false);
});

test("matching incorrect and unsure markings still need discussion, while matching correct markings do not", () => {
  const [left, right] = pair();
  for (const input of [left, right]) {
    input.review.requirements[0] = { verdict: "incorrect", note: "This clause was misread." };
    input.review.requirements[1] = { verdict: "unsure", note: "" };
    input.review.deadlines[0] = { verdict: "correct", note: "Source checked." };
  }
  const result = compareReviews(createReviewPacket(left), createReviewPacket(right));
  assert.equal(result.summary.same, 3);
  assert.equal(result.summary.needsDiscussion, 2);
  assert.equal(result.rows[0].needsDiscussion, true);
  assert.equal(result.rows[1].needsDiscussion, true);
  assert.equal(result.rows.find(row => row.kind === "deadline")!.needsDiscussion, false);
});

test("different row notes need discussion without changing verdict comparison, preserving exact whitespace", () => {
  const [left, right] = pair();
  left.review.requirements[0] = { verdict: "correct", note: "Read the clause." };
  right.review.requirements[0] = { verdict: "correct", note: "Read the clause. " };
  right.review.deadlines[0].note = "Confirm the timezone.";
  const result = compareReviews(createReviewPacket(left), createReviewPacket(right));
  assert.equal(result.rows[0].comparison, "same");
  assert.equal(result.rows[0].needsDiscussion, true);
  assert.equal(result.rows[0].right.note, "Read the clause. ");
  const deadline = result.rows.find(row => row.kind === "deadline")!;
  assert.equal(deadline.comparison, "incomplete");
  assert.equal(deadline.needsDiscussion, true);
  assert.equal(result.summary.needsDiscussion, 2);
});

test("omissions-only and general feedback differences remain separate from row statistics", () => {
  const left = fixture();
  const right = structuredClone(left);
  left.review.notes = right.review.notes = "";
  left.review.omissions = "Check the attachment list.";
  right.review.omissions = "Check the tax certificate.";
  const result = compareReviews(createReviewPacket(left), createReviewPacket(right));
  assert.deepEqual(result.notes, { omissionsDiffer: true, notesDiffer: false });
  assert.equal(result.summary.incomplete, result.summary.total);
  assert.equal(result.summary.needsDiscussion, 0);
  right.review.omissions = left.review.omissions;
  right.review.notes = "Additional context.";
  assert.deepEqual(compareReviews(createReviewPacket(left), createReviewPacket(right)).notes, { omissionsDiffer: false, notesDiffer: true });
});

test("distinct feedback can be compared when a report has no extracted rows", () => {
  const [left, right] = pair();
  for (const input of [left, right]) {
    input.assessment.requirements = [];
    input.assessment.deadlines = [];
    input.review.requirements = [];
    input.review.deadlines = [];
  }
  const result = compareReviews(createReviewPacket(left), createReviewPacket(right));
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.summary, { total: 0, same: 0, different: 0, incomplete: 0, needsDiscussion: 0 });
  assert.equal(result.notes.notesDiffer, true);
});

test("the complete original report, company profile, analysis date, language and mode must match", () => {
  const [left, right] = pair();
  const changes: Array<(input: ReviewPacketInput) => void> = [
    input => { input.assessment.requirements[0].title = "Different requirement at the same index"; },
    input => { input.assessment.requirements[0].conflictingEvidence = "Conflicting source clause"; },
    input => { input.assessment.deadlines[0].date = "2027-01-01T12:00:00+05:00"; },
    input => { input.assessment.summary = "Different summary"; },
    input => { input.assessment.actions[0].description = "Different next step"; },
    input => { input.companyProfile.name = "Different company"; },
    input => { input.companyProfile.documents[0].status = "missing"; },
    input => { input.analyzedAt = "2026-10-10T18:56:00.000Z"; },
    input => { input.locale = "en"; },
    input => { input.mode = "live"; },
    input => { input.assessment.requirements.reverse(); },
  ];
  for (const change of changes) {
    const changed = structuredClone(right);
    change(changed);
    throwsCode(() => compareReviews(createReviewPacket(left), createReviewPacket(changed)), "mismatched_report");
  }
});

test("JSON object key order is irrelevant after canonical packet validation", () => {
  const [left, right] = pair();
  left.review.requirements[0].verdict = "correct";
  right.review.requirements[0].verdict = "correct";
  const first = createReviewPacket(left);
  const second = createReviewPacket(right);
  const reversed = reverseKeys(second) as ReviewPacket;
  assert.notEqual(JSON.stringify(second), JSON.stringify(reversed));
  assert.deepEqual(compareReviews(first, reversed), compareReviews(first, second));
});

test("identical feedback is flagged, independent of review date and object order, without asserting independent reviewers", () => {
  const input = fixture();
  input.review.requirements[0].verdict = "correct";
  const left = createReviewPacket(input);
  const right = structuredClone(left);
  right.reviewedAt = "2026-10-11T19:05:00.000Z";
  for (const candidate of [right, reverseKeys(right) as ReviewPacket, left]) {
    const result = compareReviews(left, candidate);
    assert.equal(result.identicalFeedback, true);
    assert.equal(result.summary.same, 1);
    assert.equal(result.summary.incomplete, result.summary.total - 1);
  }
  right.review.notes += " Additional comment.";
  assert.equal(compareReviews(left, right).identicalFeedback, false);
});

test("comparison revalidates malformed, unsupported, excessive and mismatched review data", () => {
  const [leftInput, rightInput] = pair();
  const left = createReviewPacket(leftInput);
  const right = createReviewPacket(rightInput);
  const invalid: unknown[] = [
    null, [], "saved review", {},
    { ...right, schemaVersion: "saqtender-review-v2" },
    { ...right, schemaVersion: undefined },
    { ...right, extra: "unexpected" },
    { ...right, reviewedAt: "invalid" },
    { ...right, review: { ...right.review, requirements: right.review.requirements.slice(1) } },
    { ...right, review: { ...right.review, notes: "n".repeat(4001) } },
    { ...right, review: { ...right.review, requirements: Array.from({ length: 61 }, () => ({ verdict: "unreviewed", note: "" })) } },
    { ...right, review: { ...right.review, deadlines: Array.from({ length: 31 }, () => ({ verdict: "unreviewed", note: "" })) } },
    { ...right, review: { ...right.review, requirements: [{ verdict: "incorrect", note: " " }, ...right.review.requirements.slice(1)] } },
    { ...right, assessment: { ...right.assessment, officialEligibilityVerified: true } },
  ];
  for (const candidate of invalid) {
    throwsCode(() => compareReviews(left, candidate as ReviewPacket), "invalid_review");
    throwsCode(() => compareReviews(candidate as ReviewPacket, left), "invalid_review");
  }
});

test("the result is detached and frozen while original inputs remain unchanged and mutable", () => {
  const [leftInput, rightInput] = pair();
  const left = structuredClone(createReviewPacket(leftInput));
  const right = structuredClone(createReviewPacket(rightInput));
  const before = structuredClone({ left, right });
  const result = compareReviews(left, right);
  assert.deepEqual({ left, right }, before);
  assert.notEqual(result.rows[0].left, left.review.requirements[0]);
  assert.notEqual(result.rows[0].right, right.review.requirements[0]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.rows));
  assert.ok(Object.isFrozen(result.rows[0]));
  assert.ok(Object.isFrozen(result.rows[0].left));
  assert.ok(Object.isFrozen(result.summary));
  assert.ok(Object.isFrozen(result.notes));
  assert.equal(Object.isFrozen(left), false);
  left.review.requirements[0].note = "Later change";
  right.assessment.summary = "Different original";
  assert.equal(result.rows[0].left.note, before.left.review.requirements[0].note);
});
