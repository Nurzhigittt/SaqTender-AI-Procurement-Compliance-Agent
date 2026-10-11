import assert from "node:assert/strict";
import test from "node:test";
import { createReviewPacket, type ReviewPacket } from "../lib/assessment-review";
import { DEMO_COMPANY } from "../lib/demo-data";
import { createReportHtml, escapeReportHtml } from "../lib/report-export";
import { createComparisonFilename, createComparisonHtml, type ComparisonExportInput } from "../lib/review-comparison-export";
import type { Assessment } from "../lib/types";

function fixture(): ComparisonExportInput {
  const assessment: Assessment = {
    summary: "Original report summary.", overallRisk: "unknown", officialEligibilityVerified: false,
    requirements: [
      { title: "Experience", status: "unknown", tenderEvidence: "Experience required.", conflictingEvidence: "Experience not required.", companyEvidence: "Not provided.", explanation: "Clarify conflicting clauses." },
      { title: "License", status: "met", tenderEvidence: "A license is required.", companyEvidence: "A license is active.", explanation: "A document is recorded." },
      { title: "Certificate", status: "unknown", tenderEvidence: "Certificate required.", companyEvidence: "Not provided.", explanation: "Check the document." },
    ],
    deadlines: [{ title: "Submission", date: "2026-11-10T10:00:00+05:00", tenderEvidence: "Submit by 10 November 2026 at 10:00 UTC+5." }],
    actions: [], alerts: [], disclaimer: "Original disclaimer.",
  };
  const left = createReviewPacket({
    assessment, companyProfile: structuredClone(DEMO_COMPANY), mode: "demo", locale: "ru",
    analyzedAt: "2026-10-10T12:00:00Z", reviewedAt: "2026-10-11T03:00:00Z",
    review: {
      requirements: [{ verdict: "correct", note: "Both quotes included." }, { verdict: "correct", note: "Reviewed." }, { verdict: "unreviewed", note: "" }],
      deadlines: [{ verdict: "unsure", note: "Time zone needs checking." }],
      omissions: "No annex reviewed.", notes: "Team notes A.",
    },
  });
  const right: ReviewPacket = structuredClone(left);
  right.reviewedAt = "2026-10-11T04:00:00Z";
  right.review.requirements[0].note = "Check each quotation.";
  right.review.requirements[1] = { verdict: "incorrect", note: "Need to verify license scope." };
  right.review.deadlines[0] = { verdict: "unreviewed", note: "" };
  right.review.omissions = "Find the annex first.";
  right.review.notes = "Team notes B.";
  return { left, right, leftName: "current.json", rightName: "comparison.json", comparedAt: "2026-10-11T05:00:00Z" };
}

