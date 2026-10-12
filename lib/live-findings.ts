import { z } from "zod";
import { createDraftAlerts } from "./alerts";
import { getDisclaimer } from "./demo-data";
import { explicitDatesInEvidence, validateGroundedAssessment, validateRequirementCompanyEvidence } from "./grounding";
import type { Locale } from "./i18n";
import { countsTowardQualification } from "./requirement-kind";
import { resolveFindingQuote } from "./source-evidence";
import { DeadlineSchema, RequirementSchema, RequirementKindSchema, type Action, type Assessment, type CompanyProfile, type Requirement } from "./types";

const UnresolvedDeadlineSchema = z.object({
  tenderEvidence: z.string().min(1).max(2000),
  reason: z.enum(["missing_timezone", "missing_time", "invalid_date", "ambiguous"]),
}).strict();

/** Internal findings after references resolve; summary, risk, actions and alerts are server output. */
export const LiveFindingsSchema = z.object({
  requirements: z.array(RequirementSchema.extend({
    kind: RequirementKindSchema.describe("Classify applicability: qualification is a mandatory bid/document condition; contract_obligation applies after award/signing; evaluation_criterion affects scoring/price; exemption explicitly waives a condition; unclear means applicability cannot be established. Never turn an exemption into a missing requirement."),
    contextEvidence: z.string().min(1).max(2000).nullable(),
    clauseState: z.enum(["unambiguous", "conflicting", "conditional"]),
    conflictingEvidence: z.string().min(1).max(2000).nullable(),
  }).strict()).max(60).describe("Complete list of document/qualification conditions, exemptions, evaluation criteria and post-award obligations, each classified with its governing context. Keep conditions even when records are present or unknown. A required document valid at a deadline remains a qualification condition."),
  deadlines: z.array(DeadlineSchema).max(30),
  unresolvedDeadlines: z.array(UnresolvedDeadlineSchema).max(30),
}).strict();

export type LiveFindings = z.infer<typeof LiveFindingsSchema>;

function excerpt(quote: string): string {
  return quote.length <= 400 ? quote : `${quote.slice(0, 399)}…`;
}

/** Cues only trigger conservative review; this is not a legal applicability parser. */
function hasApplicabilityCaution(text: string): boolean {
  return /не\s+(?:предъявля[ею]тся|требу[ею]тся)|\b(?:is|are)\s+not\s+required\b|\b(?:waived|post-award|after\s+(?:contract\s+)?(?:award|signing))\b|в\s+случае\s+определения.{0,100}победителем|после\s+заключения\s+договора/iu.test(text.replace(/\s+/gu, " "));
}

function resolveUnresolvedDeadlineReason(item: LiveFindings["unresolvedDeadlines"][number], tenderText: string): LiveFindings["unresolvedDeadlines"][number]["reason"] {
  if (!tenderText.includes(item.tenderEvidence)) throw new Error("Ungrounded finding evidence");
  const dates = [...new Set(explicitDatesInEvidence(item.tenderEvidence))];
  if (dates.length === 1) throw new Error("Unresolved deadline contains a unique explicit instant");

  // A reason selects clarification wording; it cannot establish a calendar fact.
  // Keep strict source/instant checks above, but use neutral wording when the
  // proposed reason is unsupported (e.g. a duration measured from contract signing).
  // Never guess a more specific reason, invent a timestamp, or drop the passage.
  const day = /\b\d{4}-\d{2}-\d{2}\b/.test(item.tenderEvidence);
  const time = /\b\d{4}-\d{2}-\d{2}[T\s]+\d{2}:\d{2}(?::\d{2})?\b/.test(item.tenderEvidence);
  const completeCandidate = /\b\d{4}-\d{2}-\d{2}[T\s]+\d{2}:\d{2}(?::\d{2})?\s*(?:Asia\/Almaty|Z|(?:UTC\s*)?[+-]\d{2}:\d{2})(?![\w/])/.test(item.tenderEvidence);
  if (item.reason === "missing_timezone" && (!day || !time || completeCandidate || dates.length)) {
    return "ambiguous";
  }
  if (item.reason === "missing_time" && (!day || time || dates.length)) {
    return "ambiguous";
  }
  if (item.reason === "invalid_date" && (!completeCandidate || dates.length)) {
    return "ambiguous";
  }
  return item.reason;
}

