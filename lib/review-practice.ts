import { createEmptyReview, createReviewPacket, type ReviewPacket } from "./assessment-review";
import { DEMO_COMPANY, getSampleTender } from "./demo-data";
import type { Locale } from "./i18n";
import { analyzeDemoTender } from "./mock-analysis";

export type PracticeReviews = {
  sourceText: string;
  left: { name: string; packet: ReviewPacket };
  right: { name: string; packet: ReviewPacket };
};

/** Fixed fictional exercise, generated locally without a model or real reviewer. */
export function createPracticeReviews(locale: Locale): PracticeReviews {
  if (locale !== "ru" && locale !== "en") throw new Error("Unsupported practice language");
  const tr = (english: string, russian: string) => locale === "ru" ? russian : english;
  const sourceText = getSampleTender(locale);
  const assessment = analyzeDemoTender(sourceText, locale, DEMO_COMPANY);
  const left = createEmptyReview(assessment);
  const right = createEmptyReview(assessment);
  const teachingNotice = tr(
    "Fictional teaching example. The marks are prefilled to demonstrate report review. They are not feedback from real participants, an expert opinion, an answer key, or a measurement of AI accuracy.",
    "Вымышленный учебный пример. Отметки заполнены заранее для знакомства с проверкой отчёта. Это не отзывы реальных участников, не экспертное заключение, не эталон правильных ответов и не измерение точности ИИ.",
  );
  left.notes = `${tr("Example A", "Пример А")}. ${teachingNotice}`;
  right.notes = `${tr("Example B", "Пример Б")}. ${teachingNotice}`;

  // Two matching marks illustrate agreement, not proof that a conclusion is correct.
  const licenseNote = tr(
    "Teaching mark: compare the quoted license requirement with the fictional profile and discuss what still needs verification.",
    "Учебная отметка: сопоставьте цитату о лицензии с вымышленным профилем и обсудите, что ещё требует проверки.",
  );
  left.requirements[0] = { verdict: "correct", note: licenseNote };
  right.requirements[0] = { verdict: "correct", note: licenseNote };
  const deadlineNote = tr(
    "Teaching mark: find the application deadline in the full sample text and compare the date, time and timezone.",
    "Учебная отметка: найдите крайний срок подачи в полном тексте примера и сопоставьте дату, время и часовой пояс.",
  );
  left.deadlines[0] = { verdict: "correct", note: deadlineNote };
  right.deadlines[0] = { verdict: "correct", note: deadlineNote };

  // Deliberately different prefilled views invite a discussion of the same evidence.
  left.requirements[1] = {
    verdict: "correct",
    note: tr(
      "Example A: this prefilled mark accepts the explanation. Discuss whether the cited submission period supports it; do not treat this mark as the answer.",
      "Пример А: эта заранее заполненная отметка принимает объяснение. Обсудите, подтверждает ли его указанный период подачи; не считайте эту отметку ответом на задание.",
    ),
  };
  right.requirements[1] = {
    verdict: "unsure",
    note: tr(
      "Example B: this prefilled doubt invites a second reading of the expert opinion expiry date and the tender's submission period. Which evidence would resolve the doubt?",
      "Пример Б: это заранее заданное сомнение предлагает ещё раз сопоставить срок действия экспертного заключения и период подачи в тендере. Какие сведения помогут разобраться?",
    ),
  };
  left.requirements[3] = {
    verdict: "unsure",
    note: tr(
      "Teaching question: what information about the financial report would you request before reviewing this conclusion? Example B leaves this item unreviewed.",
      "Учебный вопрос: какие сведения о финансовом отчёте вы запросили бы перед проверкой этого вывода? В примере Б этот пункт ещё не проверен.",
    ),
  };
  left.omissions = tr(
    "Teaching question: does the report preserve the limits of the fictional sample? Read the complete source before proposing additions.",
    "Учебный вопрос: отражены ли в отчёте ограничения вымышленного примера? Прочитайте полный исходный текст, прежде чем предлагать дополнения.",
  );
  right.omissions = tr(
    "Teaching question: which details are absent from the sample itself? Do not invent them when discussing possible omissions in the report.",
    "Учебный вопрос: каких сведений нет в самом примере? Не придумывайте их при обсуждении возможных пропусков в отчёте.",
  );

  const original = {
    assessment,
    companyProfile: DEMO_COMPANY,
    mode: "demo" as const,
    analyzedAt: "2026-09-24T10:00:00+05:00",
    locale,
  };
  return Object.freeze({
    sourceText,
    left: Object.freeze({
      name: `practice-a-${locale}.json`,
      packet: createReviewPacket({ ...original, review: left, reviewedAt: "2026-09-24T10:15:00+05:00" }),
    }),
    right: Object.freeze({
      name: `practice-b-${locale}.json`,
      packet: createReviewPacket({ ...original, review: right, reviewedAt: "2026-09-24T10:30:00+05:00" }),
    }),
  });
}
