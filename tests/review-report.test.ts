import assert from "node:assert/strict";
import test from "node:test";
import type { ReviewPacketInput } from "../lib/assessment-review";
import { DEMO_COMPANY } from "../lib/demo-data";
import { createReportHtml, escapeReportHtml } from "../lib/report-export";
import { createReviewHtml } from "../lib/review-report";
import type { Assessment } from "../lib/types";

function fixture(): ReviewPacketInput {
  const assessment: Assessment = {
    summary: "Original assessment summary.",
    overallRisk: "unknown",
    officialEligibilityVerified: false,
    requirements: [{ title: "Work experience", status: "unknown", tenderEvidence: "Work experience is required.", conflictingEvidence: "Work experience is not required.", companyEvidence: "Work Experience Confirmation: Missing.", explanation: "Conflicting clauses need clarification." }],
    deadlines: [{ title: "Submission", date: "2026-11-10T10:00:00+05:00", tenderEvidence: "Submit by 2026-11-10 10:00 UTC+5." }],
    actions: [{ title: "Clarify clauses", description: "Compare the opposing statements.", priority: "medium" }],
    alerts: [],
    disclaimer: "The original disclaimer is preserved.",
  };
  return {
    assessment,
    companyProfile: structuredClone(DEMO_COMPANY),
    mode: "live",
    analyzedAt: "2026-10-10T15:00:00.000Z",
    reviewedAt: "2026-10-11T05:00:00.000Z",
    locale: "ru",
    review: {
      requirements: [{ verdict: "correct", note: "Both clauses were included." }],
      deadlines: [{ verdict: "unsure", note: "Check the original document." }],
      omissions: "A possible omitted clause needs checking.",
      notes: "Internal team review only.",
    },
  };
}