export function buildLiveAssessment(value: unknown, tenderText: string, profile: CompanyProfile, locale: Locale): Assessment {
  const findings = LiveFindingsSchema.parse(value);
  const tr = (en: string, ru: string) => locale === "ru" ? ru : en;
  const requirements: Requirement[] = findings.requirements.map((finding, index) => {
    const { clauseState, conflictingEvidence, contextEvidence, ...rawRequirement } = finding;
    const requirement: Requirement = {
      ...rawRequirement,
      tenderEvidence: resolveFindingQuote(rawRequirement.tenderEvidence, tenderText),
      ...(contextEvidence === null ? {} : { contextEvidence: resolveFindingQuote(contextEvidence, tenderText) }),
    };
    if (!countsTowardQualification(requirement) && !requirement.contextEvidence) throw new Error("Nonqualification finding needs applicability context");
    if (clauseState !== "conflicting" && conflictingEvidence !== null) {
      throw new Error("Unexpected conflicting evidence");
    }
    if (clauseState === "conflicting") {
      if (conflictingEvidence === null) throw new Error("Conflicting finding needs a second source quote");
      const sourceConflict = resolveFindingQuote(conflictingEvidence, tenderText);
      if (sourceConflict.trim() === requirement.tenderEvidence.trim()) {
        throw new Error("Conflicting finding needs distinct source quotes");
      }
      // Source provenance and distinctness are checked here. Semantic opposition is
      // the model's classification, not a fact established by a string comparison.
      return {
        ...requirement,
        kind: "unclear",
        conflictingEvidence: sourceConflict,
        title: tr(`Conflicting conditions for requirement ${index + 1}`, `Противоречивые условия требования ${index + 1}`),
        status: "unknown",
        explanation: tr(
          `Manually compare these two clauses and establish which applies. First: «${excerpt(requirement.tenderEvidence)}» Second: «${excerpt(sourceConflict)}»`,
          `Вручную сопоставьте два условия и установите, какое из них применяется. Первое: «${excerpt(requirement.tenderEvidence)}» Второе: «${excerpt(sourceConflict)}»`,
        ),
      };
    }
    if (clauseState === "conditional") {
      return {
        ...requirement,
        kind: "unclear",
        title: tr(`Conditional requirement ${index + 1}`, `Условное требование ${index + 1}`),
        status: "unknown",
        explanation: tr(
          `It has not been established whether this condition applies to the company. Verify applicability before assessing compliance: «${excerpt(requirement.tenderEvidence)}»`,
          `Не установлено, применяется ли это условие к компании. Уточните применимость, прежде чем оценивать выполнение: «${excerpt(requirement.tenderEvidence)}»`,
        ),
      };
    }
    if (requirement.kind === "exemption" && /\b(?:unless|only\s+if|provided\s+that|if)\b|(?:если|при\s+условии)/iu.test(`${requirement.tenderEvidence}\n${requirement.contextEvidence ?? ""}`)) {
      return {
        ...requirement, kind: "unclear", status: "unknown",
        explanation: tr("The exemption may depend on a condition that the profile does not establish. Verify whether it applies before treating the document as waived or mandatory.", "Исключение может зависеть от условия, которое профиль не подтверждает. Уточните применимость, прежде чем считать документ необязательным или обязательным."),
      };
    }
    if (!countsTowardQualification(requirement)) {
      const explanations = {
        exemption: tr("This passage is classified as an exemption. No missing qualification or preparation action is inferred from the company record. Verify the exemption and its scope in the complete tender.", "Фрагмент отнесён к исключениям. Отсутствующая запись профиля не превращает его в недостающее требование к заявке. Проверьте исключение и область его применения по полной документации."),
        evaluation_criterion: tr("This passage is classified as an evaluation/price criterion, not a mandatory bid requirement. Verify its effect on scoring separately; the profile does not establish entitlement to a price adjustment.", "Фрагмент отнесён к критериям оценки или цены. Он не учитывается как обязательное требование к заявке. Проверьте влияние на оценку отдельно; профиль не подтверждает право на ценовую корректировку."),
        contract_obligation: tr("This passage is classified as a contract-performance obligation. Review the governing context and required resources before performance; it is not counted as a missing bid qualification.", "Фрагмент отнесён к условиям исполнения договора. Проверьте контекст и необходимые ресурсы перед исполнением; он не учитывается как отсутствующее подтверждение для допуска к заявке."),
      };
      return { ...requirement, status: "unknown", explanation: explanations[requirement.kind as keyof typeof explanations] };
    }
    if (requirement.kind === "unclear" || hasApplicabilityCaution(`${requirement.tenderEvidence}\n${requirement.contextEvidence ?? ""}`)) {
      return {
        ...requirement, kind: "unclear", status: "unknown",
        explanation: tr("Applicability needs review: this passage may contain an exception or a condition applying at a different stage. Compare it with the governing context before treating a company record as missing or sufficient.", "Применимость требует проверки: во фрагменте может быть исключение или условие другого этапа. Сопоставьте его с контекстом, прежде чем считать документ недостающим или достаточным."),
      };
    }
    // Validate the original status first. A downgrade must not conceal invented
    // evidence or a positive compliance claim against a missing/unverified record.
    validateRequirementCompanyEvidence(requirement, profile);
    if (requirement.status === "met") {
      return {
        ...requirement, status: "unknown",
        explanation: tr("The profile records this document, but it does not establish its category, permitted activities, contents or authenticity. Verify the original and the complete requirement before confirming compliance.", "Документ указан в профиле, но запись не подтверждает категорию, разрешённые виды деятельности, содержание и подлинность. Проверьте оригинал и полное требование, прежде чем подтверждать соответствие."),
      };
    }
    return requirement;
  });
  const unresolvedDeadlines = findings.unresolvedDeadlines.map(item => {
    const restored = { ...item, tenderEvidence: resolveFindingQuote(item.tenderEvidence, tenderText) };
    return { ...restored, reason: resolveUnresolvedDeadlineReason(restored, tenderText) };
  });

  const qualifications = requirements.filter(countsTowardQualification);
  const otherConditions = requirements.length - qualifications.length;
  const missing = qualifications.filter(item => item.status === "missing").length;
  const atRisk = qualifications.filter(item => item.status === "at_risk").length;
  const unknown = qualifications.filter(item => item.status === "unknown").length;
  const unresolved = unresolvedDeadlines.length;
  const overallRisk: Assessment["overallRisk"] = missing ? "high" : atRisk ? "medium" : unknown || unresolved || !qualifications.length ? "unknown" : "low";

  const actions: Action[] = requirements.flatMap<Action>((requirement, index) => {
    if (requirement.status === "met" || requirement.kind === "exemption") return [];
    if (requirement.kind === "contract_obligation" || requirement.kind === "evaluation_criterion") {
      return [{
        priority: requirement.kind === "evaluation_criterion" ? "low" as const : "medium" as const,
        title: requirement.kind === "evaluation_criterion"
          ? tr(`Review evaluation criterion ${index + 1}`, `Проверьте критерий оценки ${index + 1}`)
          : tr(`Review contract obligation ${index + 1}`, `Проверьте условие исполнения ${index + 1}`),
        description: `${requirement.explanation} «${excerpt(requirement.tenderEvidence)}» ${tr("Context", "Контекст")}: «${excerpt(requirement.contextEvidence!)}»`,
      }];
    }
    const finding = findings.requirements[index];
    const isMissing = requirement.status === "missing";
    return [{
      priority: isMissing ? "critical" as const : requirement.status === "at_risk" ? "high" as const : "medium" as const,
      title: isMissing
        ? tr(`Prepare evidence for requirement ${index + 1}`, `Подготовьте подтверждение требования ${index + 1}`)
        : tr(`Verify requirement ${index + 1}`, `Проверьте требование ${index + 1}`),
      description: finding.clauseState !== "unambiguous" || requirement.kind === "unclear" ? requirement.explanation : isMissing
        ? tr(
          `The linked company record is marked missing. Check and prepare evidence for this tender requirement: «${excerpt(requirement.tenderEvidence)}»`,
          `Связанная запись профиля отмечена как отсутствующая. Проверьте и подготовьте подтверждение этого требования тендера: «${excerpt(requirement.tenderEvidence)}»`,
        )
        : tr(
          `Compare this requirement with the linked company record and original supporting documents: «${excerpt(requirement.tenderEvidence)}»`,
          `Сопоставьте это требование со связанной записью профиля и оригиналами подтверждающих документов: «${excerpt(requirement.tenderEvidence)}»`,
        ),
    }];
  });

  const deadlineReasons = {
    missing_timezone: tr("Confirm the deadline's time zone", "Уточните часовой пояс срока"),
    missing_time: tr("Confirm the deadline's time", "Уточните время срока"),
    invalid_date: tr("Verify the deadline's date and time", "Проверьте дату и время срока"),
    ambiguous: tr("Clarify the deadline", "Уточните срок"),
  };
  actions.push(...unresolvedDeadlines.map(item => ({
    priority: "medium" as const,
    title: deadlineReasons[item.reason],
    description: tr(
      `Compare this selected passage with the complete tender: it does not by itself establish one supported exact deadline. No reminder was created from this passage: «${excerpt(item.tenderEvidence)}»`,
      `Сопоставьте этот фрагмент с полной документацией: сам по себе он не задаёт однозначный точный срок в поддерживаемом формате. Напоминание по этому фрагменту не создано: «${excerpt(item.tenderEvidence)}»`,
    ),
  })));

  // Ordinary clear findings retain the original strict evidence/status checks.
  return validateGroundedAssessment({
    summary: tr(
      `Conditions found: ${requirements.length}. Bid requirements or unclear applicability: ${qualifications.length}; separately classified exemptions, evaluation criteria and contract obligations: ${otherConditions}. Bid requirements linked to missing records: ${missing}; at risk: ${atRisk}; needing clarification: ${unknown}. Exact deadlines: ${findings.deadlines.length}; deadline passages needing clarification: ${unresolved}. Classification needs review. Official eligibility has not been checked.`,
      `Выявлено условий: ${requirements.length}. Требований к заявке или условий с неясной применимостью: ${qualifications.length}; отдельно отмеченных исключений, критериев оценки и условий исполнения: ${otherConditions}. Требований к заявке с отсутствующим подтверждением: ${missing}; с риском: ${atRisk}; для уточнения: ${unknown}. Точных сроков: ${findings.deadlines.length}; фрагментов о сроках для уточнения: ${unresolved}. Классификация требует проверки. Официальный допуск не проверен.`,
    ),
    overallRisk,
    officialEligibilityVerified: false,
    requirements,
    deadlines: findings.deadlines,
    actions,
    alerts: createDraftAlerts(findings.deadlines, locale),
    disclaimer: getDisclaimer(locale, profile.isDemo),
  }, tenderText, profile);
}
