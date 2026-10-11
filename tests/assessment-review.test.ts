import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyReview, createReviewJson, createReviewPacket, reviewFilename, summarizeReview, validateReview, type ReviewPacketInput } from "../lib/assessment-review";
import { DEMO_COMPANY, SAMPLE_TENDER_RU } from "../lib/demo-data";
import { analyzeDemoTender } from "../lib/mock-analysis";
import type { Assessment, CompanyProfile } from "../lib/types";

function fixture(): ReviewPacketInput {
  const assessment = analyzeDemoTender(SAMPLE_TENDER_RU, "ru");
  return {
    assessment,
    companyProfile: structuredClone(DEMO_COMPANY),
    mode: "demo",
    analyzedAt: "2026-10-10T18:55:00.000Z",
    reviewedAt: "2026-10-10T19:05:00.000Z",
    locale: "ru",
    review: createEmptyReview(assessment),
  };
}

test("empty review has an independent unreviewed row for every requirement and deadline", () => {
  const { assessment, review } = fixture();
  assert.equal(review.requirements.length, assessment.requirements.length);
  assert.equal(review.deadlines.length, assessment.deadlines.length);
  const entries = [...review.requirements, ...review.deadlines];
  assert.ok(entries.length > 1);
  assert.ok(entries.every(entry => entry.verdict === "unreviewed" && entry.note === ""));
  assert.notEqual(entries[0], entries[1]);
  assert.equal(review.omissions, "");
  assert.equal(review.notes, "");
  assert.doesNotThrow(() => validateReview(assessment, review));
});

test("summary counts verdicts across row types without implying that notes or unreviewed rows were verified", () => {
  const summary = summarizeReview({
    requirements: [{ verdict: "correct", note: "" }, { verdict: "incorrect", note: "" }, { verdict: "unreviewed", note: "Check the original first" }],
    deadlines: [{ verdict: "unsure", note: "" }, { verdict: "correct", note: "" }],
    omissions: "Missing requirement", notes: "Partial review",
  });
  assert.deepEqual(summary, { total: 5, marked: 4, unreviewed: 1, correct: 2, incorrect: 1, unsure: 1 });
  assert.equal("accuracy" in summary, false);
});

test("validation rejects row mismatch even when the combined number of rows is unchanged", () => {
  const input = fixture();
  input.review.requirements.pop();
  input.review.deadlines.push({ verdict: "unreviewed", note: "" });
  assert.throws(() => validateReview(input.assessment, input.review), /row count/);
});

test("incorrect verdict needs a nonblank explanation; uncertain and partial reviews remain valid", () => {
  const { assessment, review } = fixture();
  review.requirements[0] = { verdict: "incorrect", note: " \n\t" };
  assert.throws(() => validateReview(assessment, review), /nonblank note/);
  review.requirements[0].note = "The original clause says the opposite.";
  assert.doesNotThrow(() => validateReview(assessment, review));
  review.requirements[0] = { verdict: "unsure", note: "" };
  assert.doesNotThrow(() => validateReview(assessment, review));
});

test("review bounds include both row types and free text fields, accepting exact limits", () => {
  const { assessment, review } = fixture();
  review.requirements[0].note = "r".repeat(2000);
  review.deadlines[0].note = "d".repeat(2000);
  review.omissions = "o".repeat(4000);
  review.notes = "n".repeat(4000);
  assert.doesNotThrow(() => validateReview(assessment, review));
  for (const field of ["omissions", "notes"] as const) {
    const tooLong = structuredClone(review);
    tooLong[field] += "x";
    assert.throws(() => validateReview(assessment, tooLong));
  }
  for (const field of ["requirements", "deadlines"] as const) {
    const tooLong = structuredClone(review);
    tooLong[field][0].note += "x";
    assert.throws(() => validateReview(assessment, tooLong));
  }
});

test("export rejects a blank review but accepts a mark, row note, omission or general note separately", () => {
  const blank = fixture();
  blank.review.omissions = " \n";
  blank.review.notes = "\t";
  blank.review.requirements[0].note = " ";
  assert.throws(() => createReviewPacket(blank), /before exporting/);
  for (const kind of ["mark", "row-note", "deadline-note", "omission", "note"] as const) {
    const input = fixture();
    if (kind === "mark") input.review.requirements[0].verdict = "correct";
    if (kind === "row-note") input.review.requirements[0].note = "Recheck this source.";
    if (kind === "deadline-note") input.review.deadlines[0].note = "Timezone needs further checking.";
    if (kind === "omission") input.review.omissions = "An extra qualification may be missing.";
    if (kind === "note") input.review.notes = "Review is incomplete.";
    assert.doesNotThrow(() => createReviewPacket(input), kind);
  }
});

