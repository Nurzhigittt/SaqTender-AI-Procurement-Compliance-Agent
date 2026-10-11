"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Download, GitCompareArrows, LoaderCircle } from "lucide-react";
import type { ReviewEntry, ReviewPacket } from "@/lib/assessment-review";
import { compareReviews, ReviewComparisonError } from "@/lib/review-comparison";
import { createComparisonHtml, createComparisonFilename } from "@/lib/review-comparison-export";
import { parseReviewFile, REVIEW_FILE_MAX_BYTES, ReviewImportError } from "@/lib/review-import";
import { translate, type Locale } from "@/lib/i18n";
import { formatDate } from "./ui";
import styles from "./review-comparison.module.css";

type Props = { base: ReviewPacket; sourceName: string; locale: Locale; active: boolean };
type FileReview = { name: string; packet: ReviewPacket };
type ErrorCode = "invalid_file" | "unsupported_version" | "too_large" | "mismatched_report" | "invalid_review";

export function ReviewComparison({ base, sourceName, locale, active }: Props) {
  const id = useId();
  const generation = useRef(0);
  const [file, setFile] = useState<FileReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [exportError, setExportError] = useState(false);
  const [onlyDiscussion, setOnlyDiscussion] = useState(true);
  const tx = (en: string, ru: string) => translate(locale, en, ru);

  useEffect(() => {
    if (!active) { generation.current += 1; setBusy(false); }
    return () => { generation.current += 1; };
  }, [active]);

  // Recompute against current notes so edits never leave a stale comparison visible.
  const result = useMemo(() => {
    if (!file) return null;
    try { return { comparison: compareReviews(base, file.packet), error: null }; }
    catch (cause) { return { comparison: null, error: cause instanceof ReviewComparisonError ? cause.code : "invalid_review" }; }
  }, [base, file]);
  const comparison = result?.comparison;

  async function readFile(nextFile: File) {
    const current = ++generation.current;
    setBusy(true); setError(null); setExportError(false);
    try {
      if (nextFile.size > REVIEW_FILE_MAX_BYTES) throw new ReviewImportError("too_large");
      if (!nextFile.name.toLowerCase().endsWith(".json")) throw new ReviewImportError("invalid_file");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await nextFile.arrayBuffer());
      const packet = parseReviewFile(text);
      compareReviews(base, packet);
      if (current === generation.current) { setFile({ name: nextFile.name, packet }); setOnlyDiscussion(true); }
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof ReviewImportError || cause instanceof ReviewComparisonError ? cause.code : "invalid_file");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  function download() {
    if (!comparison || !file || busy) return;
    setExportError(false);
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const comparedAt = new Date().toISOString();
      const html = createComparisonHtml({ left: base, right: file.packet, leftName: sourceName, rightName: file.name, comparedAt });
      url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      link = document.createElement("a"); link.href = url; link.download = createComparisonFilename(comparedAt, base.locale);
      document.body.appendChild(link); link.click();
    } catch { setExportError(true); }
    finally { link?.remove(); if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); } }
  }

  const errors: Record<ErrorCode, string> = {
    invalid_file: tx("Choose a valid saved SaqTender review JSON. The existing comparison has been kept.", "Выберите корректный JSON сохранённой проверки SaqTender. Предыдущее сравнение сохранено."),
    unsupported_version: tx("This file version is not supported. Choose a saqtender-review-v1 JSON.", "Эта версия файла не поддерживается. Выберите JSON проверки формата saqtender-review-v1."),
    too_large: tx("The file exceeds 8 MiB. Choose a saved review JSON.", "Файл превышает 8 МиБ. Выберите JSON сохранённой проверки."),
    mismatched_report: tx("These files do not share the same original report. Use copies with the same company profile, analysis date, language and original findings.", "Это проверки разных исходных отчётов. Выберите копии с одинаковыми профилем компании, датой анализа, языком и исходными выводами."),
    invalid_review: tx("Add at least one mark or note to the current review, and explain every finding marked incorrect to continue comparing.", "Для сравнения добавьте хотя бы одну оценку или заметку в текущую проверку и поясните каждую отметку «Есть ошибка»."),
  };
  const verdicts: Record<ReviewEntry["verdict"], string> = { unreviewed: tx("Not reviewed", "Не проверено"), correct: tx("Correct against source", "Верно по исходнику"), incorrect: tx("Needs correction", "Есть ошибка"), unsure: tx("Needs clarification", "Не уверен(а)") };
  const comparisonLabels = { same: tx("Marks match", "Оценки совпали"), different: tx("Marks differ", "Оценки различаются"), incomplete: tx("Review incomplete", "Проверка не завершена") };
  function notesColumn(label: string, entry: ReviewEntry) {
    return <div className={styles.column}><span>{label}</span><strong>{verdicts[entry.verdict]}</strong><p lang={base.locale}>{entry.note || tx("No comment", "Комментария нет")}</p></div>;
  }
  const displayedRows = comparison?.rows.filter(row => !onlyDiscussion || row.needsDiscussion) ?? [];

  return <details className={styles.panel} lang={locale}>
    <summary><GitCompareArrows size={17} />{tx("Compare two reviews", "Сравнить две проверки")}</summary>
    <div className={styles.body}>
      <p className={styles.intro}>{tx("Compare your current notes below with a teammate’s saved JSON from the same original report. Files are read only in your browser, without an AI request. The original assessment and notes stay unchanged.", "Сравните текущие замечания ниже с сохранённым JSON коллеги по тому же исходному отчёту. Файлы читаются только в браузере, без запроса к ИИ. Исходный анализ и замечания остаются прежними.")}</p>
      <label className={styles.fileLabel} htmlFor={`${id}-comparison`}>{tx("JSON to compare", "JSON для сравнения")}</label>
      <input id={`${id}-comparison`} type="file" accept=".json,application/json" disabled={busy || !active} aria-describedby={`${id}-limit`} onChange={event => { const nextFile = event.target.files?.[0]; event.target.value = ""; if (nextFile) void readFile(nextFile); }} />
      <p id={`${id}-limit`} className={styles.limit}>{tx("One additional saved review · UTF-8 JSON · Up to 8 MiB", "Одна дополнительная проверка · JSON UTF-8 · До 8 МиБ")}</p>
      {busy && <p className={styles.reading} role="status"><LoaderCircle size={16} className="spin" />{tx("Reading comparison…", "Читаем файл для сравнения…")}</p>}
      {(error || result?.error) && <p className={styles.error} role="alert">{errors[(error || result?.error) as ErrorCode]}</p>}
      {file && comparison && <>
        <div className={styles.sources}><div><span>{tx("A · Current notes", "А · Текущие замечания")}</span><strong>{sourceName}</strong><small>{tx("Includes edits made below, even before saving.", "Учитывает изменения ниже, в том числе ещё не скачанные.")}</small></div><div><span>{tx("B · Comparison file", "Б · Файл для сравнения")}</span><strong>{file.name}</strong><small>{formatDate(file.packet.reviewedAt, true, locale)} · {tx("Almaty · Date stated in file", "Алматы · Дата из файла")}</small></div></div>
        <div className={styles.notice}>{tx("Matching marks do not establish correctness or AI accuracy. Authors and file authenticity are unverified. An incorrect/uncertain mark or different comments can need discussion even when the marks match.", "Совпадение оценок не подтверждает правильность вывода или точность ИИ. Авторы и подлинность файлов не проверены. Ошибочные, неуверенные оценки и разные комментарии требуют обсуждения даже при совпадении оценок.")}</div>
        {comparison.identicalFeedback && <p className={styles.notice}>{tx("The notes match completely. These files may be copies of one review; independent checking has not been established.", "Замечания полностью совпадают. Файлы могут быть копиями одной проверки; независимость оценок не установлена.")}</p>}
        <div className={styles.stats}><div><strong>{comparison.summary.same}</strong><span>{tx("Marks match", "Оценки совпали")}</span></div><div><strong>{comparison.summary.different}</strong><span>{tx("Marks differ", "Оценки различаются")}</span></div><div><strong>{comparison.summary.incomplete}</strong><span>{tx("Incomplete", "Не завершено")}</span></div></div>
        <div className={styles.toolbar}><label><input type="checkbox" checked={onlyDiscussion} onChange={event => setOnlyDiscussion(event.target.checked)} />{tx("Only items to discuss", "Только пункты для обсуждения")} ({comparison.summary.needsDiscussion})</label><button type="button" disabled={busy} onClick={download}><Download size={15} />{tx("Download comparison · HTML", "Скачать сравнение · HTML")}</button></div>
        {exportError && <p className={styles.error} role="alert">{tx("Could not download. Check the current notes and try again.", "Не удалось скачать сравнение. Проверьте текущие замечания и попробуйте ещё раз.")}</p>}
        <p className={styles.limit}>{tx("The HTML uses the original report language. Counts describe marks in two sets of notes, not the number of verified reviewers.", "HTML сохраняет язык исходного отчёта. Счётчики описывают отметки в двух наборах замечаний, а не число проверенных авторов.")}</p>
        {!displayedRows.length && <p className={styles.empty}>{onlyDiscussion ? tx("No extracted rows are flagged for discussion. Turn off the filter to inspect incomplete rows, and check the general notes below.", "Среди найденных пунктов нет отмеченных для обсуждения. Снимите фильтр, чтобы увидеть незавершённые проверки, и просмотрите общие замечания ниже.") : tx("No requirements or deadlines were extracted. Compare the general notes below.", "Требования и сроки не найдены. Сравните общие замечания ниже.")}</p>}
        {displayedRows.map(row => {
          const original = row.kind === "requirement" ? base.assessment.requirements[row.index] : base.assessment.deadlines[row.index];
          return <article className={styles.row} key={`${row.kind}-${row.index}`}><div className={styles.rowHeading}><h4>{row.kind === "requirement" ? tx("Requirement", "Требование") : tx("Deadline", "Срок")} {row.index + 1} · <span lang={base.locale}>{original.title}</span></h4><span className={row.comparison === "different" ? styles.different : styles.status}>{comparisonLabels[row.comparison]}</span></div>{row.kind === "deadline" && <p className={styles.limit}>{formatDate(base.assessment.deadlines[row.index].date, true, locale)} · {tx("Almaty", "Алматы")}</p>}<details className={styles.evidence}><summary>{tx("Original source quotes", "Цитаты из исходного отчёта")}</summary><blockquote lang={base.locale}>{original.tenderEvidence}</blockquote>{"conflictingEvidence" in original && original.conflictingEvidence && <blockquote lang={base.locale}>{original.conflictingEvidence}</blockquote>}</details><div className={styles.columns}>{notesColumn(tx("A · Current notes", "А · Текущие замечания"), row.left)}{notesColumn(tx("B · Comparison file", "Б · Файл для сравнения"), row.right)}</div></article>;
        })}
        <div className={styles.general}><h4>{tx("Omissions and general notes", "Пропуски и общие замечания")}</h4><p>{tx("These notes are shown separately and do not affect row counts.", "Эти замечания показаны отдельно и не входят в счётчики пунктов.")}</p>{(["omissions", "notes"] as const).map(kind => <div key={kind}><h5>{kind === "omissions" ? tx("Possible omissions", "Возможные пропуски") : tx("Other notes", "Другие замечания")}</h5><div className={styles.columns}><div className={styles.column}><span>{tx("A · Current notes", "А · Текущие замечания")}</span><p lang={base.locale}>{base.review[kind] || tx("No notes", "Замечаний нет")}</p></div><div className={styles.column}><span>{tx("B · Comparison file", "Б · Файл для сравнения")}</span><p lang={base.locale}>{file.packet.review[kind] || tx("No notes", "Замечаний нет")}</p></div></div></div>)}</div>
      </>}
    </div>
  </details>;
}
