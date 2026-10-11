import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_COMPANY, getSampleTender } from "../lib/demo-data";
import type { Locale } from "../lib/i18n";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { compareReviews, ReviewComparisonError } from "../lib/review-comparison";
import { parseReviewFile } from "../lib/review-import";
import { createPracticeReviews } from "../lib/review-practice";

for (const locale of ["ru", "en"] as const) {
  test(`${locale} practice is repeatable and preserves one complete demo report for both reviews`, () => {
    const exercise = createPracticeReviews(locale);
    assert.deepEqual(exercise, createPracticeReviews(locale));
    assert.equal(exercise.sourceText, getSampleTender(locale));
    for (const { packet } of [exercise.left, exercise.right]) {
      assert.deepEqual(packet.assessment, analyzeDemoTender(exercise.sourceText, locale, DEMO_COMPANY));
      assert.deepEqual(packet.companyProfile, DEMO_COMPANY);
      assert.equal(packet.companyProfile.isDemo, true);
      assert.equal(packet.mode, "demo");
      assert.equal(packet.locale, locale);
      assert.equal(packet.assessment.officialEligibilityVerified, false);
      assert.equal(packet.analyzedAt, "2026-09-24T10:00:00+05:00");
      assert.ok(Date.parse(packet.reviewedAt) > Date.parse(packet.analyzedAt));
      assert.ok(packet.assessment.deadlines.every(deadline => Date.parse(deadline.date) > Date.parse(packet.reviewedAt)));
      for (const row of [...packet.assessment.requirements, ...packet.assessment.deadlines]) {
        assert.ok(exercise.sourceText.includes(row.tenderEvidence), "Every quoted clause occurs in the full supplied source");
      }
    }
    assert.notEqual(exercise.left.packet.reviewedAt, exercise.right.packet.reviewedAt);
    assert.deepEqual(exercise.left.packet.assessment, exercise.right.packet.assessment);
    assert.notEqual(exercise.left.packet.assessment, exercise.right.packet.assessment);
  });

  test(`${locale} prefilled notes are visibly fictional teaching material in independently downloaded files`, () => {
    const exercise = createPracticeReviews(locale);
    assert.equal(exercise.left.name, `practice-a-${locale}.json`);
    assert.equal(exercise.right.name, `practice-b-${locale}.json`);
    for (const { packet } of [exercise.left, exercise.right]) {
      const restored = parseReviewFile(`${JSON.stringify(packet, null, 2)}\n`);
      assert.deepEqual(restored, packet);
      if (locale === "ru") {
        assert.match(restored.review.notes, /Вымышленный учебный пример/);
        assert.match(restored.review.notes, /не отзывы реальных участников/);
        assert.match(restored.review.notes, /не экспертное заключение/);
        assert.match(restored.review.notes, /не эталон правильных ответов/);
        assert.match(restored.review.notes, /не измерение точности ИИ/);
      } else {
        assert.match(restored.review.notes, /Fictional teaching example/);
        assert.match(restored.review.notes, /not feedback from real participants/);
        assert.match(restored.review.notes, /an expert opinion, an answer key, or a measurement of AI accuracy/);
      }
    }
  });

  test(`${locale} exercise demonstrates agreement, disagreement and incomplete reviews without counting unmarked rows as agreement`, () => {
    const { left, right } = createPracticeReviews(locale);
    const comparison = compareReviews(left.packet, right.packet);
    assert.deepEqual(comparison.summary, { total: 6, same: 2, different: 1, incomplete: 3, needsDiscussion: 2 });
    assert.equal(comparison.identicalFeedback, false);
    assert.deepEqual(comparison.notes, { omissionsDiffer: true, notesDiffer: true });
    assert.equal(comparison.rows[0].comparison, "same");
    assert.equal(comparison.rows[1].comparison, "different");
    assert.equal(comparison.rows[1].needsDiscussion, true);
    assert.equal(comparison.rows[2].comparison, "incomplete");
    assert.equal(comparison.rows[2].left.verdict, "unreviewed");
    assert.equal(comparison.rows[2].right.verdict, "unreviewed");
    assert.equal(comparison.rows[3].comparison, "incomplete");
    assert.equal(comparison.rows[3].needsDiscussion, true);
    assert.equal("accuracy" in comparison.summary, false);
  });
}

test("different language exercises cannot be accidentally compared as one original report", () => {
  const russian = createPracticeReviews("ru");
  const english = createPracticeReviews("en");
  assert.throws(
    () => compareReviews(russian.left.packet, english.right.packet),
    error => error instanceof ReviewComparisonError && error.code === "mismatched_report",
  );
  assert.throws(() => createPracticeReviews("../other" as Locale), /Unsupported practice language/);
});

test("practice snapshots are immutable and do not freeze shared application data", () => {
  const exercise = createPracticeReviews("ru");
  assert.ok(Object.isFrozen(exercise));
  assert.ok(Object.isFrozen(exercise.left));
  assert.ok(Object.isFrozen(exercise.right));
  assert.ok(Object.isFrozen(exercise.left.packet));
  assert.ok(Object.isFrozen(exercise.left.packet.assessment.requirements[0]));
  assert.ok(Object.isFrozen(exercise.left.packet.review.requirements[0]));
  assert.ok(Object.isFrozen(exercise.right.packet.companyProfile.documents[0]));
  assert.notEqual(exercise.left.packet.companyProfile, DEMO_COMPANY);
  assert.equal(Object.isFrozen(DEMO_COMPANY), false);
  const editableCopy = structuredClone(exercise.left.packet);
  editableCopy.review.requirements[0].note = "A team's later note";
  assert.notEqual(editableCopy.review.requirements[0].note, exercise.left.packet.review.requirements[0].note);
  assert.deepEqual(exercise, createPracticeReviews("ru"));
});
