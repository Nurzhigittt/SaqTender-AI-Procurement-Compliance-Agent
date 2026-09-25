"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, BookOpen, Building2, CalendarClock, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileCheck2, FileClock, FileSearch, FileText, FolderOpen, Info, LayoutDashboard, LoaderCircle, LockKeyhole, Plus, RotateCcw, ScanLine, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import type { Assessment } from "@/lib/types";
import { DEMO_COMPANY, SAMPLE_TENDER, SAMPLE_TENDER_RU, getSampleTender } from "@/lib/demo-data";
import { Badge, StatusBadge, formatDate } from "./ui";
import { AssessmentResults } from "./results";
import { DemoWalkthrough } from "./demo-walkthrough";
import { getDocumentTitle, LOCALE_COOKIE, translate, type Locale } from "@/lib/i18n";
import { analyzeDemoTender } from "@/lib/mock-analysis";

type Mode = "demo" | "live";
type ResponseData = { assessment: Assessment; mode: Mode; analyzedAt: string };
class AnalysisError extends Error {}

export function Dashboard({ initialMode, initialNow, initialLocale }: { initialMode: Mode; initialNow: string; initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const [resultLocale, setResultLocale] = useState<Locale>(initialLocale);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [tenderText, setTenderText] = useState(getSampleTender(initialLocale));
  const [result, setResult] = useState<ResponseData | null>(null);
  const [analyzedText, setAnalyzedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("requirements");
  const [activeNav, setActiveNav] = useState("overview");
  const [elapsed, setElapsed] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const now = new Date(initialNow);
  const stale = !!result && tenderText.trim() !== analyzedText;
  const assessment = result?.assessment;
  const reportLanguageMismatch = !!result && resultLocale !== locale;
  const maxLength = 20000;
  const activeDocuments = DEMO_COMPANY.documents.filter(d => d.status === "active" && (!d.expiresAt || new Date(`${d.expiresAt}T23:59:59+05:00`) >= now));
  const riskyDocuments = DEMO_COMPANY.documents.filter(d => d.status === "not_verified" || (d.expiresAt && new Date(`${d.expiresAt}T23:59:59+05:00`).getTime() - now.getTime() < 30 * 86400000));
  const missingDocuments = DEMO_COMPANY.documents.filter(d => d.status === "missing");

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    document.title = locale === "ru" ? "SaqTender AI — Помощник по тендерам" : "SaqTender AI — Procurement Compliance Agent";
  }, [locale]);
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  function changeLocale(next: Locale) {
    if (next === locale || isLoading) return;
    setLocale(next);
    setError(null);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    // Translate an untouched starter, while preserving the user's text and original evidence after analysis.
    if (!result && (tenderText === SAMPLE_TENDER || tenderText === SAMPLE_TENDER_RU)) setTenderText(getSampleTender(next));
    if (result?.mode === "demo") {
      setResult({ ...result, assessment: analyzeDemoTender(analyzedText, next) });
      setResultLocale(next);
    }
  }

  function jump(id: string) {
    setActiveNav(id);
    if (id === "alerts") { setTab("alerts"); id = "assessment"; }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function navigateDemo(target: "company-profile" | "tender-analyzer" | "requirements" | "deadlines" | "actions") {
    if (target === "company-profile" || target === "tender-analyzer") { jump(target); return; }
    if (!result || stale || reportLanguageMismatch || isLoading) return;
    setTab(target);
    setActiveNav("assessment");
    requestAnimationFrame(() => {
      if (target === "requirements") {
        const row = document.querySelector<HTMLDetailsElement>('#assessment details[data-status="missing"]')
          ?? document.querySelector<HTMLDetailsElement>('#assessment details[data-status="unknown"]');
        if (row) row.open = true;
      }
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function analyze() {
    if (isLoading) return;
    if (!tenderText.trim()) { setError(tx("Add some tender text before running a compliance check.", "Добавьте текст тендера перед запуском проверки.")); textRef.current?.focus(); return; }
    if (tenderText.length > maxLength) { setError(tx("Please shorten the tender to 20,000 characters.", "Сократите текст тендера до 20 000 символов.")); return; }
    const submittedText = tenderText.trim();
    const abortController = new AbortController();
    controller.current = abortController;
    setIsLoading(true); setError(null); setElapsed(0);
    const timeout = setTimeout(() => abortController.abort(), 65000);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json", "Accept-Language": locale }, body: JSON.stringify({ tenderText: submittedText, locale }), signal: abortController.signal });
      const data = await response.json().catch(() => { throw new AnalysisError(tx("The server response could not be read. Please try again.", "Не удалось прочитать ответ сервера. Попробуйте ещё раз.")); });
      if (!response.ok) throw new AnalysisError(typeof data?.error === "string" ? data.error : tx("The check could not be completed. Please try again.", "Не удалось завершить проверку. Попробуйте ещё раз."));
      if (!data?.assessment || !["demo", "live"].includes(data.mode)) throw new AnalysisError(tx("The report could not be read. Please try again.", "Не удалось прочитать отчёт. Попробуйте ещё раз."));
      setResult(data); setResultLocale(locale); setAnalyzedText(submittedText); setMode(data.mode); setTab("requirements");
      setActiveNav("assessment");
      requestAnimationFrame(() => { resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); resultsRef.current?.focus({ preventScroll: true }); });
    } catch (err) {
      setError(err instanceof Error && err.name === "AbortError" ? tx("The check took too long. Please try again.", "Время ожидания истекло. Попробуйте ещё раз.") : err instanceof AnalysisError ? err.message : tx("We couldn’t connect. Check your connection and retry.", "Не удалось подключиться. Проверьте интернет и повторите попытку."));
    } finally { clearTimeout(timeout); setIsLoading(false); controller.current = null; }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#tender-analyzer">{tx("Skip to tender analyzer", "Перейти к анализу тендера")}</a>
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label={tx("SaqTender AI overview", "Обзор SaqTender AI")}><span className="brand-icon"><ShieldCheck size={23} /></span><span>SaqTender<span className="brand-ai">AI</span></span></a>
      <div className="workspace-label">{tx("PROCUREMENT WORKSPACE", "РАБОЧЕЕ ПРОСТРАНСТВО")}</div>
      <nav className="side-nav" aria-label={tx("Main navigation", "Основная навигация")}>
        {[
          { id: "overview", label: tx("Overview", "Обзор"), Icon: LayoutDashboard },
          { id: "company-profile", label: tx("Company profile", "Профиль компании"), Icon: Building2 },
          { id: "tender-analyzer", label: tx("Tender analyzer", "Анализ тендера"), Icon: FileSearch },
          { id: "alerts", label: tx("Draft alerts", "Черновики напоминаний"), Icon: Bell },
        ].map(({ id, label, Icon }) => <button key={id} className={`nav-item ${activeNav === id ? "is-active" : ""}`} title={label} aria-label={label} aria-current={activeNav === id ? "location" : undefined} onClick={() => jump(id)}><Icon size={18} /><span>{label}</span>{id === "alerts" && result && !stale && <span className="nav-count">{assessment?.alerts.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="sidebar-note-icon"><ShieldCheck size={18} /></span><strong>{tx("A second pair of eyes.", "Внимание к каждой детали.")}</strong><p>{tx("Evidence-led checks for your next tender.", "Проверяйте требования тендера с опорой на документы.")}</p><button onClick={() => helpDialog.current?.showModal()}>{tx("How it works", "Как это работает")} <ArrowUpRight size={14} /></button></div>
        <button className="help-link" onClick={() => helpDialog.current?.showModal()}><CircleHelp size={18} /> {tx("Demo guide", "О демонстрации")}</button>
        <div className="workspace-profile"><span className="avatar">OB</span><span><strong>OrdaBuild Demo</strong><small>{tx("Fictional workspace", "Вымышленная компания")}</small></span><Badge tone="nav">{tx("DEMO", "ДЕМО")}</Badge></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span className="mobile-brand"><ShieldCheck size={21} /> SaqTender AI</span><span className="desktop-crumb">{tx("Workspace", "Рабочее пространство")} <ChevronRight size={14} /> <strong>{tx("Compliance overview", "Проверка требований")}</strong></span></div><div className="header-right"><div className="language-switch" role="group" aria-label={tx("Interface language", "Язык интерфейса")}><button type="button" lang="ru" aria-label="Русский" aria-pressed={locale === "ru"} disabled={isLoading} onClick={() => changeLocale("ru")}>RU</button><button type="button" lang="en" aria-label="English" aria-pressed={locale === "en"} disabled={isLoading} onClick={() => changeLocale("en")}>EN</button></div><Badge tone={mode === "demo" ? "amber" : "green"} dot>{mode === "demo" ? tx("Demo Mode", "Демо-режим") : tx("Live AI", "Онлайн-ИИ")}</Badge><span className="topbar-divider" /><span className="header-avatar">OB</span></div></header>
      <main id="overview" className="workspace-main">
        <div className="page-heading"><div><div className="eyebrow">{tx("PROCUREMENT COMPLIANCE AGENT", "ИИ-ПОМОЩНИК ПО ТЕНДЕРАМ")}</div><h1>{tx("Clarity before you submit", "Всё ясно до подачи заявки")}<span>.</span></h1><p>{tx("Your documents, tender requirements, and next steps. In one place.", "Документы, требования тендера и план действий — в одном месте.")}</p></div><div className="page-heading-tools"><div className="today-label"><CalendarClock size={16} /><span>{formatDate(initialNow, false, locale)}<small>{tx("Asia/Almaty · UTC+5", "Алматы · UTC+5")}</small></span></div><DemoWalkthrough locale={locale} hasCurrentReport={!!result && !stale && !reportLanguageMismatch} isLoading={isLoading} onNavigate={navigateDemo} /></div></div>
        <div className="demo-notice"><span className="notice-symbol"><Info size={17} /></span><p><strong>{tx("This is a demo workspace.", "Это демонстрационная версия.")}</strong> {tx("Company and sample tender data are fictional.", "Компания и образец тендера вымышлены.")} {mode === "demo" ? tx("Checks use a deterministic demo, with no live AI call.", "Проверка работает по заданным правилам, без обращения к ИИ.") : tx("Checks use live AI. Submitted text is sent to OpenAI.", "Проверку выполняет ИИ. Введённый текст передаётся в OpenAI.")}</p><button onClick={() => helpDialog.current?.showModal()} aria-label={tx("Read demo guide", "Открыть описание демонстрации")}><ArrowUpRight size={16} /></button></div>

        <section className="stats-grid" aria-label={tx("Compliance overview", "Проверка требований")}>
          <StatCard title={tx("Documents active", "Действуют")} value={activeDocuments.length} description={tx("On the company profile", "Документы компании")} Icon={FileCheck2} tone="green" />
          <StatCard title={tx("Documents at risk", "Требуют внимания")} value={riskyDocuments.length} description={tx("Expiring or unverified", "Истекают или не проверены")} Icon={FileClock} tone="amber" />
          <StatCard title={tx("Missing documents", "Отсутствуют")} value={missingDocuments.length} description={tx("Need your attention", "Нужно подготовить")} Icon={FolderOpen} tone="red" />
          <StatCard title={tx("Critical deadlines", "Ключевые сроки")} value={assessment && !stale ? assessment.deadlines.length : "—"} description={assessment && !stale ? tx("Extracted from tender text", "Из текста тендера") : tx("Run a check to identify", "Появятся после проверки")} Icon={CalendarClock} tone="blue" />
        </section>

        <div className="input-grid">
          <section id="company-profile" className="panel company-panel">
            <div className="panel-heading"><div><span className="section-kicker">{tx("01 / YOUR COMPANY", "01 / ВАША КОМПАНИЯ")}</span><h2>{tx("Compliance profile", "Профиль документов")}</h2></div><Building2 className="muted-icon" size={20} /></div>
            <div className="company-summary"><span className="company-mark"><Building2 size={25} /></span><div><h3>{DEMO_COMPANY.name}</h3><p>{tx(DEMO_COMPANY.industry, "Строительство и инженерия")}</p><span className="fictional-label">{tx("Fictional company · Demo data", "Вымышленная компания · Демоданные")}</span></div></div>
            <div className="document-list-heading"><span>{tx("COMPANY DOCUMENTS", "ДОКУМЕНТЫ КОМПАНИИ")}</span><span>{DEMO_COMPANY.documents.length} {tx("records", "записей")}</span></div>
            <div className="document-list">
              {DEMO_COMPANY.documents.map((document, index) => {
                const expiryTime = document.expiresAt ? new Date(`${document.expiresAt}T23:59:59+05:00`).getTime() : null;
                const expired = expiryTime !== null && expiryTime < now.getTime();
                const remaining = expiryTime !== null ? Math.ceil((expiryTime - now.getTime()) / 86400000) : null;
                const expirySoon = !expired && remaining !== null && remaining <= 30;
                return <div className={`document-item ${document.status === "missing" ? "document-missing" : ""}`} key={document.id}>
                  <span className={`document-icon doc-${document.status}`}><FileText size={17} /></span><div className="document-detail"><strong>{getDocumentTitle(document.id, locale)}</strong><small>{document.expiresAt ? `${tx("Expires", "Действует до")} ${formatDate(document.expiresAt, false, locale)}` : document.updatedAt ? `${tx("Updated", "Обновлён")} ${formatDate(document.updatedAt, false, locale)}` : document.status === "missing" ? tx("No supporting document", "Подтверждающего документа нет") : tx("Verification is pending", "Ожидает проверки")}{expirySoon && <span className="expiry-soon"> · {remaining}{tx("d left", " дн. до истечения")}</span>}</small></div><StatusBadge locale={locale} status={expired ? "expired" : document.status} />
                </div>;
              })}
            </div>
            <div className="profile-footer"><LockKeyhole size={14} /><span>{tx("Demo profile loaded · No official registry connection", "Демопрофиль · Нет связи с официальными реестрами")}</span></div>
          </section>

          <section id="tender-analyzer" className="panel analyzer-panel" tabIndex={-1}>
            <div className="panel-heading"><div><span className="section-kicker">{tx("02 / YOUR TENDER", "02 / ВАШ ТЕНДЕР")}</span><h2>{tx("Tender analyzer", "Анализ тендера")}</h2></div><span className="ai-icon"><Sparkles size={19} /></span></div>
            <div className="analyzer-intro"><p>{tx("Turn tender text into a clear compliance checklist.", "Проверьте требования тендера по документам компании.")}</p><button className="text-button" disabled={isLoading} onClick={() => { setTenderText(getSampleTender(locale)); setError(null); textRef.current?.focus(); }}><RotateCcw size={13} /> {tx("Load sample tender", "Загрузить пример")}</button></div>
            <label className="editor-label" htmlFor="tender-text">{tx("Tender requirements", "Требования тендера")} <span>{tx("Editable text", "Можно редактировать")}</span></label>
            <div className={`tender-editor ${error ? "has-error" : ""}`}><div className="editor-toolbar"><span><FileText size={14} /> {(tenderText === SAMPLE_TENDER || tenderText === SAMPLE_TENDER_RU) ? tx("School construction · Fictional sample", "Строительство школы · Вымышленный пример") : tx("Your tender text", "Ваш текст тендера")}</span><Badge tone="neutral">{tx("TEXT", "ТЕКСТ")}</Badge></div><textarea ref={textRef} id="tender-text" value={tenderText} onChange={e => { setTenderText(e.target.value); setError(null); }} disabled={isLoading} spellCheck={false} aria-describedby="tender-hint" aria-invalid={!!error} maxLength={maxLength + 1} placeholder={tx("Paste the tender requirements and deadlines here…", "Вставьте сюда требования тендера и сроки…")} /><div className="editor-footer"><span><LockKeyhole size={12} /> {tx("Not saved by this app", "Текст не сохраняется")}</span><span className={tenderText.length > maxLength ? "text-danger" : ""}>{tenderText.length.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} / {maxLength.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}</span></div></div>
            <p id="tender-hint" className="input-hint">{tx("Include document requirements, dates, and the original wording.", "Укажите требования к документам и сроки, сохраняя исходные формулировки.")}</p>
            {error && <div className="error-message" role="alert"><TriangleAlert size={17} /><p>{error}</p><button onClick={analyze} disabled={isLoading}>{tx("Retry", "Повторить")} <RotateCcw size={13} /></button></div>}
            <button className="run-button" onClick={analyze} disabled={isLoading || !tenderText.trim() || tenderText.length > maxLength}>{isLoading ? <><LoaderCircle className="spin" size={19} /> {tx("Checking tender…", "Проверяем тендер…")} <span>{elapsed}{tx("s", "с")}</span></> : <><Sparkles size={18} /> {tx("Run AI Compliance Check", "Проверить требования")} <ArrowRight size={18} /></>}</button>
            <p className="run-caption" aria-live="polite">{isLoading ? tx("Reviewing the provided text and company profile. This may take a moment.", "Сопоставляем текст тендера с профилем компании. Это может занять некоторое время.") : mode === "demo" ? tx("Demo analysis · Evidence included · No data saved", "Демопроверка · Цитаты из источника · Без сохранения текста") : tx("Live AI analysis · Text sent to OpenAI · Verify every finding", "Онлайн-ИИ · Текст передаётся в OpenAI · Проверьте выводы")}</p>
          </section>
        </div>

        <section id="assessment" className="results-section" ref={resultsRef} tabIndex={-1} aria-label={tx("Compliance assessment", "Результат проверки требований")}>
          {reportLanguageMismatch && <div className="stale-notice" role="status"><Info size={18} /><p>{tx("This report was generated in Russian. Run a new check for an English report. Source quotes always keep their original language.", "Этот отчёт сформирован на английском. Повторите проверку, чтобы получить русский отчёт. Цитаты сохраняют язык оригинала.")}</p><button onClick={analyze} disabled={isLoading}><RotateCcw size={14} />{tx("Run again", "Повторить")}</button></div>}
          {assessment ? <AssessmentResults reportLanguageMismatch={reportLanguageMismatch} locale={locale} assessment={assessment} mode={result!.mode} analyzedAt={result!.analyzedAt} stale={stale} tab={tab} setTab={setTab} now={initialNow} onRerun={analyze} isLoading={isLoading} /> : <div className="empty-results"><div className="empty-result-icon"><ScanLine size={27} /><span><Sparkles size={12} /></span></div><div><h2>{tx("A clearer picture starts with one check.", "Одна проверка — понятный план действий.")}</h2><p>{tx("Run the analyzer to see requirements, risks, and what to do next.", "Запустите анализ, чтобы увидеть требования, риски и рекомендации.")}</p></div><div className="empty-steps"><span><Check size={14} /> {tx("Match documents", "Сопоставление документов")}</span><span><Clock3 size={14} /> {tx("Extract deadlines", "Извлечение сроков")}</span><span><Bell size={14} /> {tx("Draft reminders", "Черновики напоминаний")}</span></div></div>}
        </section>

        <footer className="page-footer"><span><ShieldCheck size={15} /> SaqTender AI <span className="footer-dot">·</span> {tx("Built for better-informed bids.", "Принимайте решения на основе фактов.")}</span><button onClick={() => helpDialog.current?.showModal()}><BookOpen size={14} /> {tx("Responsible AI & demo guide", "Об ИИ и демонстрации")}</button></footer>
      </main>
    </div>

    <dialog ref={helpDialog} className="help-dialog" aria-labelledby="demo-guide-title" onClick={e => { if (e.target === e.currentTarget) helpDialog.current?.close(); }}><div className="dialog-header"><span className="brand-icon"><ShieldCheck size={22} /></span><button className="icon-button" onClick={() => helpDialog.current?.close()} aria-label={tx("Close demo guide", "Закрыть описание демонстрации")}><X size={20} /></button></div><span className="section-kicker">{tx("THE DEMO GUIDE", "О ДЕМОНСТРАЦИИ")}</span><h2 id="demo-guide-title">{tx("A second pair of eyes for your bid.", "Помощник при подготовке заявки.")}</h2><p>{tx("SaqTender AI compares the text you provide with a fictional company profile and builds a review checklist.", "SaqTender AI сопоставляет введённый текст с профилем вымышленной компании и формирует список для проверки.")}</p><ol className="guide-steps"><li><span>1</span><div><strong>{tx("Review the company profile", "Изучите профиль компании")}</strong><p>{tx("Five fictional document records are loaded for OrdaBuild Demo LLP.", "Для OrdaBuild Demo LLP загружены пять вымышленных записей о документах.")}</p></div></li><li><span>2</span><div><strong>{tx("Load or edit the tender", "Загрузите или измените тендер")}</strong><p>{tx("The sample covers school construction. Keep exact requirements and dates in the text.", "Образец описывает строительство школы. Сохраняйте в тексте точные требования и даты.")}</p></div></li><li><span>3</span><div><strong>{tx("Run a compliance check", "Запустите проверку требований")}</strong><p>{tx("Review every finding alongside its source evidence. Alerts are drafts only and are never sent.", "Сверьте каждый вывод с цитатой из источника. Напоминания остаются черновиками и не отправляются.")}</p></div></li></ol><div className="guide-disclaimer"><Info size={18} /><p><strong>{tx("Decision support, with human review.", "Поддержка решения с проверкой специалистом.")}</strong> {tx("Official eligibility is never verified. There is no procurement portal or registry connection. Demo Mode makes no live AI call. Live AI sends your text to OpenAI; avoid personal or confidential information in this demo. Nothing is saved by the application.", "Официальный допуск к участию не проверяется. Связи с порталом закупок и реестрами нет. Демо-режим работает без запроса к ИИ. В онлайн-режиме текст передаётся в OpenAI: не используйте персональные и конфиденциальные данные. Приложение не сохраняет текст и отчёты.")}</p></div><button className="run-button" onClick={() => { helpDialog.current?.close(); jump("tender-analyzer"); }}>{tx("Try the analyzer", "Перейти к проверке")} <ArrowRight size={17} /></button></dialog>
  </div>;
}

function StatCard({ title, value, description, Icon, tone }: { title: string; value: number | string; description: string; Icon: typeof FileCheck2; tone: string }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-top"><span>{title}</span><span className="stat-icon"><Icon size={18} /></span></div><strong className="stat-value">{value.toString().padStart(typeof value === "number" ? 2 : 1, "0")}</strong><span className="stat-description">{description}</span><div className="stat-accent" /></div>;
}
