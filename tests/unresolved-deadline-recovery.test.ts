import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_COMPANY, UNKNOWN_COMPANY_EVIDENCE } from "../lib/demo-data";
import { buildLiveAssessment, type LiveFindings } from "../lib/live-findings";

// Hand-built contract regressions using excerpts from public announcement
// 15124281-1, lot 79745866-КРБС1, technical specification pp. 4–5.
// They are not a recorded model answer or an evaluation of extraction accuracy.
// Preserve the extracted source's spelling and line breaks in evidence.
const clauses = [
  {
    name: "contract-relative performance period with a partial calendar date",
    quote: "120 календарных дней со дня подписания договора, январь 2026 года",
  },
  {
    name: "month-only calendar date",
    quote: "январь 2026 года",
  },
  {
    name: "cleanup period relative to completion",
    quote: "По окончании работ, в течении 5-ти дней произвести уборку\nстроительного мусора и элементов разборки с места производства работ.",
  },
  {
    name: "warranty period relative to acceptance",
    quote: "Подрядчик несет ответственность за недостатки (дефекты) в\nвыполненных работах, обнаруженные в приделах не менее 18 месяцев\nгарантийного срока со дня подписания акта о приемке рабочей комиссией\nвыполненных работ.",
  },
] as const;

const reasons = ["missing_timezone", "missing_time", "invalid_date", "ambiguous"] as const;
const locales = ["ru", "en"] as const;

function findings(unresolvedDeadlines: LiveFindings["unresolvedDeadlines"]): LiveFindings {
  return { requirements: [], deadlines: [], unresolvedDeadlines };
}

for (const clause of clauses) {
  for (const reason of reasons) {
    for (const locale of locales) {
      test(`${clause.name}: ${reason} safely requests clarification in ${locale}`, () => {
        const input = findings([{ tenderEvidence: clause.quote, reason }]);
        const before = structuredClone(input);
        const profile = structuredClone(DEMO_COMPANY);
        const profileBefore = structuredClone(profile);
        const result = buildLiveAssessment(input, clause.quote, profile, locale);

        assert.deepEqual(result.requirements, []);
        assert.deepEqual(result.deadlines, []);
        assert.deepEqual(result.alerts, []);
        assert.equal(result.overallRisk, "unknown");
        assert.equal(result.officialEligibilityVerified, false);
        assert.equal(result.actions.length, 1);
        assert.equal(result.actions[0].priority, "medium");
        assert.equal(result.actions[0].title, locale === "ru" ? "Уточните срок" : "Clarify the deadline");
        assert.ok(result.actions[0].description.includes(clause.quote), "The exact source passage must remain available to the reviewer");
        assert.deepEqual(input, before, "Recovery must not rewrite the supplied model findings");
        assert.deepEqual(profile, profileBefore, "Recovery must not modify the company profile");
      });
    }
  }
}

for (const locale of locales) {
  test(`mixed qualification and unresolved periods retain all findings in ${locale}`, () => {
    const qualificationQuote = "Подрядчик должен иметь «Аттестат на право\nпроведения работ в области промышленной безопасности»с подвидом работ -\nмонтаж лифтового оборудования.";
    const qualification: LiveFindings["requirements"][number] = {
      title: "Industrial safety attestation for lift installation",
      tenderEvidence: qualificationQuote,
      companyEvidence: UNKNOWN_COMPANY_EVIDENCE,
      status: "unknown",
      explanation: "The supplied company records do not establish this attestation or its scope.",
      clauseState: "unambiguous",
      conflictingEvidence: null,
    };
    const input = findings(clauses.map((clause, index) => ({
      tenderEvidence: clause.quote,
      reason: reasons[index],
    })));
    input.requirements = [qualification];
    const before = structuredClone(input);
    const sourceText = [qualificationQuote, ...clauses.map(clause => clause.quote)].join("\n\n");
    const result = buildLiveAssessment(input, sourceText, DEMO_COMPANY, locale);

    assert.deepEqual(result.requirements, [{
      title: qualification.title,
      tenderEvidence: qualificationQuote,
      companyEvidence: UNKNOWN_COMPANY_EVIDENCE,
      status: "unknown",
      explanation: qualification.explanation,
    }]);
    assert.equal(result.actions.length, 1 + clauses.length);
    for (const quote of [qualificationQuote, ...clauses.map(clause => clause.quote)]) {
      assert.ok(result.actions.some(action => action.description.includes(quote)), "Recovery of one clause must not discard other findings");
    }
    assert.deepEqual(result.deadlines, []);
    assert.deepEqual(result.alerts, []);
    assert.equal(result.overallRisk, "unknown");
    assert.equal(result.officialEligibilityVerified, false);
    assert.deepEqual(input, before);
  });

  test(`recovery still rejects fabricated evidence for every reason in ${locale}`, () => {
    for (const reason of reasons) {
      const fabricatedQuote = "Выполнить работы в течение 90 дней после подписания договора.";
      assert.throws(() => buildLiveAssessment(
        findings([{ tenderEvidence: fabricatedQuote, reason }]),
        clauses[0].quote,
        DEMO_COMPANY,
        locale,
      ), /Ungrounded finding evidence/);
    }
  });

  test(`recovery still rejects a unique precise instant misclassified as unresolved in ${locale}`, () => {
    for (const reason of reasons) {
      const preciseQuote = "Срок подачи заявки: 2026-11-10 10:00 +05:00.";
      assert.throws(() => buildLiveAssessment(
        findings([{ tenderEvidence: preciseQuote, reason }]),
        preciseQuote,
        DEMO_COMPANY,
        locale,
      ), /unique explicit instant/);
    }
  });

  test(`a precise instant beyond the displayed excerpt still rejects recovery in ${locale}`, () => {
    const quote = `${"Контекст документа. ".repeat(30)}Срок подачи: 2026-11-10 10:00 +05:00.`;
    assert.ok(quote.indexOf("2026-11-10") > 400);
    for (const reason of reasons) {
      assert.throws(() => buildLiveAssessment(
        findings([{ tenderEvidence: quote, reason }]),
        quote,
        DEMO_COMPANY,
        locale,
      ), /unique explicit instant/);
    }
  });

  test(`recovery keeps the 2000-character evidence limit in ${locale}`, () => {
    const quote = `${clauses[0].quote}${" ".repeat(2001 - clauses[0].quote.length)}`;
    assert.equal(quote.length, 2001);
    assert.throws(() => buildLiveAssessment(
      findings([{ tenderEvidence: quote, reason: "missing_timezone" }]),
      quote,
      DEMO_COMPANY,
      locale,
    ), { name: "ZodError" });
  });
}
