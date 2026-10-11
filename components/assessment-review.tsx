"use client";

import { useId, useState } from "react";
import { ClipboardCheck, Download, Info } from "lucide-react";
import { createReviewJson, reviewFilename, summarizeReview, type AssessmentReview, type ReviewEntry, type ReviewPacketInput } from "@/lib/assessment-review";
import { createReviewHtml } from "@/lib/review-report";
import { translate, translateCompanyEvidence } from "@/lib/i18n";
import { StatusBadge, formatDate } from "./ui";
import styles from "./assessment-review.module.css";

type Props = Omit<ReviewPacketInput, "reviewedAt"> & { disabled: boolean; onChange: (review: AssessmentReview) => void };

export function ManualAssessmentReview({ assessment, companyProfile, mode, analyzedAt, locale, review, disabled, onChange }: Props) {
  const id = useId();
  const [error, setError] = useState(false);
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const counts = summarizeReview(review);
  const hasNotes = [review.omissions, review.notes, ...review.requirements.map(item => item.note), ...review.deadlines.map(item => item.note)].some(note => note.trim());
  const hasFeedback = counts.marked > 0 || hasNotes;
  const verdicts: { value: ReviewEntry["verdict"]; label: string }[] = [
    { value: "unreviewed", label: tx("Not reviewed", "Не проверено") },
    { value: "correct", label: tx("Correct against source", "Верно по исходнику") },
    { value: "incorrect", label: tx("Needs correction", "Есть ошибка") },
    { value: "unsure", label: tx("Needs clarification", "Не уверен(а)") },
  ];
  function update(next: AssessmentReview) { setError(false); onChange(next); }
  function updateEntry(kind: "requirements" | "deadlines", index: number, patch: Partial<ReviewEntry>) {
    update({ ...review, [kind]: review[kind].map((item, row) => row === index ? { ...item, ...patch } : item) });
  }
  function download(extension: "html" | "json") {
    if (disabled || !hasFeedback) return;
    setError(false);
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const input = { assessment, companyProfile, mode, analyzedAt, locale, review, reviewedAt: new Date().toISOString() };
      const content = extension === "html" ? createReviewHtml(input) : createReviewJson(input);
      url = URL.createObjectURL(new Blob([content], { type: extension === "html" ? "text/html;charset=utf-8" : "application/json;charset=utf-8" }));
      link = document.createElement("a"); link.href = url; link.download = reviewFilename(input, extension);
      document.body.appendChild(link); link.click();
    } catch {
      setError(true);
      const kind = review.requirements.some(item => item.verdict === "incorrect" && !item.note.trim()) ? "requirements" : "deadlines";
      const index = review[kind].findIndex(item => item.verdict === "incorrect" && !item.note.trim());
      if (index >= 0) document.getElementById(`${id}-review-note-${kind}-${index}`)?.focus();
    } finally {
      link?.remove();
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
    }
  }
  function entryFields(kind: "requirements" | "deadlines", index: number) {
    const entry = review[kind][index];
    const label = `${kind === "requirements" ? tx("requirement", "требование") : tx("deadline", "срок")} ${index + 1}`;
    const needsNote = entry.verdict === "incorrect" && !entry.note.trim();
    return <div className={styles.fields}>
      <label>{tx("Your assessment", "Ваша оценка")}<select aria-label={`${tx("Assessment", "Оценка")}: ${label}`} value={entry.verdict} onChange={event => updateEntry(kind, index, { verdict: event.target.value as ReviewEntry["verdict"] })}>
        {verdicts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label>{tx("Explanation or correction", "Пояснение или исправление")}{entry.verdict === "incorrect" && <span> · {tx("required", "обязательно")}</span>}
        <textarea id={`${id}-review-note-${kind}-${index}`} aria-label={`${tx("Comment", "Комментарий")}: ${label}`} value={entry.note} maxLength={2000} rows={2} required={entry.verdict === "incorrect"} aria-invalid={error && needsNote || undefined} placeholder={tx("What should change? Quote the source if possible.", "Что нужно исправить? По возможности приведите цитату.")} onChange={event => updateEntry(kind, index, { note: event.target.value })} />
      </label>
    </div>;
  }
  return <section className={styles.review} aria-label={tx("Team manual review", "Ручная проверка команды")}>
    <div className={styles.heading}><div><span className={styles.kicker}><ClipboardCheck size={15} />{tx("REVIEW WITH THE TEAM", "ПРОВЕРЬТЕ С КОМАНДОЙ")}</span><h3>{tx("Check the findings against the original.", "Сверьте выводы с оригиналом.")}</h3><p>{tx("Mark each requirement and deadline, explain errors, and record anything missing. Your notes stay separate from the original analysis.", "Отметьте требования и сроки, объясните ошибки и запишите пропущенное. Ваши замечания сохраняются отдельно от исходного анализа.")}</p></div><span className={styles.progress}>{tx(`Marked ${counts.marked} of ${counts.total}`, `Отмечено ${counts.marked} из ${counts.total}`)}</span></div>
    <div className={styles.notice}><Info size={16} /><p>{tx("These are team review notes, not specialist certification or official approval. They do not change the model's answer or automatically train it.", "Это замечания команды, а не заключение специалиста или официальный допуск. Они не меняют ответ ИИ и не обучают модель автоматически.")}</p></div>
    {disabled && <p className={styles.warning} role="status">{tx("Review is paused while the report is outdated, in another language, or being recalculated. Run a current check before editing or downloading.", "Ручная проверка недоступна, пока отчёт устарел, открыт на другом языке или пересчитывается. Сначала получите актуальный отчёт.")}</p>}
    <fieldset disabled={disabled} className={styles.form}>
      <legend className={styles.srOnly}>{tx("Review findings", "Проверка выводов")}</legend>
      {assessment.requirements.map((item, index) => <article className={styles.row} key={`requirement-${index}`}>
        <div className={styles.rowHeading}><h4>{tx("Requirement", "Требование")} {index + 1} · {item.title}</h4><StatusBadge status={item.status} locale={locale} /></div>
        <blockquote>{item.tenderEvidence}</blockquote>
        {item.conflictingEvidence && <div><span className={styles.label}>{tx("Conflicting clause", "Противоречивое условие")}</span><blockquote>{item.conflictingEvidence}</blockquote></div>}
        <p className={styles.evidence}>{translateCompanyEvidence(item.companyEvidence, locale, companyProfile)}</p>
        <p className={styles.explanation}>{item.explanation}</p>
        {entryFields("requirements", index)}
      </article>)}
      {assessment.deadlines.map((item, index) => <article className={styles.row} key={`deadline-${index}`}>
        <div className={styles.rowHeading}><h4>{tx("Deadline", "Срок")} {index + 1} · {item.title}</h4></div>
        <p className={styles.date}>{formatDate(item.date, true, locale)} · {tx("Asia/Almaty", "Алматы")}</p>
        <blockquote>{item.tenderEvidence}</blockquote>
        {entryFields("deadlines", index)}
      </article>)}
      {!counts.total && <p className={styles.empty}>{tx("No requirements or deadlines were extracted. Use the field below to record any that were missed.", "Требования и сроки не найдены. Ниже можно записать то, что анализ пропустил.")}</p>}
      <div className={styles.notes}>
        <label>{tx("What was missed?", "Что пропущено?")}<textarea aria-label={tx("Missing requirements or deadlines", "Пропущенные требования или сроки")} rows={3} maxLength={4000} value={review.omissions} placeholder={tx("Quote a missing requirement or deadline and explain why it matters.", "Приведите цитату с пропущенным требованием или сроком и поясните замечание.")} onChange={event => update({ ...review, omissions: event.target.value })} /></label>
        <label>{tx("Other notes", "Другие замечания")}<textarea aria-label={tx("Other review notes", "Другие замечания к проверке")} rows={2} maxLength={4000} value={review.notes} placeholder={tx("For example, an unsupported recommendation or misleading summary.", "Например, лишняя рекомендация или неточная формулировка в итогах.")} onChange={event => update({ ...review, notes: event.target.value })} /></label>
      </div>
      <div className={styles.downloads}><button type="button" onClick={() => download("html")} disabled={!hasFeedback}><Download size={15} />{tx("Download review · HTML", "Скачать проверку · HTML")}</button><button type="button" className={styles.secondary} onClick={() => download("json")} disabled={!hasFeedback}>{tx("Save to continue · JSON", "Сохранить для продолжения · JSON")}</button></div>
    </fieldset>
    {error && <p className={styles.error} role="alert">{tx("Could not export. Add an explanation to every item marked as incorrect, then try again.", "Не удалось скачать. Добавьте пояснение к каждой отметке «Есть ошибка» и повторите попытку.")}</p>}
    <p className={styles.storage}>{tx("Notes stay in this tab and are not sent to the server. Save JSON before reloading, changing the report language, or running another analysis. Use Open saved review at the top of the page to continue later. The file includes the analyzed company profile, source quotes, original report and your notes; review it before sharing. HTML opens for reading and printing.", "Замечания остаются в этой вкладке и не отправляются на сервер. Сохраните JSON до обновления страницы, смены языка отчёта или нового анализа. Чтобы продолжить позже, нажмите «Открыть проверку» вверху страницы. Файл содержит профиль компании, цитаты, исходный отчёт и ваши заметки — проверьте его перед передачей. HTML можно открыть для чтения и печати.")}</p>
  </section>;
}
