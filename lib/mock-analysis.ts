import { createDraftAlerts } from "./alerts";
import { COMPANY_EVIDENCE, getDisclaimer, SAMPLE_REQUIREMENTS, SAMPLE_REQUIREMENTS_RU, SAMPLE_TENDER, SAMPLE_TENDER_RU, UNKNOWN_COMPANY_EVIDENCE } from "./demo-data";
import { explicitDatesInEvidence, validateGroundedAssessment } from "./grounding";
import type { Locale } from "./i18n";
import type { Action, Assessment, Deadline, Requirement } from "./types";

function textLines(text: string): string[] {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

/** Conservative, repeatable local demonstration; it never calls an AI model. */
export function analyzeDemoTender(tenderText: string, locale: Locale = "en"): Assessment {
  const tr = (english: string, russian: string) => locale === "ru" ? russian : english;
  const lines = textLines(tenderText);
  const deadlines: Deadline[] = [];
  const seenDeadlines = new Set<string>();
  for (const line of lines) {
    if (!/(?:\bdeadline\b|крайний срок|срок подачи|срок внесения|дедлайн)/i.test(line) || line.length > 2000) continue;
    const dates = explicitDatesInEvidence(line);
    if (dates.length !== 1) continue;
    const sourceTitle = /^\s*([^:\n]{1,190})\s*:/.exec(line)?.[1] ?? "Tender deadline";
    const sourceIdentity = `${sourceTitle.toLowerCase()}|${dates[0]}`;
    if (seenDeadlines.has(sourceIdentity)) continue;
    seenDeadlines.add(sourceIdentity);
    const title = /^(Application deadline|Крайний срок подачи заявки)$/i.test(sourceTitle)
      ? tr("Application deadline", "Крайний срок подачи заявки")
      : /^(Bid security deadline|Крайний срок внесения обеспечения заявки)$/i.test(sourceTitle)
        ? tr("Bid security deadline", "Крайний срок внесения обеспечения заявки")
        : locale === "ru" ? `Срок тендера ${deadlines.length + 1}` : sourceTitle;
    if (deadlines.some((item) => item.title === title && item.date === dates[0])) continue;
    deadlines.push({ title, date: dates[0], tenderEvidence: line });
    if (deadlines.length === 30) break;
  }

  const exactRussianSample = tenderText.trim() === SAMPLE_TENDER_RU.trim();
  const exactSample = tenderText.trim() === SAMPLE_TENDER.trim() || exactRussianSample;
  const sourceRequirements = exactRussianSample ? SAMPLE_REQUIREMENTS_RU : SAMPLE_REQUIREMENTS;
  const requirements: Requirement[] = [];
  const supported = [
    { text: sourceRequirements.license, title: tr("Active construction license", "Действующая строительная лицензия"), documentId: "construction-license", status: "met", explanation: tr("The demo profile records an active construction license expiring on 10 May 2027, after the stated application deadline. Its scope and authenticity still require official verification.", "В демо-профиле указана действующая строительная лицензия со сроком действия до 10 мая 2027 года — после крайнего срока подачи заявки. Область действия и подлинность лицензии всё ещё требуют официальной проверки.") },
    { text: sourceRequirements.expert, title: tr("Valid expert opinion", "Действующее экспертное заключение"), documentId: "expert-opinion", status: "met", explanation: tr("The recorded expert opinion expires on 5 October 2026, after submission closes on 29 September 2026. The short remaining validity is a renewal consideration, not a detected failure of the stated submission requirement.", "Указанный срок действия экспертного заключения — до 5 октября 2026 года, после завершения подачи заявок 29 сентября 2026 года. Небольшой оставшийся срок — повод запланировать обновление, а не выявленное нарушение условия о действительности в период подачи.") },
    { text: sourceRequirements.experience, title: tr("Confirmed relevant work experience", "Подтверждённый опыт аналогичных работ"), documentId: "work-experience", status: "missing", explanation: tr("Work Experience Confirmation is marked Missing in the fictional company profile. The tender requires this evidence, so preparation and verification are needed before submission.", "В профиле вымышленной компании документ о подтверждении опыта работ отмечен как отсутствующий. Тендер требует это подтверждение: документ необходимо подготовить и проверить до подачи заявки.") },
    { text: sourceRequirements.financial, title: tr("Current financial documentation", "Актуальная финансовая документация"), documentId: "financial-report", status: "unknown", explanation: tr("A financial report is recorded as active and updated on 1 September 2026. The supplied data does not establish whether its accounting period, format, or completeness meets the buyer's definition of current documentation.", "Финансовый отчёт отмечен как действующий и обновлённый 1 сентября 2026 года. Имеющихся данных недостаточно, чтобы подтвердить соответствие отчётного периода, формата и полноты документа требованиям заказчика.") },
  ] as const;

  // Only the unchanged fixture gets fixture-specific conclusions. Edited tender
  // language may change the meaning of otherwise identical clauses elsewhere.
  if (exactSample) {
    for (const item of supported) requirements.push({
      title: item.title, status: item.status, tenderEvidence: item.text,
      companyEvidence: COMPANY_EVIDENCE[item.documentId], explanation: item.explanation,
    });
  } else {
    for (const line of lines) {
      if (line.length > 2000 || !/(?:\b(must|shall|mandatory|required|requirement|license|financial documentation|expert opinion|work experience)\b|долж[ае]н|должны|обязател|требован|лицензи|финансов[а-яё]* документ|экспертн[а-яё]* заключени|опыт[а-яё]* работ)/i.test(line)) continue;
      if (line.length < 20 || /^(mandatory qualification documents|requirements?|обязательные квалификационные документы|требования)\s*:?[\s]*$/i.test(line)) continue;
      requirements.push({
        title: `${tr("Requirement candidate", "Возможное требование")} ${requirements.length + 1}`,
        status: "unknown",
        tenderEvidence: line,
        companyEvidence: UNKNOWN_COMPANY_EVIDENCE,
        explanation: tr("This line may contain a requirement. Demo Mode does not interpret edited wording, negation, exceptions, or document sufficiency. Verify this candidate manually or run a live AI analysis.", "Эта строка может содержать требование. Демо-режим не интерпретирует изменённые формулировки, отрицания, исключения или достаточность документов. Проверьте требование вручную или запустите анализ ИИ."),
      });
      if (requirements.length === 60) break;
    }
  }

  const actions: Action[] = exactSample ? [
    { priority: "critical", title: tr("Prepare work experience confirmation", "Подготовьте подтверждение опыта работ"), description: tr("The profile marks the required evidence as missing. Gather relevant completion certificates or other evidence accepted by the buyer and verify it against the full tender.", "В профиле обязательное подтверждение отмечено как отсутствующее. Соберите подходящие акты выполненных работ или другие подтверждения, принимаемые заказчиком, и сверьте их с полной документацией тендера.") },
    { priority: "high", title: tr("Confirm bid security before the deadline", "Проверьте обеспечение заявки до крайнего срока"), description: tr("The tender states 26 September 2026 at 18:00 Asia/Almaty. Confirm the required amount, method, and receipt criteria in the official documentation; these details are absent from the sample.", "В тендере указан срок: 26 сентября 2026 года, 18:00, Asia/Almaty. Уточните сумму, способ внесения и условия подтверждения поступления в официальной документации: в примере эти сведения отсутствуют.") },
    { priority: "high", title: tr("Verify the financial report requirements", "Уточните требования к финансовому отчёту"), description: tr("Check the required accounting period, format, and completeness. A report date alone does not prove the requirement is met.", "Уточните требуемый отчётный период, формат и полноту документа. Одна дата отчёта не подтверждает выполнение требования.") },
    { priority: "medium", title: tr("Plan expert opinion renewal", "Запланируйте обновление экспертного заключения"), description: tr("The recorded expiry is 5 October 2026, six calendar days after submission closes. Renewal planning is a recommendation; the sample only requires validity during submission.", "Указанный срок действия — до 5 октября 2026 года, через шесть календарных дней после окончания подачи заявок. Планирование обновления — рекомендация: пример требует действительности документа только в период подачи.") },
  ] : [
    { priority: "high", title: tr("Manually verify the edited tender", "Проверьте изменённый тендер вручную"), description: tr("Demo Mode returns conservative candidates for edited text. It does not establish that all requirements or deadlines were found. Check every candidate, exception, document, and date against the full notice.", "Для изменённого текста демо-режим выделяет лишь возможные требования. Это не подтверждает, что найдены все требования и сроки. Сверьте каждый пункт, исключение, документ и дату с полным объявлением.") },
    { priority: "medium", title: tr("Use live analysis for a new tender", "Используйте анализ ИИ для нового тендера"), description: tr("A server-configured OpenAI API key enables the compliance agent. Its output still requires review against original documents and official sources.", "Для работы ИИ-агента на сервере должен быть настроен ключ OpenAI API. Результат анализа всё равно необходимо сверить с оригиналами документов и официальными источниками.") },
  ];

  if (!deadlines.length) actions.push({ priority: "high", title: tr("Verify submission deadlines", "Уточните сроки подачи заявки"), description: tr("No supported deadline with an explicit full date, time, and timezone was detected. Check the notice manually; missing extraction does not mean there is no deadline.", "Не найдено срока с явно указанными полной датой, временем и часовым поясом в поддерживаемом формате. Проверьте объявление вручную: отсутствие извлечённой даты не означает отсутствия срока.") });

  return validateGroundedAssessment({
    summary: exactSample
      ? tr("Manual verification required. The fictional company is missing the work experience confirmation required by this sample tender. Its expert opinion remains valid through submission, while financial-document sufficiency needs review. Two tender deadlines produce six draft reminders.", "Требуется ручная проверка. У вымышленной компании отсутствует подтверждение опыта работ, обязательное для этого демо-тендера. Экспертное заключение действует весь период подачи заявок, а достаточность финансовых документов требует проверки. Для двух сроков тендера подготовлены шесть черновиков напоминаний.")
      : tr("Manual verification required. This is a deterministic demonstration for edited text, not an AI interpretation. Candidate requirements remain unknown; only supported explicit deadline formats are extracted. No official eligibility conclusion can be drawn.", "Требуется ручная проверка. Изменённый текст обработан по фиксированным правилам демо-режима, без интерпретации ИИ. Статусы возможных требований не определены; извлечены только явно указанные сроки в поддерживаемом формате. Официальный вывод о праве на участие не сделан."),
    overallRisk: exactSample ? "high" : "unknown",
    officialEligibilityVerified: false,
    requirements,
    deadlines,
    actions,
    alerts: createDraftAlerts(deadlines, locale),
    disclaimer: getDisclaimer(locale),
  }, tenderText);
}