test("packet preserves the complete original report and canonical profile separately from feedback", () => {
  const input = fixture();
  input.assessment.requirements[0].conflictingEvidence = "An opposing clause in the source.";
  input.review.requirements[0] = { verdict: "incorrect", note: "Status should be unknown." };
  input.review.omissions = "A requirement outside the extracted rows needs review.";
  const packet = createReviewPacket(input);
  assert.equal(packet.schemaVersion, "saqtender-review-v1");
  assert.deepEqual(packet.assessment, input.assessment);
  assert.deepEqual(packet.companyProfile, input.companyProfile);
  assert.deepEqual(packet.review, input.review);
  assert.equal(packet.assessment.officialEligibilityVerified, false);
  assert.equal(packet.mode, "demo");
  assert.equal(packet.analyzedAt, input.analyzedAt);
  assert.equal(packet.reviewedAt, input.reviewedAt);
  assert.equal(packet.locale, "ru");
  assert.deepEqual(Object.keys(packet).sort(), ["schemaVersion", "assessment", "companyProfile", "mode", "analyzedAt", "locale", "review", "reviewedAt"].sort());
});

test("snapshot is detached and deeply frozen without freezing or modifying application state", () => {
  const input = fixture();
  input.review.notes = "Original feedback";
  const before = structuredClone(input);
  const packet = createReviewPacket(input);
  assert.deepEqual(input, before);
  assert.notEqual(packet.assessment, input.assessment);
  assert.notEqual(packet.assessment.requirements[0], input.assessment.requirements[0]);
  assert.notEqual(packet.companyProfile.documents[0], input.companyProfile.documents[0]);
  assert.notEqual(packet.review.requirements[0], input.review.requirements[0]);
  assert.ok(Object.isFrozen(packet));
  assert.ok(Object.isFrozen(packet.assessment.requirements[0]));
  assert.ok(Object.isFrozen(packet.companyProfile.documents));
  assert.ok(Object.isFrozen(packet.review));
  assert.equal(Object.isFrozen(input.review), false);
  input.review.notes = "Edited feedback";
  input.assessment.requirements[0].title = "Edited report";
  input.companyProfile.documents[0].title = "Edited document";
  assert.equal(packet.review.notes, before.review.notes);
  assert.equal(packet.assessment.requirements[0].title, before.assessment.requirements[0].title);
  assert.equal(packet.companyProfile.documents[0].title, before.companyProfile.documents[0].title);
});

test("packet validates mode, locale, dates, canonical profile and original report rather than accepting extra data", () => {
  const input = fixture();
  input.review.notes = "Reviewed";
  for (const invalid of [
    { ...input, mode: "official" },
    { ...input, locale: "../../file" },
    { ...input, reviewedAt: "invalid" },
    { ...input, analyzedAt: "2026-10-10T13:00:00" },
    { ...input, tenderText: "Raw tender must not be added to the review packet." },
    { ...input, review: { ...input.review, accuracy: 1 } },
    { ...input, assessment: { ...input.assessment, officialEligibilityVerified: true } as unknown as Assessment },
    { ...input, companyProfile: { ...input.companyProfile, documents: input.companyProfile.documents.slice(1) } as CompanyProfile },
  ]) assert.throws(() => createReviewPacket(invalid as ReviewPacketInput));
  const duplicate = structuredClone(input);
  duplicate.companyProfile.documents[1] = structuredClone(duplicate.companyProfile.documents[0]);
  assert.throws(() => createReviewPacket(duplicate));
});

test("JSON is a complete readable offline packet and preserves literal feedback without inventing model output", () => {
  const input = fixture();
  input.mode = "live";
  input.review.notes = 'Original note: <script>alert("test")</script>\nСледующая строка';
  const json = createReviewJson(input);
  assert.ok(json.endsWith("\n"));
  assert.ok(json.includes('\n  "schemaVersion": "saqtender-review-v1"'));
  const parsed = JSON.parse(json);
  assert.deepEqual(parsed, createReviewPacket(input));
  assert.equal(parsed.review.notes, input.review.notes);
  assert.equal(parsed.mode, "live");
  assert.equal("model" in parsed, false);
  assert.equal("accuracy" in parsed, false);
  assert.equal("tenderText" in parsed, false);
});

test("review filename uses Almaty date with safe locale, date and supported extension", () => {
  assert.equal(reviewFilename({ reviewedAt: "2026-10-10T19:05:00.000Z", locale: "ru" }, "json"), "saqtender-review-ru-2026-10-11.json");
  assert.equal(reviewFilename({ reviewedAt: "2026-10-10T18:59:59Z", locale: "en" }, "html"), "saqtender-review-en-2026-10-10.html");
  assert.equal(reviewFilename({ reviewedAt: "../../bad", locale: "ru" }, "json"), "saqtender-review-ru-undated.json");
  assert.equal(reviewFilename({ reviewedAt: "invalid", locale: "../../bad" as "en" }, "html"), "saqtender-review-en-undated.html");
  assert.throws(() => reviewFilename({ reviewedAt: "invalid", locale: "en" }, "../../bad" as "html"), /Unsupported/);
});

test("an assessment without extracted rows still supports recording omissions for manual follow-up", () => {
  const input = fixture();
  input.assessment.requirements = [];
  input.assessment.deadlines = [];
  input.review = createEmptyReview(input.assessment);
  input.review.omissions = "The source includes a date that was not extracted.";
  assert.deepEqual(summarizeReview(input.review), { total: 0, marked: 0, unreviewed: 0, correct: 0, incorrect: 0, unsure: 0 });
  assert.equal(createReviewPacket(input).review.omissions, input.review.omissions);
});
