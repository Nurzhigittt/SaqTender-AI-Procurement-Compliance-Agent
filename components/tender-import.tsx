"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, FileText, Info, LoaderCircle, Upload, X } from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";
import { importTenderFile, IMPORT_MAX_CHARS, IMPORT_TIMEOUT_MS, TenderImportError, type ImportErrorCode, type ImportedTender } from "@/lib/tender-import";
import styles from "./tender-import.module.css";

type Props = { locale: Locale; disabled: boolean; onApply: (text: string) => void };
type Preview = ImportedTender & { name: string };

export function TenderImport({ locale, disabled, onApply }: Props) {
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<ImportErrorCode | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const id = useId();
  useEffect(() => () => controller.current?.abort(), []);

  function close() {
    controller.current?.abort(); controller.current = null;
    setBusy(false); setPreview(null); setDraft(""); setError(null);
    dialog.current?.close(); launcher.current?.focus({ preventScroll: true });
  }

  async function readFile(file: File) {
    controller.current?.abort();
    const job = new AbortController(); controller.current = job;
    setBusy(true); setProgress(""); setError(null); setPreview(null); setDraft(""); setReviewed(false);
    const timer = setTimeout(() => job.abort(new TenderImportError("timeout")), IMPORT_TIMEOUT_MS);
    let abort!: () => void;
    const aborted = new Promise<never>((_, reject) => { abort = () => reject(job.signal.reason); });
    job.signal.addEventListener("abort", abort, { once: true });
    try {
      const result = await Promise.race([importTenderFile(file, job.signal, (page, total) => { if (controller.current === job) setProgress(`${page} / ${total}`); }), aborted]);
      job.signal.throwIfAborted();
      if (controller.current !== job) return;
      setPreview({ ...result, name: file.name }); setDraft(result.text);
    } catch (failure) {
      if (controller.current === job) setError(failure instanceof TenderImportError ? failure.code : "failed");
    } finally {
      clearTimeout(timer);
      job.signal.removeEventListener("abort", abort);
      if (controller.current === job) { setBusy(false); controller.current = null; }
    }
  }

  const errors: Record<ImportErrorCode, string> = {
    unsupported: tx("Choose a PDF or a UTF-8 TXT file with the matching extension.", "Выберите файл PDF или TXT в кодировке UTF-8 с соответствующим расширением."),
    size: tx("The file exceeds 5 MB. Export a smaller document and try again.", "Файл больше 5 МБ. Экспортируйте документ меньшего размера и повторите."),
    empty: tx("This file has no readable text.", "В файле нет текста для проверки."),
    encoding: tx("The TXT encoding is not UTF-8. Save it as UTF-8 or paste the text into the editor.", "Кодировка TXT отличается от UTF-8. Сохраните его в UTF-8 или вставьте текст в редактор."),
    binary: tx("This is not plain text. Export a UTF-8 TXT or PDF file.", "Вместо обычного текста обнаружены служебные символы. Экспортируйте файл в TXT UTF-8 или PDF."),
    "invalid-pdf": tx("The PDF could not be read reliably. Re-export it or paste its text manually.", "Не удалось надёжно прочитать PDF. Экспортируйте его заново или вставьте текст вручную."),
    password: tx("This PDF requires a password. Open it on your device and export an unlocked copy you are allowed to use.", "PDF защищён паролем. Откройте его на своём устройстве и сохраните доступную вам копию без пароля."),
    pages: tx("The PDF exceeds 30 pages. Import a shorter document, keeping all relevant requirements and deadlines.", "В PDF больше 30 страниц. Подготовьте документ меньшего объёма, сохранив важные требования и сроки."),
    length: tx("The text exceeds 20,000 characters. Nothing was truncated or applied. Prepare a shorter document that preserves the relevant requirements and dates.", "Текст превышает 20 000 символов. Он не обрезан и не применён. Подготовьте документ меньшего объёма, сохранив важные требования и даты."),
    "no-text": tx("No text layer was found. This may be a scan or an image-only PDF. Run OCR elsewhere, then import the recognized text. OCR is not built in.", "Текстовый слой не найден. Возможно, это скан или PDF из изображений. Сначала распознайте текст с помощью OCR, затем импортируйте его. Встроенного OCR пока нет."),
    timeout: tx("Reading took more than 30 seconds. Try a smaller file or paste the text manually.", "Чтение заняло больше 30 секунд. Попробуйте файл меньшего размера или вставьте текст вручную."),
    failed: tx("The file could not be read. Try again or paste the text manually.", "Не удалось прочитать файл. Повторите попытку или вставьте текст вручную."),
  };
  const valid = draft.trim().length >= 20 && draft.length <= IMPORT_MAX_CHARS;
  const needsReview = !!preview?.emptyPages.length;

  return <>
    <div className={styles.launchRow}><button ref={launcher} className={styles.launcher} type="button" disabled={disabled} onClick={() => { setError(null); setPreview(null); setDraft(""); dialog.current?.showModal(); }}><Upload size={15} />{tx("Import PDF / TXT", "Загрузить PDF / TXT")}</button><span>{tx("Or paste text below", "Или вставьте текст ниже")}</span></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }}>
      <div className={styles.content}>
        <div className={styles.header}><span className={styles.icon}><FileText size={22} /></span><div><span className={styles.kicker}>{tx("YOUR TENDER DOCUMENT", "ДОКУМЕНТ ТЕНДЕРА")}</span><h2 id={`${id}-title`}>{tx("Check the text before analysis", "Проверьте текст перед анализом")}</h2></div><button className={styles.close} type="button" onClick={close} aria-label={tx("Close file import", "Закрыть загрузку файла")}><X size={20} /></button></div>
        <div className={styles.body}>
          <p className={styles.intro}>{tx("The file is read in this browser. Only the text you apply is sent to the server when you start a check; Live AI also sends it to OpenAI.", "Файл читается в этом браузере. Только применённый вами текст передаётся на сервер при запуске проверки, а в режиме онлайн-ИИ — также в OpenAI.")}</p>
          <label className={styles.fileLabel} htmlFor={`${id}-file`}>{tx("Choose a document", "Выберите документ")}</label>
          <input id={`${id}-file`} type="file" accept=".pdf,.txt,application/pdf,text/plain" disabled={busy} aria-describedby={`${id}-limits`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void readFile(file); }} />
          <p id={`${id}-limits`} className={styles.limits}>{tx("PDF with a text layer or UTF-8 TXT · Up to 5 MB, 30 PDF pages, 20,000 characters · No OCR", "PDF с текстовым слоем или TXT UTF-8 · До 5 МБ, 30 страниц PDF, 20 000 символов · Без OCR")}</p>
          {busy && <p className={styles.reading} role="status"><LoaderCircle size={18} className="spin" />{tx("Reading document…", "Читаем документ…")} {progress}</p>}
          {error && <p className={styles.error} role="alert">{errors[error]}</p>}
          {preview && <>
            <div className={styles.fileSummary}><FileText size={16} /><strong>{preview.name}</strong><span>{preview.pageCount !== null ? `${preview.pageCount} ${tx("pages", "стр.")}` : "TXT"}</span></div>
            {preview.format === "pdf" && <div className={styles.note}><Info size={16} /><p>{tx("Text order, tables and characters may differ from the PDF. Compare requirements, amounts and dates with the original. Images and handwritten notes are not recognized.", "Порядок текста, таблицы и символы могут отличаться от PDF. Сверьте требования, суммы и даты с оригиналом. Изображения и рукописные пометки не распознаются.")}</p></div>}
            {needsReview && <div className={styles.warning}><p>{tx("Pages without extractable text:", "Страницы без извлекаемого текста:")} <strong>{preview.emptyPages.join(", ")}</strong>. {tx("They may be blank or contain scans. Add any missing requirements before applying.", "Они могут быть пустыми или содержать сканы. Добавьте недостающие требования перед применением.")}</p><label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />{tx("I reviewed these pages and included any missing information.", "Я проверил эти страницы и добавил недостающие сведения.")}</label></div>}
            <label className={styles.previewLabel} htmlFor={`${id}-text`}>{tx("Extracted text · Editable", "Извлечённый текст · Можно исправить")}</label>
            <textarea id={`${id}-text`} value={draft} spellCheck={false} aria-describedby={`${id}-count`} onChange={event => setDraft(event.target.value)} />
            <p id={`${id}-count`} className={!valid ? styles.errorCount : styles.count}>{draft.length.toLocaleString(locale)} / 20 000 · {tx("At least 20 characters", "Не менее 20 символов")}</p>
          </>}
        </div>
        <div className={styles.footer}><p>{tx("Applying replaces the editor text. Analysis starts separately.", "Применение заменит текст в редакторе. Анализ запускается отдельно.")}</p><div><button type="button" className={styles.cancel} onClick={close}>{busy ? tx("Cancel reading", "Отменить чтение") : tx("Cancel", "Отмена")}</button><button type="button" className={styles.apply} disabled={!preview || busy || !valid || (needsReview && !reviewed)} onClick={() => { onApply(draft.trim()); close(); }}>{tx("Use this text", "Использовать текст")}<ArrowRight size={15} /></button></div></div>
      </div>
    </dialog>
  </>;
}
