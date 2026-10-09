"use client";

import { useId, useRef, useState } from "react";
import { Building2, Check, Info, Pencil, RotateCcw, X } from "lucide-react";
import { DEMO_COMPANY, resolveCompanyProfile } from "@/lib/demo-data";
import { getDocumentTitle, translate, type Locale } from "@/lib/i18n";
import type { CompanyDocument, CompanyProfile } from "@/lib/types";
import styles from "./company-editor.module.css";

type Props = { profile: CompanyProfile; locale: Locale; remembered: boolean; disabled: boolean; onSave: (profile: CompanyProfile, remember: boolean) => void };

export function CompanyEditor({ profile, locale, remembered, disabled, onSave }: Props) {
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(profile);
  const [remember, setRemember] = useState(remembered);
  const [error, setError] = useState("");
  const id = useId();
  function close() { dialog.current?.close(); launcher.current?.focus({ preventScroll: true }); }
  function updateDocument(documentId: string, values: Partial<CompanyDocument>) {
    setDraft(current => ({ ...current, documents: current.documents.map(document => document.id === documentId ? { ...document, ...values } : document) }));
    setError("");
  }
  return <>
    <button ref={launcher} type="button" className={styles.launcher} disabled={disabled} onClick={() => { setDraft(structuredClone(profile)); setRemember(remembered); setError(""); dialog.current?.showModal(); }}><Pencil size={14} />{tx("Edit profile", "Изменить профиль")}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }}>
      <form onSubmit={event => {
        event.preventDefault();
        try { const next = resolveCompanyProfile({ ...draft, isDemo: false }); onSave(next, remember); close(); }
        catch { setError(tx("Enter a company name and industry (2–120 characters), and valid document dates.", "Введите название и отрасль (от 2 до 120 символов), проверьте даты документов.")); }
      }}>
        <div className={styles.header}><span className={styles.icon}><Building2 size={21} /></span><div><span className={styles.kicker}>{tx("COMPANY WORKSPACE", "ПРОФИЛЬ КОМПАНИИ")}</span><h2 id={`${id}-title`}>{tx("Your documents, your check", "Ваши документы для проверки")}</h2></div><button type="button" className={styles.close} onClick={close} aria-label={tx("Cancel profile editing", "Отменить редактирование профиля")}><X size={20} /></button></div>
        <div className={styles.body}>
          <p className={styles.intro}>{tx("Record document availability and dates. These entries are your statements; original files and official registries are not checked.", "Укажите наличие документов и даты. Это сведения с ваших слов: оригиналы файлов и официальные реестры не проверяются.")}</p>
          <div className={styles.companyFields}>
            <label>{tx("Company name", "Название компании")}<input autoFocus name="companyName" value={draft.name} required minLength={2} maxLength={120} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>{tx("Industry", "Отрасль")}<input name="companyIndustry" value={draft.industry} required minLength={2} maxLength={120} onChange={event => setDraft({ ...draft, industry: event.target.value })} /></label>
          </div>
          <div className={styles.documents}>{draft.documents.map((document, index) => <fieldset key={document.id}>
            <legend><span>{String(index + 1).padStart(2, "0")}</span>{getDocumentTitle(document.id, locale)}</legend>
            <div className={styles.documentFields}>
              <label>{tx("Availability", "Наличие")}<select aria-label={`${getDocumentTitle(document.id, locale)} — ${tx("availability", "наличие")}`} value={document.status} onChange={event => updateDocument(document.id, { status: event.target.value as CompanyDocument["status"], ...(event.target.value === "missing" ? { expiresAt: null, updatedAt: null } : {}) })}>
                <option value="active">{tx("Document available", "Документ есть")}</option><option value="missing">{tx("Missing", "Отсутствует")}</option><option value="not_verified">{tx("Not checked", "Не проверено")}</option>
              </select></label>
              <label>{tx("Valid until", "Действует до")}<input type="date" aria-label={`${getDocumentTitle(document.id, locale)} — ${tx("valid until", "действует до")}`} min="1900-01-01" max="2200-12-31" value={document.expiresAt ?? ""} disabled={document.status === "missing"} onInput={event => updateDocument(document.id, { expiresAt: event.currentTarget.value || null })} onChange={event => updateDocument(document.id, { expiresAt: event.target.value || null })} /></label>
              <label>{tx("Updated on", "Обновлён")}<input type="date" aria-label={`${getDocumentTitle(document.id, locale)} — ${tx("updated on", "обновлён")}`} min="1900-01-01" max="2200-12-31" value={document.updatedAt ?? ""} disabled={document.status === "missing"} onInput={event => updateDocument(document.id, { updatedAt: event.currentTarget.value || null })} onChange={event => updateDocument(document.id, { updatedAt: event.target.value || null })} /></label>
            </div>
          </fieldset>)}</div>
          <div className={styles.storage}><label><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>{tx("Remember this profile in this browser", "Запомнить профиль в этом браузере")}</span></label><p>{tx("Optional. No account or cloud sync. Anyone using this browser can see the saved profile. Uncheck and apply to remove the saved copy.", "По желанию. Без аккаунта и синхронизации. Сохранённый профиль доступен другим пользователям этого браузера. Снимите отметку и примените, чтобы удалить сохранённую копию.")}</p></div>
          <div className={styles.note}><Info size={16} /><p>{tx("A profile change requires a fresh analysis. In Live AI mode, the profile and tender text are sent to OpenAI when you run a check.", "После изменения профиля нужно повторить анализ. В режиме онлайн-ИИ профиль и текст тендера передаются в OpenAI при запуске проверки.")}</p></div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
        <div className={styles.footer}><button type="button" className={styles.reset} onClick={() => { setDraft(structuredClone(DEMO_COMPANY)); setRemember(false); setError(""); }}><RotateCcw size={14} />{tx("Demo profile", "Демопрофиль")}</button><div><button type="button" className={styles.cancel} onClick={close}>{tx("Cancel", "Отмена")}</button><button type="submit" className={styles.save}><Check size={15} />{tx("Apply profile", "Применить профиль")}</button></div></div>
      </form>
    </dialog>
  </>;
}
