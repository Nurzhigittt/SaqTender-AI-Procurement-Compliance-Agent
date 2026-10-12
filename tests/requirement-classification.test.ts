import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyReview, createReviewJson, createReviewPacket, type ReviewPacketInput } from "../lib/assessment-review";
import { getCompanyEvidence } from "../lib/company-profile";
import { DEMO_COMPANY, UNKNOWN_COMPANY_EVIDENCE } from "../lib/demo-data";
import { buildLiveAssessment, LiveFindingsSchema, type LiveFindings } from "../lib/live-findings";
import { ReferencedFindingsSchema, resolveReferencedFindings } from "../lib/referenced-findings";
import { countsTowardQualification } from "../lib/requirement-kind";
import { createReportHtml, escapeReportHtml } from "../lib/report-export";
import { compareReviews, ReviewComparisonError } from "../lib/review-comparison";
import { createComparisonHtml } from "../lib/review-comparison-export";
import { parseReviewFile } from "../lib/review-import";
import { createReviewHtml } from "../lib/review-report";
import { createTenderFragments, type SourceReference, type TenderFragment } from "../lib/tender-fragments";
import { AssessmentSchema, type Assessment } from "../lib/types";

const evidence = getCompanyEvidence(DEMO_COMPANY);
const required = "The bidder must provide work experience confirmation.";
const waived = "Квалификационное требование в части наличия опыта работы не\nпредъявляется.";
const postAward = "Условия к поставщику в случае определения его победителем и заключения с ним договора. Отклонение за непредставление этих сведений не допускается.";
type Finding = LiveFindings["requirements"][number];

function finding(changes: Partial<Finding> = {}): Finding {
  return {
    title: "Work experience", status: "missing", tenderEvidence: required,
    companyEvidence: evidence["work-experience"], explanation: "The profile record is missing.",
    kind: "qualification", contextEvidence: null, clauseState: "unambiguous", conflictingEvidence: null,
    ...changes,
  };
}

function findings(requirements: Finding[]): LiveFindings {
  return { requirements, deadlines: [], unresolvedDeadlines: [] };
}

function reviewInput(assessment: Assessment): ReviewPacketInput {
  return {
    assessment, companyProfile: structuredClone(DEMO_COMPANY), mode: "live", locale: "ru",
    analyzedAt: "2026-10-12T05:30:00.000Z", reviewedAt: "2026-10-12T06:00:00.000Z",
    review: { ...createEmptyReview(assessment), notes: "Проверить область применения по исходнику." },
  };
}

function referenceFor(quote: string, source: string, fragments: TenderFragment[]): SourceReference {
  const start = source.indexOf(quote);
  assert.ok(start >= 0);
  const end = start + quote.length;
  const first = fragments.find(fragment => fragment.start <= start && start < fragment.end);
  const last = fragments.find(fragment => fragment.start < end && end <= fragment.end);
  assert.ok(first && last);
  return { startFragment: first.id, endFragment: last.id };
}

test("a classified experience exemption stays visible without a missing qualification or preparation action", () => {
  const result = buildLiveAssessment(findings([finding({ kind: "exemption", tenderEvidence: waived, contextEvidence: waived })]), waived, DEMO_COMPANY, "ru");
  assert.equal(result.requirements.length, 1);
  assert.equal(result.requirements[0].kind, "exemption");
  assert.equal(result.requirements[0].status, "unknown");
  assert.equal(result.requirements[0].tenderEvidence, waived);
  assert.equal(result.requirements[0].contextEvidence, waived);
  assert.equal(result.overallRisk, "unknown");
  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.alerts, []);
  assert.equal(result.officialEligibilityVerified, false);
});

test("an explicit waiver mislabeled as qualification becomes unclear but cannot suppress a separate mandatory missing item", () => {
  const source = `${waived}\n${required}`;
  const result = buildLiveAssessment(findings([
    finding({ tenderEvidence: waived }), finding(),
  ]), source, DEMO_COMPANY, "en");
  assert.deepEqual(result.requirements.map(item => [item.kind, item.status]), [["unclear", "unknown"], ["qualification", "missing"]]);
  assert.equal(result.overallRisk, "high");
  assert.equal(result.actions.filter(item => item.priority === "critical").length, 1);
  assert.ok(result.actions.find(item => item.priority === "critical")!.description.includes(required));
  assert.equal(result.actions[0].priority, "medium");
});

