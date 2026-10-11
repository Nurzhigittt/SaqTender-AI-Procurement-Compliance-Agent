import { z } from "zod";
import { reviewFilename, type ReviewEntry, type ReviewPacket } from "./assessment-review";
import { translate, type Locale } from "./i18n";
import { createReportHtml, escapeReportHtml } from "./report-export";
import { compareReviews } from "./review-comparison";

export type ComparisonExportInput = {
  left: ReviewPacket;
  right: ReviewPacket;
  leftName: string;
  rightName: string;
  comparedAt: string;
};

const TimestampSchema = z.string().datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)), "Invalid comparison timestamp");
const NameSchema = z.string().min(1).max(255).refine(value => Boolean(value.trim()), "A file name is required");

export function createComparisonFilename(comparedAt: string, locale: Locale): string {
  TimestampSchema.parse(comparedAt);
  z.enum(["ru", "en"]).parse(locale);
  return reviewFilename({ reviewedAt: comparedAt, locale }, "html").replace("saqtender-review-", "saqtender-comparison-");
}

/** Offline comparison: preserves the original report and keeps both sets of notes separate. */
export function createComparisonHtml(input: ComparisonExportInput): string {
  const comparedAt = TimestampSchema.parse(input.comparedAt);
  const leftName = NameSchema.parse(input.leftName);
  const rightName = NameSchema.parse(input.rightName);
  // The shared comparison validates both packets and their original snapshots.
  const comparison = compareReviews(input.left, input.right);
  const { assessment, locale } = input.left;
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const h = escapeReportHtml;
  const labels = {
    unreviewed: tx("Not reviewed", "Не проверено"),
    correct: tx("Marked correct", "Отмечено как верное"),
    incorrect: tx("Marked incorrect", "Отмечено как ошибочное"),
    unsure: tx("Unsure", "Нет уверенности"),
  };
  const statusLabels = {
    met: tx("Met", "Выполнено"), missing: tx("Missing", "Отсутствует"),
    at_risk: tx("At risk", "Есть риск"), unknown: tx("Unknown", "Нет данных"),
  };
  const comparisonLabels = {
    same: tx("Same marks", "Оценки совпадают"),
    different: tx("Different marks", "Оценки различаются"),
    incomplete: tx("At least one mark is missing", "Хотя бы одна оценка не выставлена"),
  };
  const source = (quote: string, label = tx("Original tender evidence", "Цитата из тендера в оригинале")) => `<div class="source"><span class="label">${h(label)}</span><blockquote>${h(quote)}</blockquote></div>`;
  const reviewSide = (entry: ReviewEntry, side: "A" | "B") => `<div><span class="label">${side} · ${h(side === "A" ? tx("Current notes", "Текущие замечания") : tx("Comparison file", "Файл для сравнения"))}</span><p><strong>${h(labels[entry.verdict])}</strong></p><p>${h(entry.note || tx("No note provided.", "Замечание не добавлено."))}</p></div>`;
  const rows = comparison.rows.map(row => {
    const item = row.kind === "requirement" ? assessment.requirements[row.index] : assessment.deadlines[row.index];
    const originalDetails = row.kind === "requirement"
      ? `<p class="muted small">${h(tx("Original assessment status", "Исходный статус в отчёте"))}: ${h(statusLabels[assessment.requirements[row.index].status])}</p>`
      : `<p class="muted small">${h(tx("Original deadline with time zone", "Исходный срок с часовым поясом"))}: ${h(assessment.deadlines[row.index].date)}</p>`;
    const conflictingEvidence = row.kind === "requirement" ? assessment.requirements[row.index].conflictingEvidence : undefined;
    return `<article class="card"><div class="card-heading"><h3>${h(row.kind === "requirement" ? tx("Requirement", "Требование") : tx("Deadline", "Срок"))} ${row.index + 1}. ${h(item.title)}</h3><span class="badge neutral">${h(comparisonLabels[row.comparison])}</span></div>${originalDetails}${source(item.tenderEvidence)}${conflictingEvidence ? source(conflictingEvidence, tx("Conflicting clause", "Противоречивое условие")) : ""}<div class="evidence-pair">${reviewSide(row.left, "A")}${reviewSide(row.right, "B")}</div>${row.needsDiscussion ? `<p class="small past">${h(tx("Flagged for discussion; this is not a correctness judgment.", "Отмечено для обсуждения; это не вывод о правильности анализа."))}</p>` : ""}</article>`;
  }).join("");
  const separateNotes = (title: string, left: string, right: string, differ: boolean, empty: string) => `<article class="card"><div class="card-heading"><h3>${h(title)}</h3><span class="badge neutral">${h(differ ? tx("Texts differ", "Тексты различаются") : tx("Texts match", "Тексты совпадают"))}</span></div><div class="evidence-pair"><div><span class="label">A · ${h(tx("Current notes", "Текущие замечания"))}</span><p>${h(left || empty)}</p></div><div><span class="label">B · ${h(tx("Comparison file", "Файл для сравнения"))}</span><p>${h(right || empty)}</p></div></div></article>`;
  const { summary } = comparison;
  const section = `<section id="team-review-comparison"><div class="section-title"><span class="section-number">05</span><h2>${h(tx("Compare team review notes", "Сравнение замечаний команды"))}</h2></div>
<div class="notice">${h(tx("These are two sets of team notes, not verified reviewer identities or expert conclusions. Imported file authenticity is unverified. Comparing them does not change the original report above. Matching marks do not prove accuracy; no majority decision or official eligibility verification is made.", "Это два набора замечаний команды, а не подтверждённые личности проверяющих или экспертные заключения. Подлинность импортированных файлов не проверена. Сравнение не меняет исходный отчёт выше. Совпадение оценок не доказывает точность; решение большинством и официальная проверка права на участие не выполняются."))}</div>
${comparison.identicalFeedback ? `<p class="notice">${h(tx("All review notes match. These files may be copies of one review; authorship and independent review are not verified.", "Все замечания полностью совпадают. Файлы могут быть копиями одной проверки; авторство и независимость проверок не подтверждены."))}</p>` : ""}
<p class="muted small">${h(tx("Comparison created", "Сравнение создано"))}: ${h(comparedAt)}</p>
<article class="card"><h3>A · ${h(tx("Current notes", "Текущие замечания"))}</h3><p>${h(tx("Opened file", "Открытый файл"))}: <strong>${h(leftName)}</strong></p><p class="muted small">${h(tx("Includes the current notes in the workspace, which may contain unsaved edits made after opening the file.", "Включает текущие замечания во вкладке, в том числе изменения после открытия файла, которые могли ещё не быть сохранены."))}</p><p class="muted small">${h(tx("Review snapshot timestamp", "Время снимка проверки"))}: ${h(input.left.reviewedAt)}</p></article>
<article class="card"><h3>B · ${h(tx("Comparison file", "Файл для сравнения"))}</h3><p><strong>${h(rightName)}</strong></p><p class="muted small">${h(tx("Review snapshot timestamp", "Время снимка проверки"))}: ${h(input.right.reviewedAt)}</p></article>
<p>${h(tx("Total items", "Всего пунктов"))}: <strong>${summary.total}</strong> · ${h(tx("Same marks", "Совпадающие оценки"))}: <strong>${summary.same}</strong> · ${h(tx("Different marks", "Разные оценки"))}: <strong>${summary.different}</strong> · ${h(tx("Missing marks", "Неполные оценки"))}: <strong>${summary.incomplete}</strong> · ${h(tx("Flagged for discussion", "Отмечено для обсуждения"))}: <strong>${summary.needsDiscussion}</strong></p>
<p class="muted small">${h(tx("These counts compare marks, not analysis accuracy. If either side is unreviewed, the item is incomplete even when both sides are unreviewed. Discussion flags may overlap these categories.", "Эти числа сравнивают оценки и не измеряют точность анализа. Если хотя бы одна сторона не проверила пункт, его оценки неполные, даже когда обе стороны оставили его без проверки. Отметки для обсуждения могут пересекаться с этими категориями."))}</p>
${rows || `<p class="empty">${h(tx("No extracted requirements or deadlines to compare. This does not confirm completeness.", "Нет найденных требований или сроков для сравнения. Это не подтверждает полноту анализа."))}</p>`}
${separateNotes(tx("Possible omissions", "Возможные пропуски"), input.left.review.omissions, input.right.review.omissions, comparison.notes.omissionsDiffer, tx("No omissions recorded. This does not confirm completeness.", "Пропуски не записаны. Это не подтверждает полноту анализа."))}
${separateNotes(tx("General notes", "Общие замечания"), input.left.review.notes, input.right.review.notes, comparison.notes.notesDiffer, tx("No general notes provided.", "Общие замечания не добавлены."))}
<p class="muted small">${h(tx("The notes remain separate. They have not been merged into requirements, deadlines or an agreed conclusion. This local file contains the original report, company profile details, source quotes and both sets of notes; review it before sharing. It sends nothing anywhere.", "Замечания остаются отдельными. Они не объединены с требованиями, сроками или общим заключением. Локальный файл содержит исходный отчёт, сведения о компании, цитаты и оба набора замечаний; проверьте его перед передачей. Файл никуда ничего не отправляет."))}</p></section>`;
  return createReportHtml(input.left).replace("</div><footer>", `${section}\n</div><footer>`);
}
