import type { Locale } from "./i18n";
import type { Requirement } from "./types";

/** Historical reports retain their original interpretation and counts. */
export function countsTowardQualification(requirement: Pick<Requirement, "kind">): boolean {
  return requirement.kind === undefined || requirement.kind === "qualification" || requirement.kind === "unclear";
}

export function getRequirementKindLabel(kind: Requirement["kind"], locale: Locale): string {
  const labels = {
    qualification: ["Bid requirement", "Требование к заявке"],
    contract_obligation: ["Contract performance", "Исполнение договора"],
    evaluation_criterion: ["Evaluation criterion", "Критерий оценки"],
    exemption: ["Exemption", "Исключение"],
    unclear: ["Applicability unclear", "Применимость неясна"],
  };
  return kind ? labels[kind][locale === "ru" ? 1 : 0] : locale === "ru" ? "Тип не указан" : "Type not recorded";
}

export function getRequirementStatusLabel(requirement: Pick<Requirement, "kind" | "status">, locale: Locale): string {
  if (!countsTowardQualification(requirement)) {
    const labels = {
      contract_obligation: ["Review performance", "Проверить исполнение"],
      evaluation_criterion: ["Review criterion", "Проверить критерий"],
      exemption: ["Not required by clause", "Не требуется по условию"],
    };
    return labels[requirement.kind as keyof typeof labels][locale === "ru" ? 1 : 0];
  }
  const labels = { met: ["Met", "Выполнено"], missing: ["Missing", "Отсутствует"], at_risk: ["At risk", "Есть риск"], unknown: ["Unknown", "Нет данных"] };
  return labels[requirement.status][locale === "ru" ? 1 : 0];
}