test("post-award context prevents a missing qualification even when the model labels it mandatory", () => {
  const clause = "Предоставить подтверждение обучения сотрудников.";
  const result = buildLiveAssessment(findings([finding({ tenderEvidence: clause, contextEvidence: postAward })]), `${postAward}\n${clause}`, DEMO_COMPANY, "ru");
  assert.equal(result.requirements[0].kind, "unclear");
  assert.equal(result.requirements[0].status, "unknown");
  assert.equal(result.overallRisk, "unknown");
  assert.equal(result.actions[0].priority, "medium");
});

test("contract obligations and scoring criteria retain context and receive separate noncritical actions", () => {
  const contract = "The contractor must provide trained personnel.";
  const scoring = "Experience information affects the evaluated tender price.";
  const source = `${postAward}\n${contract}\n${scoring}`;
  const result = buildLiveAssessment(findings([
    finding({ kind: "contract_obligation", tenderEvidence: contract, contextEvidence: postAward }),
    finding({ kind: "evaluation_criterion", tenderEvidence: scoring, contextEvidence: scoring }),
  ]), source, DEMO_COMPANY, "en");
  assert.ok(result.requirements.every(item => item.status === "unknown" && !countsTowardQualification(item)));
  assert.equal(result.overallRisk, "unknown");
  assert.deepEqual(result.actions.map(item => item.priority), ["medium", "low"]);
  assert.ok(result.actions[0].description.includes(postAward));
  assert.ok(result.actions[1].description.includes(scoring));
  assert.match(result.summary, /missing records: 0/);
});

test("tax-debt prohibition and minimum experience wording are not treated as exemption cues", () => {
  for (const clause of [
    "Поставщик должен не иметь налоговой задолженности выше установленного порога.",
    "Предоставить подтверждение опыта работы не менее трёх лет.",
    "Отсутствие обязательного подтверждения опыта не допускается.",
  ]) {
    const result = buildLiveAssessment(findings([finding({ tenderEvidence: clause })]), clause, DEMO_COMPANY, "ru");
    assert.equal(result.requirements[0].kind, "qualification", clause);
    assert.equal(result.requirements[0].status, "missing", clause);
    assert.equal(result.overallRisk, "high", clause);
  }
});

test("an active license record cannot establish category, activity scope or general compliance", () => {
  const clause = "Требуется лицензия III категории с подвидом монтажа лифтового оборудования.";
  const result = buildLiveAssessment(findings([finding({
    tenderEvidence: clause, companyEvidence: evidence["construction-license"], status: "met",
    explanation: "Компания полностью соответствует законодательству и допущена к закупке.",
  })]), clause, DEMO_COMPANY, "ru");
  assert.equal(result.requirements[0].status, "unknown");
  assert.equal(result.overallRisk, "unknown");
  assert.match(result.requirements[0].explanation, /категорию/);
  assert.doesNotMatch(result.requirements[0].explanation, /полностью соответствует|допущена/);
  assert.equal(result.requirements[0].companyEvidence, evidence["construction-license"]);
});

test("ordinary impossible positive claims still reject before conservative status downgrades", () => {
  for (const companyEvidence of [evidence["work-experience"], evidence["manufacturer-registry"], UNKNOWN_COMPANY_EVIDENCE]) {
    assert.throws(() => buildLiveAssessment(findings([finding({ status: "met", companyEvidence })]), required, DEMO_COMPANY, "en"), /Unsupported document-compliance claim/);
  }
});

test("an existing qualification date risk is not erased by the scope classification change", () => {
  const clause = "The construction license must remain valid at application closing.";
  const result = buildLiveAssessment(findings([finding({ tenderEvidence: clause, companyEvidence: evidence["construction-license"], status: "at_risk" })]), clause, DEMO_COMPANY, "en");
  assert.equal(result.requirements[0].status, "at_risk");
  assert.equal(result.overallRisk, "medium");
  assert.equal(result.actions[0].priority, "high");
});

test("classification cannot hide fabricated company evidence, even when its status is replaced", () => {
  for (const kind of ["qualification", "contract_obligation", "evaluation_criterion", "exemption", "unclear"] as const) {
    assert.throws(() => buildLiveAssessment(findings([finding({
      kind, contextEvidence: waived, tenderEvidence: waived,
      companyEvidence: "Work Experience Confirmation: Active; independently verified.",
    })]), waived, DEMO_COMPANY, "en"), /Ungrounded company evidence/, kind);
  }
});

