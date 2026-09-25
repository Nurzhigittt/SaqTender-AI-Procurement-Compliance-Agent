"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { translate } from "@/lib/i18n";
import { createReportHtml, reportFilename, type ReportExportInput } from "@/lib/report-export";
import styles from "./report-actions.module.css";

type Props = ReportExportInput & { disabled?: boolean };

export function ReportActions({ assessment, mode, analyzedAt, locale, disabled = false }: Props) {
  const [error, setError] = useState(false);
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  function download() {
    if (disabled) return;
    setError(false);
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const input = { assessment, mode, analyzedAt, locale };
      const blob = new Blob([createReportHtml(input)], { type: "text/html;charset=utf-8" });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = reportFilename(input);
      document.body.appendChild(link);
      link.click();
    } catch {
      setError(true);
    } finally {
      link?.remove();
      // Allow the browser to begin the download before releasing the temporary Blob.
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
    }
  }
  const hint = disabled
    ? tx("Run a new check before downloading this report.", "Повторите проверку перед скачиванием отчёта.")
    : tx("Standalone HTML report. Open it to print or save as PDF.", "HTML-отчёт. Откройте файл для печати или сохранения в PDF.");
  return <div className={styles.wrapper}>
    <span title={hint} className={styles.buttonHint}><button type="button" className={styles.download} disabled={disabled} onClick={download} aria-label={tx("Download full report as HTML", "Скачать полный отчёт в HTML")}><Download size={15} aria-hidden="true" /><span>{tx("Download report", "Скачать отчёт")}</span><span className={styles.format}>.html</span></button></span>
    {error && <p className={styles.error} role="alert">{tx("Could not download the report. Please try again.", "Не удалось скачать отчёт. Попробуйте ещё раз.")}</p>}
  </div>;
}