function comparisonSection(html: string): string {
  const start = html.indexOf('<section id="team-review-comparison">');
  const end = html.indexOf("\n</div><footer>", start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}

for (const locale of ["ru", "en"] as const) {
  test(`comparison export preserves original source and localized independent note columns in ${locale}`, () => {
    const input = fixture();
    input.left = { ...input.left, locale };
    input.right.locale = locale;
    const before = structuredClone(input);
    const html = createComparisonHtml(input);
    const section = comparisonSection(html);
    assert.equal(html.replace(`${section}\n`, ""), createReportHtml(input.left));
    assert.deepEqual(input, before);
    assert.ok(section.includes(locale === "ru" ? "Текущие замечания" : "Current notes"));
    assert.ok(section.includes(locale === "ru" ? "Файл для сравнения" : "Comparison file"));
    assert.ok(section.includes(locale === "ru" ? "могли ещё не быть сохранены" : "unsaved edits"));
    assert.ok(section.includes(input.leftName));
    assert.ok(section.includes(input.rightName));
    assert.ok(section.includes(input.comparedAt));
    assert.ok(section.includes(input.left.reviewedAt));
    assert.ok(section.includes(input.right.reviewedAt));
    for (const item of input.left.assessment.requirements) {
      assert.ok(section.includes(item.tenderEvidence));
      if (item.conflictingEvidence) assert.ok(section.includes(item.conflictingEvidence));
    }
    assert.ok(section.includes(input.left.assessment.deadlines[0].date));
    assert.ok(section.includes(input.left.assessment.deadlines[0].tenderEvidence));
    for (const packet of [input.left, input.right]) {
      for (const entry of [...packet.review.requirements, ...packet.review.deadlines]) if (entry.note) assert.ok(section.includes(entry.note));
      assert.ok(section.includes(packet.review.omissions));
      assert.ok(section.includes(packet.review.notes));
    }
    assert.ok(section.includes(locale === "ru" ? "Подлинность импортированных файлов не проверена" : "Imported file authenticity is unverified"));
    assert.ok(section.includes(locale === "ru" ? "не измеряют точность анализа" : "not analysis accuracy"));
    assert.equal((html.match(/<footer>/g) ?? []).length, 1);
  });
}

test("comparison counts marks honestly and retains unreviewed rows without treating agreement as truth", () => {
  const input = fixture();
  const section = comparisonSection(createComparisonHtml(input));
  assert.ok(section.includes("Всего пунктов: <strong>4</strong>"));
  assert.ok(section.includes("Совпадающие оценки: <strong>1</strong>"));
  assert.ok(section.includes("Разные оценки: <strong>1</strong>"));
  assert.ok(section.includes("Неполные оценки: <strong>2</strong>"));
  assert.ok(section.includes("Отмечено для обсуждения: <strong>3</strong>"));
  assert.equal((section.match(/Хотя бы одна оценка не выставлена/g) ?? []).length, 2);
  assert.equal((section.match(/Отмечено для обсуждения; это не вывод/g) ?? []).length, 3);
  assert.ok(section.includes("Не проверено"));
  assert.ok(section.includes("Нет уверенности"));
  assert.ok(section.includes("Совпадение оценок не доказывает точность"));
  assert.ok(section.includes("Тексты различаются"));
});

test("identical feedback is identified as a possible copy rather than independent confirmation", () => {
  const input = fixture();
  input.right = structuredClone(input.left);
  input.right.reviewedAt = "2026-10-11T04:00:00Z";
  const section = comparisonSection(createComparisonHtml(input));
  assert.ok(section.includes("Все замечания полностью совпадают"));
  assert.ok(section.includes("Файлы могут быть копиями одной проверки"));
  assert.ok(section.includes("авторство и независимость проверок не подтверждены"));
  assert.ok(section.includes("Совпадающие оценки: <strong>3</strong>"));
  assert.ok(section.includes("Неполные оценки: <strong>1</strong>"));
});

test("comparison escapes file names and all notes and adds no scripts or network resources", () => {
  const input = fixture();
  const hostile = `</p><script>fetch('https://bad.invalid')</script><img src=x onerror="alert(1)">&"'`;
  input.left = structuredClone(input.left);
  input.leftName = hostile;
  input.rightName = hostile;
  for (const packet of [input.left, input.right]) {
    for (const entry of [...packet.review.requirements, ...packet.review.deadlines]) entry.note = hostile;
    packet.review.omissions = hostile;
    packet.review.notes = hostile;
    packet.assessment.requirements[0].title = hostile;
    packet.assessment.requirements[0].tenderEvidence = hostile;
    packet.assessment.requirements[0].conflictingEvidence = hostile;
    packet.assessment.deadlines[0].title = hostile;
    packet.assessment.deadlines[0].tenderEvidence = hostile;
  }
  const html = createComparisonHtml(input);
  const section = comparisonSection(html);
  assert.equal(html.includes(hostile), false);
  assert.equal(section.split(escapeReportHtml(hostile)).length - 1, 19);
  assert.doesNotMatch(html, /<script\b|<img\b|<iframe\b|<link\b|<form\b|<base\b/i);
  assert.equal([...html.matchAll(/\son\w+="[^"]*"/g)].map(match => match[0]).join(""), ' onclick="window.print()"');
  assert.ok(html.includes("connect-src 'none'"));
  assert.doesNotMatch(section, /<[a-z][^>]*\b(?:src|href|onclick|style)=/i);
});

test("comparison export rejects invalid metadata and incompatible original reports", () => {
  const input = fixture();
  for (const comparedAt of ["not-a-date", "2026-10-11", "2026-10-11T05:00:00", "2026-13-11T05:00:00Z"]) {
    assert.throws(() => createComparisonHtml({ ...input, comparedAt }));
  }
  for (const name of ["", "   ", "a".repeat(256)]) {
    assert.throws(() => createComparisonHtml({ ...input, leftName: name }));
    assert.throws(() => createComparisonHtml({ ...input, rightName: name }));
  }
  input.right.assessment.summary = "A different report.";
  assert.throws(() => createComparisonHtml(input));
  const malformed = fixture();
  malformed.right.review.requirements.pop();
  assert.throws(() => createComparisonHtml(malformed));
});

test("empty original lists retain separate omissions without inventing extracted rows", () => {
  const input = fixture();
  input.left = structuredClone(input.left);
  for (const packet of [input.left, input.right]) {
    packet.assessment.requirements = [];
    packet.assessment.deadlines = [];
    packet.review.requirements = [];
    packet.review.deadlines = [];
  }
  const section = comparisonSection(createComparisonHtml(input));
  assert.ok(section.includes("Всего пунктов: <strong>0</strong>"));
  assert.ok(section.includes("Нет найденных требований или сроков для сравнения"));
  assert.ok(section.includes(input.left.review.omissions));
  assert.ok(section.includes(input.right.review.omissions));
  assert.ok(section.includes("не объединены с требованиями"));
});

test("comparison file names use the Almaty date and reject invalid timestamps", () => {
  assert.equal(createComparisonFilename("2026-10-11T20:15:00Z", "ru"), "saqtender-comparison-ru-2026-10-12.html");
  assert.equal(createComparisonFilename("2026-10-11T01:15:00+05:00", "en"), "saqtender-comparison-en-2026-10-11.html");
  assert.throws(() => createComparisonFilename("<script>", "ru"));
  assert.throws(() => createComparisonFilename("2026-10-11T05:00:00Z", "../x" as "ru"));
});
