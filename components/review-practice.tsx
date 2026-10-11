"use client";

import { useState } from "react";
import { Download, GraduationCap } from "lucide-react";
import type { createPracticeReviews } from "@/lib/review-practice";
import { translate, type Locale } from "@/lib/i18n";
import styles from "./review-practice.module.css";

type Practice = ReturnType<typeof createPracticeReviews>;

export function PracticeReviewGuide({ practice, locale }: { practice: Practice; locale: Locale }) {
  const [error, setError] = useState(false);
  const tx = (en: string, ru: string) => translate(locale, en, ru);

  function download(kind: "left" | "right" | "source") {
    setError(false);
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const source = kind === "source";
      const file = source ? null : practice[kind];
      const content = source ? practice.sourceText : `${JSON.stringify(file!.packet, null, 2)}\n`;
      url = URL.createObjectURL(new Blob([content], { type: source ? "text/plain;charset=utf-8" : "application/json;charset=utf-8" }));
      link = document.createElement("a");
      link.href = url;
      link.download = source ? `saqtender-practice-source-${practice.left.packet.locale}.txt` : file!.name;
      document.body.appendChild(link); link.click();
    } catch { setError(true); }
    finally { link?.remove(); if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); } }
  }

  return <section className={styles.guide} lang={locale} aria-label={tx("Team practice", "Тренировка команды")}>
    <div className={styles.title}><GraduationCap size={19} /><h3>{tx("Try reviewing together", "Попробуйте проверку с командой")}</h3><span>{tx("Fictional example", "Учебный пример")}</span></div>
    <p>{tx("A and B are prefilled fictional opinions, not real reviewers or an answer key. The report is a fixed demo from 24 September 2026; its dates are historical. No AI request is made.", "А и Б — заранее заполненные вымышленные мнения, а не реальные проверяющие или эталон ответов. Отчёт — фиксированный демопример от 24 сентября 2026 года; даты в нём исторические. Запроса к ИИ нет.")}</p>
    <ol>
      <li>{tx("Read the full sample below, then inspect the disagreement and its source quote in the comparison.", "Прочитайте полный пример ниже, затем найдите разногласие и цитату в сравнении.")}</li>
      <li>{tx("Edit A in Manual review below and explain your opinion. The comparison updates immediately; B remains separate.", "Измените оценку А в «Ручной проверке» ниже и объясните её. Сравнение сразу обновится; Б останется отдельно.")}</li>
      <li>{tx("Save your edited JSON with Save to continue, or download the comparison HTML to discuss together.", "Скачайте свои изменения кнопкой «Сохранить для продолжения · JSON» либо общую сводку HTML для обсуждения.")}</li>
    </ol>
    <details className={styles.source}><summary>{tx("Full fictional tender text", "Полный текст учебного тендера")}</summary><pre lang={practice.left.packet.locale} tabIndex={0} role="region" aria-label={tx("Practice tender text", "Текст учебного тендера")}>{practice.sourceText}</pre></details>
    <details className={styles.files}><summary>{tx("Download original practice files", "Скачать исходные учебные файлы")}</summary><p>{tx("These files contain the original prefilled example, without your edits. Share them and the source text so your team can try the same workflow.", "Эти файлы содержат исходный заполненный пример без ваших изменений. Передайте их вместе с текстом тендера, чтобы команда могла повторить сценарий.")}</p><div><button type="button" onClick={() => download("left")}><Download size={14} />{tx("Original practice A · JSON", "Исходный учебный А · JSON")}</button><button type="button" onClick={() => download("right")}><Download size={14} />{tx("Original practice B · JSON", "Исходный учебный Б · JSON")}</button><button type="button" onClick={() => download("source")}><Download size={14} />{tx("Tender source · TXT", "Текст тендера · TXT")}</button></div></details>
    {error && <p className={styles.error} role="alert">{tx("The file could not be downloaded. Try again.", "Не удалось скачать файл. Попробуйте ещё раз.")}</p>}
  </section>;
}
