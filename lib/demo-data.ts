import type { CompanyProfile } from "./types";
import type { Locale } from "./i18n";

export const DEMO_COMPANY: CompanyProfile = {
  name: "OrdaBuild Demo LLP",
  industry: "Construction and Engineering",
  isDemo: true,
  documents: [
    { id: "construction-license", title: "Construction License", status: "active", expiresAt: "2027-05-10", updatedAt: null },
    { id: "expert-opinion", title: "Expert Opinion", status: "active", expiresAt: "2026-10-05", updatedAt: null },
    { id: "financial-report", title: "Financial Report", status: "active", expiresAt: null, updatedAt: "2026-09-01" },
    { id: "work-experience", title: "Work Experience Confirmation", status: "missing", expiresAt: null, updatedAt: null },
    { id: "manufacturer-registry", title: "Manufacturer Registry", status: "not_verified", expiresAt: null, updatedAt: null },
  ],
};

export const DISCLAIMER = "Decision support only. This assessment compares the provided tender text with a fictional demo company profile. Official eligibility is not verified. Check the complete tender, original documents, and official sources before making a procurement decision. Draft alerts are not scheduled or sent.";

export const DISCLAIMER_RU = "Инструмент поддержки решений. Оценка сопоставляет предоставленный текст тендера с профилем вымышленной компании. Официальное право на участие не проверено. Перед принятием решения изучите полную документацию тендера, оригиналы документов и официальные источники. Черновики напоминаний не запланированы и не отправляются.";

export function getDisclaimer(locale: Locale): string {
  return locale === "ru" ? DISCLAIMER_RU : DISCLAIMER;
}

export const SAMPLE_REQUIREMENTS = {
  license: "The bidder must hold an active construction license.",
  expert: "The bidder must provide an expert opinion valid during the submission period through the application deadline.",
  experience: "Confirmed relevant work experience is mandatory and must be supported by work experience confirmation documents.",
  financial: "The bidder must provide current financial documentation, including its most recently updated financial report.",
} as const;

export const SAMPLE_TENDER = `FICTIONAL DEMO TENDER — NOT AN OFFICIAL PROCUREMENT NOTICE
Reference: DEMO-SCHOOL-2026-014
Project: Construction of a 300-seat school in the Astana region
Buyer: Fictional Education Infrastructure Department

Scope
Construction and engineering works for a new school, including structural works, internal utilities, and site improvements. This notice and all parties are fictional and are provided for demonstration only.

Submission period and deadlines
Submission opens: 2026-09-20 09:00 Asia/Almaty.
Application deadline: 2026-09-29 10:00 Asia/Almaty.
Bid security deadline: 2026-09-26 18:00 Asia/Almaty.

Mandatory qualification documents
1. ${SAMPLE_REQUIREMENTS.license}
2. ${SAMPLE_REQUIREMENTS.expert}
3. ${SAMPLE_REQUIREMENTS.experience}
4. ${SAMPLE_REQUIREMENTS.financial}

Submission rule
Missing mandatory documents may cause rejection of the application. The buyer will verify all submitted evidence against the official tender documentation.

Demonstration note
No connection to procurement registries is provided. No official eligibility decision or legal advice is offered.`;

export const SAMPLE_REQUIREMENTS_RU = {
  license: "Участник должен иметь действующую строительную лицензию.",
  expert: "Участник должен предоставить экспертное заключение, действующее в течение периода подачи заявок до крайнего срока их подачи включительно.",
  experience: "Подтверждённый опыт выполнения аналогичных работ обязателен и должен быть подкреплён документами, подтверждающими опыт работ.",
  financial: "Участник должен предоставить актуальную финансовую документацию, включая последний обновлённый финансовый отчёт.",
} as const;

export const SAMPLE_TENDER_RU = `ВЫМЫШЛЕННЫЙ ДЕМО-ТЕНДЕР — НЕ ОФИЦИАЛЬНОЕ ОБЪЯВЛЕНИЕ О ЗАКУПКЕ
Номер: DEMO-SCHOOL-2026-014
Проект: Строительство школы на 300 мест в районе Астаны
Заказчик: Вымышленное управление образовательной инфраструктуры

Предмет работ
Строительные и инженерные работы для новой школы, включая возведение конструкций, внутренние инженерные сети и благоустройство территории. Объявление и все его участники вымышлены и приведены только для демонстрации.

Период подачи заявок и сроки
Начало подачи заявок: 2026-09-20 09:00 Asia/Almaty.
Крайний срок подачи заявки: 2026-09-29 10:00 Asia/Almaty.
Крайний срок внесения обеспечения заявки: 2026-09-26 18:00 Asia/Almaty.

Обязательные квалификационные документы
1. ${SAMPLE_REQUIREMENTS_RU.license}
2. ${SAMPLE_REQUIREMENTS_RU.expert}
3. ${SAMPLE_REQUIREMENTS_RU.experience}
4. ${SAMPLE_REQUIREMENTS_RU.financial}

Правило подачи заявки
Отсутствие обязательных документов может привести к отклонению заявки. Заказчик проверит все представленные подтверждения по официальной тендерной документации.

Примечание к демонстрации
Подключение к реестрам закупок отсутствует. Сервис не принимает официальных решений о допуске к участию и не предоставляет юридических консультаций.`;

export function getSampleTender(locale: Locale): string {
  return locale === "ru" ? SAMPLE_TENDER_RU : SAMPLE_TENDER;
}

export const UNKNOWN_COMPANY_EVIDENCE = "The provided company profile does not establish this requirement.";

export const COMPANY_EVIDENCE = Object.fromEntries(DEMO_COMPANY.documents.map((document) => [
  document.id,
  `${document.title}: ${document.status === "active" ? "Active" : document.status === "missing" ? "Missing" : "Not Verified"}${document.expiresAt ? `; expires ${document.expiresAt}` : ""}${document.updatedAt ? `; updated ${document.updatedAt}` : ""}.`,
])) as Record<string, string>;