test("nonqualification classifications require genuine bounded scope context", () => {
  for (const kind of ["contract_obligation", "evaluation_criterion", "exemption"] as const) {
    for (const contextEvidence of [null, "Invented governing context.", " ", "x".repeat(2001)]) {
      assert.throws(() => buildLiveAssessment(findings([finding({ kind, contextEvidence })]), `${required}\n${"x".repeat(2001)}`, DEMO_COMPANY, "en"), `${kind}: ${String(contextEvidence).slice(0, 30)}`);
    }
  }
});

test("distant context references restore original whitespace without joining unrelated middle passages", () => {
  const context = "Условия\u00a0для победителя:\r\nпосле заключения договора.";
  const clause = "Предоставить удостоверения\r\nобучения сотрудников.";
  const source = `${context}\n${"Промежуточные сведения.\n".repeat(130)}${clause}`;
  const fragments = createTenderFragments(source);
  const sourceReference = referenceFor(clause, source, fragments);
  const contextSourceReference = referenceFor(context, source, fragments);
  const modelRequirement = {
    title: "Обучение сотрудников", status: "unknown", companyEvidence: UNKNOWN_COMPANY_EVIDENCE,
    explanation: "Оригиналы не проверены.", kind: "contract_obligation", clauseState: "unambiguous",
    sourceReference, contextSourceReference, conflictingSourceReference: null,
  };
  const resolved = resolveReferencedFindings({ requirements: [modelRequirement], deadlines: [], unresolvedDeadlines: [] }, fragments, source);
  const result = buildLiveAssessment(resolved, source, DEMO_COMPANY, "ru");
  assert.equal(result.requirements[0].tenderEvidence, clause);
  assert.equal(result.requirements[0].contextEvidence, context);
  assert.ok(!result.requirements[0].contextEvidence!.includes("Промежуточные"));
  assert.ok(source.indexOf(clause) - context.length > 2000);
  for (const invalidReference of [
    { startFragment: 9999, endFragment: 9999 },
    { startFragment: sourceReference.endFragment, endFragment: contextSourceReference.startFragment },
    { startFragment: contextSourceReference.startFragment, endFragment: sourceReference.endFragment },
    { startFragment: 1.5, endFragment: 2 },
  ]) {
    assert.throws(() => resolveReferencedFindings({ requirements: [{ ...modelRequirement, contextSourceReference: invalidReference }], deadlines: [], unresolvedDeadlines: [] }, fragments, source));
  }
});

test("live and model contracts require classification and context slots while old public reports remain readable", () => {
  const live = finding();
  for (const key of ["kind", "contextEvidence"] as const) {
    const incomplete: Record<string, unknown> = { ...live };
    delete incomplete[key];
    assert.equal(LiveFindingsSchema.safeParse({ ...findings([]), requirements: [incomplete] }).success, false);
  }
  const { tenderEvidence: _tender, conflictingEvidence: _conflict, contextEvidence: _context, ...modelBase } = live;
  const model = { ...modelBase, sourceReference: { startFragment: 1, endFragment: 1 }, conflictingSourceReference: null, contextSourceReference: null };
  assert.equal(ReferencedFindingsSchema.safeParse({ ...findings([]), requirements: [model] }).success, true);
  for (const key of ["kind", "contextSourceReference"] as const) {
    const incomplete: Record<string, unknown> = { ...model };
    delete incomplete[key];
    assert.equal(ReferencedFindingsSchema.safeParse({ ...findings([]), requirements: [incomplete] }).success, false);
  }
  assert.equal(ReferencedFindingsSchema.safeParse({ ...findings([]), requirements: [{ ...model, contextEvidence: required }] }).success, false);
});

