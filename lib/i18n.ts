import { COMPANY_EVIDENCE, DEMO_COMPANY, UNKNOWN_COMPANY_EVIDENCE } from "./demo-data";

export type Locale = "ru" | "en";
export const LOCALE_COOKIE = "saqtender_locale";
export function resolveLocale(value?: string): Locale { return value === "en" ? "en" : "ru"; }
export function translate(locale: Locale, english: string, russian: string): string { return locale === "ru" ? russian : english; }

const documentTitles: Record<string, string> = {
  "construction-license": "Лицензия на строительство",
  "expert-opinion": "Экспертное заключение",
  "financial-report": "Финансовый отчёт",
  "work-experience": "Подтверждение опыта работы",
  "manufacturer-registry": "Реестр производителей",
};
export function getDocumentTitle(id: string, locale: Locale): string {
  const document = DEMO_COMPANY.documents.find(item => item.id === id);
  return locale === "ru" ? documentTitles[id] ?? document?.title ?? id : document?.title ?? id;
}

/** Translate only trusted, known company-profile strings. Tender quotes are never translated. */
export function translateCompanyEvidence(text: string, locale: Locale): string {
  if (locale === "en") return text;
  if (text === UNKNOWN_COMPANY_EVIDENCE) return "Данные профиля компании не позволяют подтвердить выполнение этого требования.";
  const id = Object.keys(COMPANY_EVIDENCE).find(key => COMPANY_EVIDENCE[key] === text);
  const document = DEMO_COMPANY.documents.find(item => item.id === id);
  if (!id || !document) return text;
  const status = document.status === "active" ? "действует" : document.status === "missing" ? "отсутствует" : "не проверен";
  const date = (value: string) => value.split("-").reverse().join(".");
  return `${getDocumentTitle(id, locale)}: ${status}${document.expiresAt ? `; срок действия до ${date(document.expiresAt)}` : ""}${document.updatedAt ? `; обновлён ${date(document.updatedAt)}` : ""}.`;
}
