"use client";

import { useId, useRef, useState } from "react";
import { ArrowRight, FolderOpen, LoaderCircle, X } from "lucide-react";
import type { ReviewPacket } from "@/lib/assessment-review";
import { summarizeReview } from "@/lib/assessment-review";
import { parseReviewFile, REVIEW_FILE_MAX_BYTES, ReviewImportError } from "@/lib/review-import";
import { translate, type Locale } from "@/lib/i18n";
import { ManualAssessmentReview } from "./assessment-review";
import { ReviewComparison } from "./review-comparison";
import { formatDate } from "./ui";
import styles from "./saved-review.module.css";

type SavedFile = { name: string; packet: ReviewPacket };

/** Opens a local review independently of the current analyzer and company profile. */
export function SavedReview({ locale, disabled }: { locale: Locale; disabled: boolean }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"invalid_file" | "unsupported_version" | "too_large" | null>(null);
  const [preview, setPreview] = useState<SavedFile | null>(null);
  const [opened, setOpened] = useState<SavedFile | null>(null);
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(false);
  const tx = (en: string, ru: string) => translate(locale, en, ru);

  function close() {
    setActive(false);
    generation.current += 1;
    setBusy(false);
    setPreview(null);
    setError(null);
    dialog.current?.close();
    launcher.current?.focus();
  }

  async function readFile(file: File) {
    const current = ++generation.current;
    setBusy(true); setError(null); setPreview(null);
    try {
      if (file.size > REVIEW_FILE_MAX_BYTES) throw new ReviewImportError("too_large");
      if (!file.name.toLowerCase().endsWith(".json")) throw new ReviewImportError("invalid_file");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const packet = parseReviewFile(text);
      if (current === generation.current) setPreview({ name: file.name, packet });
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof ReviewImportError ? cause.code : "invalid_file");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  function openPreview() {
    if (!preview || busy) return;
    setOpened(preview); setPreview(null); setError(null); setRevision(value => value + 1);
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus();
  }

  const errors = {
    invalid_file: tx("This file is not a valid saved SaqTender review. Choose the JSON downloaded with Save to continue.", "Это не сохранённая проверка SaqTender или файл повреждён. Выберите JSON, скачанный кнопкой «Сохранить для продолжения»."),
    unsupported_version: tx("This review uses an unsupported file version. Open a saqtender-review-v1 JSON file.", "Эта версия файла пока не поддерживается. Выберите JSON проверки формата saqtender-review-v1."),
    too_large: tx("The file exceeds the 8 MiB limit. Choose a saved review JSON, not the original tender document.", "Файл превышает лимит 8 МиБ. Выберите JSON сохранённой проверки, а не исходный документ тендера."),
  };

  return <>
    <button ref={launcher} type="button" className={styles.launcher} disabled={disabled} onClick={() => { setActive(true); dialog.current?.showModal(); }}><FolderOpen size={15} />{opened ? tx("Continue saved review", "Продолжить проверку") : tx("Open saved review", "Открыть проверку")}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }}>
      <div className={styles.content}>
        <header className={styles.header}><div><span className={styles.kicker}>{tx("SAVED REVIEW", "СОХРАНЁННАЯ ПРОВЕРКА")}</span><h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{tx("Continue with your team’s notes", "Продолжите с замечаниями команды")}</h2></div><button type="button" className={styles.close} aria-label={tx("Close saved review", "Закрыть сохранённую проверку")} onClick={close}><X size={20} /></button></header>
        <div ref={body} className={styles.body}>
          <div className={styles.import}>
            <p>{tx("Open a JSON saved from Manual review. It is read only in this browser, with no AI request. Your current tender and company profile stay as they are.", "Откройте JSON, сохранённый из «Ручной проверки». Файл читается только в браузере, без запроса к ИИ. Текущий тендер и профиль компании останутся прежними.")}</p>
            <label htmlFor={`${id}-file`}>{opened ? tx("Choose another review", "Выбрать другую проверку") : tx("Choose saved JSON", "Выбрать сохранённый JSON")}</label>
            <input id={`${id}-file`} type="file" accept=".json,application/json" disabled={busy} aria-describedby={`${id}-limits`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void readFile(file); }} />
            <small id={`${id}-limits`}>{tx("SaqTender review JSON · UTF-8 · Up to 8 MiB · HTML cannot be imported", "JSON проверки SaqTender · UTF-8 · До 8 МиБ · HTML не загружается")}</small>
            {busy && <p className={styles.reading} role="status"><LoaderCircle size={16} className="spin" />{tx("Reading saved review…", "Читаем сохранённую проверку…")}</p>}
            {error && <p className={styles.error} role="alert">{errors[error]}</p>}
            {preview && <div className={styles.preview} role="status"><span>{preview.name}</span><h3>{preview.packet.companyProfile.name}</h3><p>{tx("Original analysis", "Исходный анализ")}: {formatDate(preview.packet.analyzedAt, true, locale)} · {tx("Almaty", "Алматы")}</p><p>{tx("Marked items", "Отмечено пунктов")}: {summarizeReview(preview.packet.review).marked} / {summarizeReview(preview.packet.review).total} · {preview.packet.locale.toUpperCase()}</p><p>{tx("The file’s authenticity and contents have not been verified. The full original tender text is not included.", "Подлинность и содержание файла не проверены. Полный исходный текст тендера в файл не входит.")}</p>{opened && <p>{tx("Opening replaces the saved review below. Download any changes there before continuing.", "Открытие заменит сохранённую проверку ниже. Сначала скачайте внесённые в неё изменения.")}</p>}<div className={styles.previewActions}><button type="button" className={styles.secondary} onClick={() => setPreview(null)}>{tx("Cancel", "Отмена")}</button><button type="button" onClick={openPreview}>{opened ? tx("Open instead of current", "Открыть вместо текущей") : tx("Open review", "Открыть замечания")}<ArrowRight size={15} /></button></div></div>}
          </div>
          {opened && <div lang={opened.packet.locale}>
            <div className={styles.archive} lang={locale}><span className={styles.kicker}>{tx("FROM A FILE · NOT A NEW ANALYSIS", "ИЗ ФАЙЛА · БЕЗ НОВОГО АНАЛИЗА")}</span><h3>{opened.packet.companyProfile.name}</h3><p>{opened.name}</p><dl><div><dt>{tx("Original analysis", "Исходный анализ")}</dt><dd>{formatDate(opened.packet.analyzedAt, true, locale)} · {tx("Almaty", "Алматы")}</dd></div><div><dt>{tx("Snapshot saved in file", "Снимок замечаний в файле")}</dt><dd>{formatDate(opened.packet.reviewedAt, true, locale)} · {tx("Almaty", "Алматы")}</dd></div><div><dt>{tx("Mode stated in file", "Режим, указанный в файле")}</dt><dd>{opened.packet.mode === "demo" ? tx("Demo", "Демо") : tx("Live AI", "Онлайн-ИИ")}</dd></div><div><dt>{tx("Report language", "Язык отчёта")}</dt><dd>{opened.packet.locale.toUpperCase()}</dd></div></dl><p>{tx("This is a saved snapshot, not a current check. File authenticity is unverified. Compare it with the original tender and documents; source quotes alone do not show the full context.", "Это сохранённый снимок, а не актуальная проверка. Подлинность файла не подтверждена. Сверяйте его с оригиналами тендера и документов: цитаты не передают весь контекст.")}</p><details><summary>{tx("Original assessment summary", "Итоги исходного анализа")}</summary><p lang={opened.packet.locale}>{opened.packet.assessment.summary}</p><p lang={opened.packet.locale}>{opened.packet.assessment.disclaimer}</p></details></div>
            <ReviewComparison key={`comparison-${revision}`} base={opened.packet} sourceName={opened.name} locale={locale} active={active} />
            <ManualAssessmentReview key={revision} {...opened.packet} disabled={false} onChange={review => setOpened(current => current ? { ...current, packet: { ...current.packet, review } } : current)} />
          </div>}
        </div>
        <footer className={styles.footer}><p>{tx("Closing this window keeps notes in this tab. Save a new JSON before reloading or leaving the page.", "Закрытие окна сохранит замечания в этой вкладке. Перед обновлением или закрытием страницы скачайте новый JSON.")}</p><button type="button" onClick={close}>{tx("Close", "Закрыть")}</button></footer>
      </div>
    </dialog>
  </>;
}
