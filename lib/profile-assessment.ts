import { getCompanyEvidence } from "./company-profile";
import { getDisclaimer } from "./demo-data";
import { validateGroundedAssessment } from "./grounding";
import type { Locale } from "./i18n";
import type { Assessment, CompanyProfile, Requirement } from "./types";

/** Applies supplied records only to our exact sample, never to arbitrary clauses. */
export function assessSampleProfile(base: Assessment, profile: CompanyProfile, tenderText: string, locale: Locale): Assessment {
  const tr = (en: string, ru: string) => locale === "ru" ? ru : en;
  const evidence = getCompanyEvidence(profile);
  const documentIds = ["construction-license", "expert-opinion", "work-experience", "financial-report"];
  const closing = base.deadlines.find(deadline => /Application deadline|Крайний срок подачи заявки/.test(deadline.tenderEvidence));
  const requirements: Requirement[] = base.requirements.map((requirement, index) => {
    const document = profile.documents.find(item => item.id === documentIds[index])!;
    let status: Requirement["status"] = "unknown";
    let explanation = tr("The profile records this document, but its contents, scope and authenticity have not been checked. Verify the original before relying on it.", "Документ указан в профиле, но его содержание, область действия и подлинность не проверены. Для подтверждения требования нужно проверить оригинал.");
    if (document.status === "missing") {
      status = "missing";
      explanation = tr("This required document is marked missing in your profile. Prepare the supporting evidence and check it against the full tender.", "Обязательный документ отмечен в вашем профиле как отсутствующий. Подготовьте подтверждение и сверьте его с полной документацией тендера.");
    } else if (document.status === "not_verified") {
      explanation = tr("The document's status is unverified in your profile. Check availability and contents before assessing this requirement.", "Статус документа в вашем профиле не проверен. Уточните его наличие и содержание, прежде чем оценивать выполнение требования.");
    } else if (index < 2 && closing && document.expiresAt && Date.parse(`${document.expiresAt}T23:59:59+05:00`) < Date.parse(closing.date)) {
      status = "at_risk";
      explanation = tr(`The recorded expiry (${document.expiresAt}) is earlier than the application deadline. Check renewal and the tender's validity conditions.`, `Указанный срок действия (${document.expiresAt}) заканчивается раньше срока подачи заявки. Проверьте обновление документа и условия тендера о сроке действия.`);
    }
    return { ...requirement, companyEvidence: evidence[document.id], status, explanation };
  });
  const missing = requirements.filter(item => item.status === "missing").length;
  const atRisk = requirements.filter(item => item.status === "at_risk").length;
  return validateGroundedAssessment({
    ...base,
    requirements,
    overallRisk: missing ? "high" : atRisk ? "medium" : "unknown",
    summary: tr(
      `The sample was checked against your company profile using demo rules. Missing documents: ${missing}; date risks: ${atRisk}. Other records require verification of the originals. No live AI call or official eligibility check was performed.`,
      `Образец сопоставлен с вашим профилем компании по правилам деморежима. Отсутствующих документов: ${missing}; рисков по датам: ${atRisk}. Остальные записи требуют проверки оригиналов. Запрос к ИИ и официальная проверка допуска не выполнялись.`,
    ),
    actions: [
      ...requirements.map(requirement => ({
        priority: requirement.status === "missing" ? "critical" as const : requirement.status === "at_risk" ? "high" as const : "medium" as const,
        title: `${tr("Review", "Проверьте")}: ${requirement.title}`,
        description: requirement.explanation,
      })),
      base.actions[1],
    ].filter(Boolean),
    disclaimer: getDisclaimer(locale, false),
  }, tenderText, profile);
}
