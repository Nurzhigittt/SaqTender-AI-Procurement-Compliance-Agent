import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyReview, createReviewJson, type ReviewPacketInput } from "../lib/assessment-review";
import { DEMO_COMPANY, SAMPLE_TENDER_RU } from "../lib/demo-data";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { parseReviewFile, REVIEW_FILE_MAX_BYTES, ReviewImportError, type ReviewImportErrorCode } from "../lib/review-import";

function fixture(): ReviewPacketInput {
  const assessment = analyzeDemoTender(SAMPLE_TENDER_RU, "ru");
  const review = createEmptyReview(assessment);
  review.requirements[0] = { verdict: "incorrect", note: "Учебное замечание: проверить условие в оригинале." };
  review.deadlines[0].verdict = "unsure";
  return {
    assessment,
    companyProfile: structuredClone(DEMO_COMPANY),
    mode: "demo",
    analyzedAt: "2026-10-10T18:55:00.000Z",
    reviewedAt: "2026-10-11T00:05:00+05:00",
    locale: "ru",
    review,
  };
}

function assertImportError(text: string, code: ReviewImportErrorCode): void {
  assert.throws(() => parseReviewFile(text), error => {
    assert.ok(error instanceof ReviewImportError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test("exported JSON round trips with original report, profile, review, locale, mode and timestamps intact", () => {
  const source = fixture();
  source.assessment.requirements[0].conflictingEvidence = "Иное условие в приложении.";
  source.review.notes = '<script>alert("literal note")</script>\nНе подтверждено специалистом.';
  for (const mode of ["demo", "live"] as const) {
    for (const locale of ["ru", "en"] as const) {
      const input = { ...source, mode, locale };
      const text = createReviewJson(input);
      const imported = parseReviewFile(text);
      assert.deepEqual(imported, JSON.parse(text));
      assert.equal(imported.analyzedAt, input.analyzedAt);
      assert.equal(imported.reviewedAt, input.reviewedAt);
      assert.equal(imported.assessment.officialEligibilityVerified, false);
      assert.equal(imported.assessment.requirements[0].status, input.assessment.requirements[0].status);
      assert.equal(imported.review.requirements[0].verdict, "incorrect");
    }
  }
});

test("import returns an independent deeply frozen packet on every call", () => {
  const text = createReviewJson(fixture());
  const first = parseReviewFile(text);
  const second = parseReviewFile(text);
  assert.notEqual(first, second);
  assert.notEqual(first.assessment.requirements[0], second.assessment.requirements[0]);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.review.requirements[0]));
  assert.ok(Object.isFrozen(first.companyProfile.documents[0]));
  assert.ok(Object.isFrozen(first.assessment));
});

test("a UTF-8 BOM and ordinary surrounding whitespace are accepted", () => {
  const text = createReviewJson(fixture());
  assert.deepEqual(parseReviewFile(`\ufeff \n${text}\t`), parseReviewFile(text));
});

test("malformed JSON, non-object roots and non-string input are invalid files", () => {
  for (const text of ["", " ", "{", "null", "[]", "true", '"text"', "42", "{\"schemaVersion\":\"saqtender-review-v1\",}"]) {
    assertImportError(text, "invalid_file");
  }
  assertImportError(null as unknown as string, "invalid_file");
});

test("missing or malformed versions are invalid, while another string version is explicitly unsupported", () => {
  const original = JSON.parse(createReviewJson(fixture()));
  for (const schemaVersion of [undefined, null, 1, false, {}]) {
    assertImportError(JSON.stringify({ ...original, schemaVersion }), "invalid_file");
  }
  for (const schemaVersion of ["saqtender-review-v2", "", "saqtender-assessment-v1"]) {
    assertImportError(JSON.stringify({ ...original, schemaVersion }), "unsupported_version");
  }
});

test("unknown top-level fields, including authenticity claims and prototype keys, are rejected", () => {
  const original = JSON.parse(createReviewJson(fixture()));
  for (const key of ["verified", "expertApproved", "tenderText", "__proto__", "constructor"]) {
    assertImportError(JSON.stringify({ ...original, [key]: true }), "invalid_file");
  }
});

test("both ASCII and multibyte oversized files fail the UTF-8 byte limit before JSON parsing", () => {
  assertImportError(" ".repeat(REVIEW_FILE_MAX_BYTES + 1), "too_large");
  const multibyte = "я".repeat(REVIEW_FILE_MAX_BYTES / 2 + 1);
  assert.ok(multibyte.length < REVIEW_FILE_MAX_BYTES);
  assertImportError(multibyte, "too_large");
});

test("the exact byte limit is accepted, and the BOM counts toward the file size", () => {
  const text = createReviewJson(fixture());
  const size = new TextEncoder().encode(text).byteLength;
  const exact = text + " ".repeat(REVIEW_FILE_MAX_BYTES - size);
  assert.deepEqual(parseReviewFile(exact), parseReviewFile(text));
  assertImportError(exact + " ", "too_large");
  assertImportError("\ufeff" + exact, "too_large");
});

test("large schema-valid exports with multibyte or JSON-escaped text remain importable", () => {
  for (const character of ["界", "\u0000"]) {
    const input = fixture();
    const fill = (length: number) => character.repeat(length);
    input.assessment.summary = fill(3000);
    input.assessment.disclaimer = fill(1500);
    input.assessment.requirements = Array.from({ length: 60 }, () => ({
      title: fill(200), status: "unknown", tenderEvidence: fill(2000),
      conflictingEvidence: fill(2000), companyEvidence: fill(1000), explanation: fill(2000),
    }));
    input.assessment.deadlines = Array.from({ length: 30 }, () => ({
      title: fill(200), date: "2026-11-10T10:00:00+05:00", tenderEvidence: fill(2000),
    }));
    input.assessment.actions = Array.from({ length: 90 }, () => ({
      title: fill(200), description: fill(2000), priority: "medium",
    }));
    input.assessment.alerts = Array.from({ length: 90 }, () => ({
      title: fill(300), scheduledAt: "2026-11-09T10:00:00+05:00", status: "draft",
    }));
    input.review = createEmptyReview(input.assessment);
    for (const entry of [...input.review.requirements, ...input.review.deadlines]) {
      entry.verdict = "incorrect";
      entry.note = fill(2000);
    }
    input.review.omissions = fill(4000);
    input.review.notes = fill(4000);
    const json = createReviewJson(input);
    const bytes = new TextEncoder().encode(json).byteLength;
    assert.ok(bytes > 2 * 1024 * 1024, "Regression packet must exceed the former 2 MiB limit");
    assert.ok(bytes < REVIEW_FILE_MAX_BYTES);
    assert.deepEqual(parseReviewFile(json), JSON.parse(json));
  }
});

test("invalid mode, locale, timestamps and nested report or company schemas are rejected", () => {
  const original = JSON.parse(createReviewJson(fixture()));
  const invalid = [
    { ...original, mode: "official" },
    { ...original, locale: "kz" },
    { ...original, analyzedAt: "2026-10-11T17:00:00" },
    { ...original, reviewedAt: "not-a-date" },
    { ...original, assessment: { ...original.assessment, officialEligibilityVerified: true } },
    { ...original, assessment: { ...original.assessment, extra: "untrusted" } },
    { ...original, companyProfile: { ...original.companyProfile, documents: [] } },
    { ...original, review: { ...original.review, accuracy: 100 } },
  ];
  for (const packet of invalid) assertImportError(JSON.stringify(packet), "invalid_file");
  const wrongDeadline = structuredClone(original);
  wrongDeadline.assessment.deadlines[0].date = "tomorrow";
  assertImportError(JSON.stringify(wrongDeadline), "invalid_file");
  const wrongDocument = structuredClone(original);
  wrongDocument.companyProfile.documents[0].expiresAt = "2026-02-30";
  assertImportError(JSON.stringify(wrongDocument), "invalid_file");
});

test("review rows must match each original row kind even if the total count is unchanged", () => {
  const original = JSON.parse(createReviewJson(fixture()));
  original.review.requirements.pop();
  original.review.deadlines.push({ verdict: "unreviewed", note: "" });
  assertImportError(JSON.stringify(original), "invalid_file");
});

test("incorrect verdicts require explanations and review text limits remain enforced", () => {
  const original = JSON.parse(createReviewJson(fixture()));
  for (const note of ["", " \n\t", "x".repeat(2001)]) {
    const invalid = structuredClone(original);
    invalid.review.requirements[0].note = note;
    assertImportError(JSON.stringify(invalid), "invalid_file");
  }
  const invalidDeadline = structuredClone(original);
  invalidDeadline.review.deadlines[0] = { verdict: "incorrect", note: " " };
  assertImportError(JSON.stringify(invalidDeadline), "invalid_file");
});

test("packets require some feedback, but an omission without extracted rows is still importable", () => {
  const input = fixture();
  const blank = { ...input, review: createEmptyReview(input.assessment), schemaVersion: "saqtender-review-v1" };
  assertImportError(JSON.stringify(blank), "invalid_file");
  input.assessment.requirements = [];
  input.assessment.deadlines = [];
  input.review = createEmptyReview(input.assessment);
  input.review.omissions = "Проверить пропущенное условие в исходнике.";
  assert.equal(parseReviewFile(createReviewJson(input)).review.omissions, input.review.omissions);
});