function reviewSection(html: string): string {
  const start = html.indexOf('<section id="team-manual-review">');
  const end = html.indexOf("\n</div><footer>", start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}

for (const locale of ["ru", "en"] as const) {
  test(`manual review export preserves original rows and localized team labels in ${locale}`, () => {
    const input = fixture();
    input.locale = locale;
    const html = createReviewHtml(input);
    const section = reviewSection(html);
    assert.ok(section.includes(locale === "ru" ? "Ручная проверка команды" : "Team manual review"));
    assert.ok(section.includes(locale === "ru" ? "Команда считает верным" : "Marked correct by the team"));
    assert.ok(section.includes(locale === "ru" ? "Команда не уверена" : "Team is unsure"));
    assert.ok(section.includes(locale === "ru" ? "Исходный статус в отчёте: Нет данных" : "Original assessment status: Unknown"));
    assert.ok(section.includes("2 / 2"));
    assert.ok(section.includes(input.reviewedAt));
    assert.ok(section.includes(input.assessment.requirements[0].title));
    assert.ok(section.includes(input.assessment.requirements[0].tenderEvidence));
    assert.ok(section.includes(input.assessment.requirements[0].conflictingEvidence!));
    assert.ok(section.includes(input.assessment.deadlines[0].title));
    assert.ok(section.includes(input.assessment.deadlines[0].date));
    assert.ok(section.includes(input.assessment.deadlines[0].tenderEvidence));
    assert.ok(section.includes(input.review.requirements[0].note));
    assert.ok(section.includes(input.review.deadlines[0].note));
    assert.ok(section.includes(input.review.omissions));
    assert.ok(section.includes(input.review.notes));
    assert.ok(section.includes(locale === "ru" ? "не точность анализа" : "not analysis accuracy"));
    assert.ok(section.includes(locale === "ru" ? "не экспертное заключение" : "not an expert opinion"));
    assert.equal((html.match(/<footer>/g) ?? []).length, 1);
  });
}

test("manual-review export preserves the original assessment and demo/live labels without mutation", () => {
  for (const mode of ["demo", "live"] as const) {
    const input = fixture();
    input.mode = mode;
    input.review.requirements[0].verdict = "incorrect";
    const before = structuredClone(input);
    const base = createReportHtml(input);
    const html = createReviewHtml(input);
    assert.deepEqual(input, before);
    assert.equal(html.replace(`${reviewSection(html)}\n`, ""), base);
    assert.ok(html.includes(mode === "demo" ? "ДЕМОРЕЖИМ · Без вызова ИИ" : "АНАЛИЗ С ПОМОЩЬЮ ИИ"));
    assert.ok(reviewSection(html).includes("Команда считает ошибочным"));
    assert.equal(input.assessment.requirements[0].status, "unknown");
    assert.equal(input.assessment.officialEligibilityVerified, false);
  }
});

test("all source text and review notes are escaped; manual review adds no scripts or network resources", () => {
  const input = fixture();
  const hostile = `</p><script>fetch('https://bad.invalid')</script><img src=x onerror="alert(1)">&"'`;
  input.assessment.requirements[0] = { title: hostile, status: "unknown", tenderEvidence: hostile, conflictingEvidence: hostile, companyEvidence: hostile, explanation: hostile };
  input.assessment.deadlines[0].title = hostile;
  input.assessment.deadlines[0].tenderEvidence = hostile;
  input.review.requirements[0].note = hostile;
  input.review.deadlines[0].note = hostile;
  input.review.omissions = hostile;
  input.review.notes = hostile;
  const html = createReviewHtml(input);
  const section = reviewSection(html);
  assert.equal(html.includes(hostile), false);
  assert.equal(section.split(escapeReportHtml(hostile)).length - 1, 9, "Every original title/source and every review note must be preserved as text");
  assert.doesNotMatch(html, /<script\b|<img\b|<iframe\b|<link\b|<form\b|<base\b/i);
  assert.equal([...html.matchAll(/\son\w+="[^"]*"/g)].map(match => match[0]).join(""), ' onclick="window.print()"');
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes("form-action 'none'"));
  assert.doesNotMatch(section, /<[a-z][^>]*\b(?:src|href|onclick|style)=/i);
});

test("a note on an unreviewed row remains unreviewed and never implies a confirmed conclusion", () => {
  const input = fixture();
  input.review.requirements[0] = { verdict: "unreviewed", note: "Need the complete document." };
  input.review.deadlines[0] = { verdict: "unreviewed", note: "" };
  input.review.omissions = "";
  input.review.notes = "";
  for (const locale of ["ru", "en"] as const) {
    input.locale = locale;
    const section = reviewSection(createReviewHtml(input));
    assert.ok(section.includes("0 / 2"));
    assert.ok(section.includes(locale === "ru" ? "Не проверено" : "Not reviewed"));
    assert.ok(section.includes("Need the complete document."));
    assert.equal(section.includes(locale === "ru" ? "Команда считает верным" : "Marked correct by the team"), false);
    assert.ok(section.includes(locale === "ru" ? "Это не подтверждает полноту анализа" : "This does not confirm completeness"));
  }
});

test("empty extracted lists retain omissions and notes without synthesizing assessment rows", () => {
  const input = fixture();
  input.assessment.requirements = [];
  input.assessment.deadlines = [];
  input.review.requirements = [];
  input.review.deadlines = [];
  for (const locale of ["ru", "en"] as const) {
    input.locale = locale;
    const section = reviewSection(createReviewHtml(input));
    assert.ok(section.includes("0 / 0"));
    assert.ok(section.includes(locale === "ru" ? "Нет найденных требований для проверки" : "No extracted requirements to review"));
    assert.ok(section.includes(locale === "ru" ? "Нет найденных сроков для проверки" : "No extracted deadlines to review"));
    assert.ok(section.includes(input.review.omissions));
    assert.ok(section.includes(input.review.notes));
    assert.ok(section.includes(locale === "ru" ? "они не добавлены в найденные требования или сроки" : "these have not been added to the extracted requirements or deadlines"));
    assert.equal(input.assessment.requirements.length, 0);
    assert.equal(input.assessment.deadlines.length, 0);
  }
});

test("export rejects misaligned review arrays through the packet validator", () => {
  const input = fixture();
  input.review.requirements = [];
  assert.throws(() => createReviewHtml(input));
  const extra = fixture();
  extra.review.deadlines.push({ verdict: "correct", note: "Wrong row." });
  assert.throws(() => createReviewHtml(extra));
});