test("conflicting and conditional clauses take precedence over an exemption or contract classification", () => {
  const source = `${required}\n${waived}`;
  const conflict = buildLiveAssessment(findings([finding({
    kind: "exemption", contextEvidence: waived, clauseState: "conflicting", conflictingEvidence: waived,
  })]), source, DEMO_COMPANY, "en");
  assert.equal(conflict.requirements[0].kind, "unclear");
  assert.equal(conflict.requirements[0].conflictingEvidence, waived);
  assert.equal(conflict.requirements[0].status, "unknown");
  assert.equal(conflict.actions.length, 1);
  assert.equal(conflict.overallRisk, "unknown");
  for (const kind of ["exemption", "contract_obligation"] as const) {
    const conditional = buildLiveAssessment(findings([finding({ kind, contextEvidence: waived, clauseState: "conditional" })]), source, DEMO_COMPANY, "en");
    assert.equal(conditional.requirements[0].kind, "unclear");
    assert.equal(conditional.requirements[0].status, "unknown");
    assert.equal(conditional.actions[0].priority, "medium");
    assert.equal(conditional.overallRisk, "unknown");
  }
});

test("conditional exemption wording is not presented as an unconditional waiver even when the model claims unambiguous", () => {
  for (const clause of [
    "Подтверждение опыта не требуется, если поставщик относится к категории X.",
    "Подтверждение опыта не требуется при условии привлечения сертифицированного субподрядчика.",
    "Experience evidence is not required unless the works exceed the stated threshold.",
  ]) {
    const result = buildLiveAssessment(findings([finding({ kind: "exemption", tenderEvidence: clause, contextEvidence: clause })]), clause, DEMO_COMPANY, "en");
    assert.equal(result.requirements[0].kind, "unclear", clause);
    assert.equal(result.requirements[0].status, "unknown");
    assert.equal(result.actions[0].priority, "medium");
  }
});

test("legacy review-v1 packets round-trip without inventing applicability fields or changing assessment bytes", () => {
  const legacy = buildLiveAssessment(findings([finding()]), required, DEMO_COMPANY, "en");
  delete legacy.requirements[0].kind;
  delete legacy.requirements[0].contextEvidence;
  const before = JSON.stringify(AssessmentSchema.parse(legacy));
  const input = reviewInput(legacy);
  const restored = parseReviewFile(createReviewJson(input));
  assert.equal(restored.schemaVersion, "saqtender-review-v1");
  assert.equal(JSON.stringify(restored.assessment), before);
  assert.equal(Object.hasOwn(restored.assessment.requirements[0], "kind"), false);
  assert.equal(Object.hasOwn(restored.assessment.requirements[0], "contextEvidence"), false);
  assert.doesNotThrow(() => compareReviews(createReviewPacket(input), restored));
});

test("classification and scope context form part of review comparison identity", () => {
  const result = buildLiveAssessment(findings([finding({ kind: "exemption", tenderEvidence: waived, contextEvidence: waived })]), waived, DEMO_COMPANY, "ru");
  const input = reviewInput(result);
  const original = createReviewPacket(input);
  const restored = parseReviewFile(createReviewJson(input));
  assert.equal(restored.assessment.requirements[0].kind, "exemption");
  assert.equal(restored.assessment.requirements[0].contextEvidence, waived);
  assert.equal(restored.review.requirements.length, 1);
  for (const mutate of [
    (assessment: Assessment) => { assessment.requirements[0].kind = "contract_obligation"; },
    (assessment: Assessment) => { assessment.requirements[0].contextEvidence = `${waived} `; },
  ]) {
    const changed = structuredClone(input);
    mutate(changed.assessment);
    assert.throws(() => compareReviews(original, createReviewPacket(changed)), error => error instanceof ReviewComparisonError && error.code === "mismatched_report");
  }
});

test("report, manual review and comparison exports preserve escaped governing context and classification", () => {
  const context = `${postAward}\n<scope> & original context`;
  const clause = "Исполнитель должен представить подтверждение обучения персонала.";
  const result = buildLiveAssessment(findings([finding({
    kind: "contract_obligation", contextEvidence: context, tenderEvidence: clause,
  })]), `${context}\n${clause}`, DEMO_COMPANY, "ru");
  const input = reviewInput(result);
  const packet = createReviewPacket(input);
  const htmls = [
    createReportHtml(input), createReviewHtml(input),
    createComparisonHtml({ left: packet, right: packet, leftName: "first.json", rightName: "second.json", comparedAt: input.reviewedAt }),
  ];
  for (const html of htmls) {
    assert.ok(html.includes(escapeReportHtml(context)));
    assert.ok(html.includes("Контекст применения"));
    assert.ok(html.includes("Исполнение договора"));
    assert.ok(html.includes("Проверить исполнение"));
    assert.ok(!html.includes("<scope>"));
  }
});
