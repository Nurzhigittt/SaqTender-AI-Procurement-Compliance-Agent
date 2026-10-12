import { z } from "zod";
import { createDraftAlerts } from "./alerts";
import { getDisclaimer } from "./demo-data";
import { explicitDatesInEvidence, validateGroundedAssessment } from "./grounding";
import type { Locale } from "./i18n";
import { resolveFindingQuote } from "./source-evidence";
import { DeadlineSchema, RequirementSchema, type Action, type Assessment, type CompanyProfile, type Requirement } from "./types";

const UnresolvedDeadlineSchema = z.object({
  tenderEvidence: z.string().min(1).max(2000),
  reason: z.enum(["missing_timezone", "missing_time", "invalid_date", "ambiguous"]),
}).strict();

/** Internal findings after references resolve; summary, risk, actions and alerts are server output. */
export const LiveFindingsSchema = z.object({
  requirements: z.array(RequirementSchema.extend({
    clauseState: z.enum(["unambiguous", "conflicting", "conditional"]),
    conflictingEvidence: z.string().min(1).max(2000).nullable(),
  }).strict()).max(60).describe("Complete list of applicable document and qualification conditions, including met and unknown findings. A required document valid at a deadline is a requirement even when its recorded expiry covers that day. Do not return only missing or at-risk items."),
  deadlines: z.array(DeadlineSchema).max(30),
  unresolvedDeadlines: z.array(UnresolvedDeadlineSchema).max(30),
}).strict();

export type LiveFindings = z.infer<typeof LiveFindingsSchema>;

function excerpt(quote: string): string {
  return quote.length <= 400 ? quote : `${quote.slice(0, 399)}…`;
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
    const { clauseState, conflictingEvidence, ...rawRequirement } = finding;
    const requirement = { ...rawRequirement, tenderEvidence: resolveFindingQuote(rawRequirement.tenderEvidence, tenderText) };
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
        title: tr(`Conditional requirement ${index + 1}`, `Условное требование ${index + 1}`),
        status: "unknown",
        explanation: tr(
          `It has not been established whether this condition applies to the company. Verify applicability before assessing compliance: «${excerpt(requirement.tenderEvidence)}»`,
          `Не установлено, применяется ли это условие к компании. Уточните применимость, прежде чем оценивать выполнение: «${excerpt(requirement.tenderEvidence)}»`,
        ),
      };
    }
    return requirement;
  });
  const unresolvedDeadlines = findings.unresolvedDeadlines.map(item => {
    const restored = { ...item, tenderEvidence: resolveFindingQuote(item.tenderEvidence, tenderText) };
    return { ...restored, reason: resolveUnresolvedDeadlineReason(restored, tenderText) };
  });

  const missing = requirements.filter(item => item.status === "missing").length;
  const atRisk = requirements.filter(item => item.status === "at_risk").length;
  const unknown = requirements.filter(item => item.status === "unknown").length;
  const unresolved = unresolvedDeadlines.length;
  const overallRisk: Assessment["overallRisk"] = missing ? "high" : atRisk ? "medium" : unknown || unresolved || !requirements.length ? "unknown" : "low";

  const actions: Action[] = requirements.flatMap((requirement, index) => {
    if (requirement.status === "met") return [];
    const finding = findings.requirements[index];
    const isMissing = requirement.status === "missing";
    return [{
      priority: isMissing ? "critical" as const : requirement.status === "at_risk" ? "high" as const : "medium" as const,
      title: isMissing
        ? tr(`Prepare evidence for requirement ${index + 1}`, `Подготовьте подтверждение требования ${index + 1}`)
        : tr(`Verify requirement ${index + 1}`, `Проверьте требование ${index + 1}`),
      description: finding.clauseState !== "unambiguous" ? requirement.explanation : isMissing
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
      `Confirm this passage against the complete tender before creating a reminder. No exact deadline or reminder was created from it: «${excerpt(item.tenderEvidence)}»`,
      `Уточните этот фрагмент по полной документации тендера перед созданием напоминания. Точный срок и напоминание по нему не созданы: «${excerpt(item.tenderEvidence)}»`,
    ),
  })));

  // Ordinary clear findings retain the original strict evidence/status checks.
  return validateGroundedAssessment({
    summary: tr(
      `Tender requirements found: ${requirements.length}. Requirements linked to missing records: ${missing}; at-risk requirements: ${atRisk}; requirements needing clarification: ${unknown}. Exact deadlines: ${findings.deadlines.length}; deadline passages needing clarification: ${unresolved}. The assessment uses only the supplied text and profile records; official eligibility has not been checked.`,
      `Выявлено требований тендера: ${requirements.length}. Требований с отсутствующим подтверждением в профиле: ${missing}; требований с риском: ${atRisk}; требований для уточнения: ${unknown}. Точных сроков: ${findings.deadlines.length}; фрагментов о сроках для уточнения: ${unresolved}. Оценка использует только предоставленный текст и записи профиля; официальный допуск не проверен.`,
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
