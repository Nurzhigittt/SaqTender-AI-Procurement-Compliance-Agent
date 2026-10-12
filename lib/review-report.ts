import { createReviewPacket, summarizeReview, type ReviewPacketInput } from "./assessment-review";
import { translate } from "./i18n";
import { createReportHtml, escapeReportHtml } from "./report-export";
import { getRequirementKindLabel, getRequirementStatusLabel } from "./requirement-kind";

/** A local, offline review accompanies the original assessment without changing it. */
export function createReviewHtml(input: ReviewPacketInput): string {
  const packet = createReviewPacket(input);
  const { assessment, review, locale } = packet;
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const h = escapeReportHtml;
  const counts = summarizeReview(review);
  const verdictLabels = {
    unreviewed: tx("Not reviewed", "Не проверено"),
    correct: tx("Marked correct by the team", "Команда считает верным"),
    incorrect: tx("Marked incorrect by the team", "Команда считает ошибочным"),
    unsure: tx("Team is unsure", "Команда не уверена"),
  };
  const source = (quote: string, label = tx("Original tender evidence", "Цитата из тендера в оригинале")) => `<div class="source"><span class="label">${h(label)}</span><blockquote>${h(quote)}</blockquote></div>`;
  const note = (value: string) => `<div class="source"><span class="label">${h(tx("Team note", "Замечание команды"))}</span><p>${h(value || tx("No note provided.", "Замечание не добавлено."))}</p></div>`;
  const requirements = assessment.requirements.map((item, index) => {
    const entry = review.requirements[index];
    return `<article class="card"><div class="card-heading"><h3>${index + 1}. ${h(item.title)}</h3><span class="badge neutral">${h(verdictLabels[entry.verdict])}</span></div><p class="muted small">${h(tx("Original assessment status", "Исходный статус в отчёте"))}: ${h(getRequirementStatusLabel(item, locale))}</p>${item.kind ? `<p class="muted small">${h(tx("Type", "Тип"))}: ${h(getRequirementKindLabel(item.kind, locale))}</p>` : ""}${source(item.tenderEvidence)}${item.contextEvidence ? source(item.contextEvidence, tx("Scope context", "Контекст применения")) : ""}${item.conflictingEvidence ? source(item.conflictingEvidence, tx("Conflicting clause", "Противоречивое условие")) : ""}${note(entry.note)}</article>`;
  }).join("");
  const deadlines = assessment.deadlines.map((item, index) => {
    const entry = review.deadlines[index];
    return `<article class="card"><div class="card-heading"><h3>${index + 1}. ${h(item.title)}</h3><span class="badge neutral">${h(verdictLabels[entry.verdict])}</span></div><p class="muted small">${h(tx("Original deadline with time zone", "Исходный срок с часовым поясом"))}: ${h(item.date)}</p>${source(item.tenderEvidence)}${note(entry.note)}</article>`;
  }).join("");
  const reviewHtml = `<section id="team-manual-review"><div class="section-title"><span class="section-number">05</span><h2>${h(tx("Team manual review", "Ручная проверка команды"))}</h2><span class="count">${counts.marked} / ${counts.total}</span></div>
<div class="notice">${h(tx("These are the team's review notes, not an expert opinion or official eligibility verification. They do not change the original assessment above. Marked items measure review progress, not analysis accuracy.", "Это замечания команды, а не экспертное заключение или официальная проверка права на участие. Они не изменяют исходный отчёт выше. Число отмеченных пунктов показывает ход проверки, а не точность анализа."))}</div>
<p class="muted small">${h(tx("Review snapshot", "Снимок проверки"))}: ${h(packet.reviewedAt)}</p>
<p>${h(tx("Marked items", "Отмечено пунктов"))}: <strong>${counts.marked} / ${counts.total}</strong> · ${h(tx("Not reviewed", "Не проверено"))}: <strong>${counts.unreviewed}</strong></p>
<h3>${h(tx("Review of extracted requirements", "Проверка найденных требований"))}</h3>${requirements || `<p class="empty">${h(tx("No extracted requirements to review. Record any omissions below.", "Нет найденных требований для проверки. Укажите пропуски ниже."))}</p>`}
<h3>${h(tx("Review of extracted deadlines", "Проверка найденных сроков"))}</h3>${deadlines || `<p class="empty">${h(tx("No extracted deadlines to review. Record any omissions below.", "Нет найденных сроков для проверки. Укажите пропуски ниже."))}</p>`}
<article class="card"><h3>${h(tx("Possible omissions noted by the team", "Возможные пропуски по мнению команды"))}</h3><p class="muted small">${h(tx("Free-text observations; these have not been added to the extracted requirements or deadlines.", "Замечания в свободной форме; они не добавлены в найденные требования или сроки."))}</p><p>${h(review.omissions || tx("No omissions recorded. This does not confirm completeness.", "Пропуски не записаны. Это не подтверждает полноту анализа."))}</p></article>
<article class="card"><h3>${h(tx("General team notes", "Общие замечания команды"))}</h3><p>${h(review.notes || tx("No general notes provided.", "Общие замечания не добавлены."))}</p></article>
<p class="muted small">${h(tx("Review notes are included in this local download. This file does not send them anywhere.", "Замечания включены в этот локально скачанный файл. Файл никуда их не отправляет."))}</p></section>`;
  const base = createReportHtml(packet);
  return base.replace("</div><footer>", `${reviewHtml}\n</div><footer>`);
}
