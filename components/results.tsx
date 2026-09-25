"use client";

import { ArrowRight, Bell, CalendarClock, Check, ChevronDown, CircleHelp, Clock3, FileCheck2, Info, ListChecks, Quote, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Assessment } from "@/lib/types";
import { translate, translateCompanyEvidence, type Locale } from "@/lib/i18n";
import { Badge, StatusBadge, formatDate } from "./ui";
import { ReportActions } from "./report-actions";

type Props = { assessment: Assessment; mode: "demo" | "live"; analyzedAt: string; stale: boolean; tab: string; setTab: (tab: string) => void; now: string; onRerun: () => void; isLoading: boolean; locale: Locale; reportLanguageMismatch?: boolean };

export function AssessmentResults({ assessment, mode, analyzedAt, stale, tab, setTab, now, onRerun, isLoading, locale, reportLanguageMismatch = false }: Props) {
  const tx = (en: string, ru: string) => translate(locale, en, ru);
  const tabs = [
    { id: "requirements", label: tx("Requirements", "Требования"), count: assessment.requirements.length, icon: ListChecks },
    { id: "deadlines", label: tx("Deadlines", "Сроки"), count: assessment.deadlines.length, icon: CalendarClock },
    { id: "actions", label: tx("Next actions", "Действия"), count: assessment.actions.length, icon: FileCheck2 },
    { id: "alerts", label: tx("Draft alerts", "Напоминания"), count: assessment.alerts.length, icon: Bell },
    { id: "evidence", label: tx("Source evidence", "Источники"), count: null, icon: Quote },
  ];
  const counts = { met: 0, missing: 0, at_risk: 0, unknown: 0 };
  const statusLabels = { met: tx("met", "выполнено"), missing: tx("missing", "отсутствует"), at_risk: tx("at risk", "с риском"), unknown: tx("unknown", "нет данных") };
  const priorityLabels = { critical: tx("critical", "Критический"), high: tx("high", "Высокий"), medium: tx("medium", "Средний"), low: tx("low", "Низкий") };
  assessment.requirements.forEach(r => counts[r.status]++);
  const focusFinding = ["missing", "at_risk", "unknown"].flatMap(status => assessment.requirements.filter(item => item.status === status))[0];
  const datedDeadlines = [...assessment.deadlines].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const nextDeadline = datedDeadlines.find(item => Date.parse(item.date) >= Date.parse(now));
  const passedDeadlines = datedDeadlines.filter(item => Date.parse(item.date) < Date.parse(now));
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const firstAction = [...assessment.actions].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0];
  function inspect(target: string, revealFinding = false) {
    setTab(target);
    requestAnimationFrame(() => {
      const panel = document.getElementById(`panel-${target}`);
      if (revealFinding && focusFinding) {
        const row = document.getElementById(`requirement-${assessment.requirements.indexOf(focusFinding)}`) as HTMLDetailsElement | null;
        if (row) { row.open = true; row.scrollIntoView({ behavior: "smooth", block: "center" }); row.querySelector("summary")?.focus({ preventScroll: true }); return; }
      }
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      panel?.focus({ preventScroll: true });
    });
  }
  const riskTone = { high: "red", medium: "amber", low: "green", unknown: "neutral" }[assessment.overallRisk];
  const riskLabel = {
    high: tx("High risk", "Высокий риск"),
    medium: tx("Medium risk", "Средний риск"),
    low: tx("Low risk", "Низкий риск"),
    unknown: tx("Unknown risk", "Риск не определён"),
  }[assessment.overallRisk];
  const riskTitle = {
    high: tx("A few things need your attention.", "Есть вопросы, требующие внимания."),
    medium: tx("Review the open questions before submitting.", "Уточните открытые вопросы до подачи заявки."),
    low: tx("No blocker detected in provided data.", "В предоставленных данных препятствий не найдено."),
    unknown: tx("More evidence is needed to assess this tender.", "Для оценки тендера нужно больше данных."),
  }[assessment.overallRisk];
  return <>
    <div className="results-title">
      <div><span className="section-kicker">{tx("03 / YOUR ASSESSMENT", "03 / РЕЗУЛЬТАТ ПРОВЕРКИ")}</span><h2>{tx("From requirements to next steps.", "От требований к плану действий.")}</h2></div>
      <div className="report-heading-actions"><span className="analyzed-at"><Check size={13} /> {mode === "demo" ? tx("Demo analysis", "Демоанализ") : tx("AI analysis", "ИИ-анализ")} · {formatDate(analyzedAt, true, locale)}</span><ReportActions assessment={assessment} mode={mode} analyzedAt={analyzedAt} locale={locale} disabled={stale || reportLanguageMismatch || isLoading} /></div>
    </div>
    {stale && <div className="stale-notice" role="status"><TriangleAlert size={18} /><p><strong>{tx("Tender text has changed.", "Текст тендера изменился.")}</strong> {tx("This report refers to the previous text. Run a new check before using it.", "Отчёт относится к предыдущему тексту. Запустите проверку заново, прежде чем использовать его.")}</p><button onClick={onRerun} disabled={isLoading}><RotateCcw size={14} /> {tx("Run again", "Повторить")}</button></div>}
    <div className={`assessment-summary risk-${assessment.overallRisk}`}>
      <div className="assessment-main">
        <span className="assessment-icon">{assessment.overallRisk === "low" ? <ShieldCheck size={27} /> : <TriangleAlert size={26} />}</span>
        <div>
          <div className="assessment-eyebrow">{mode === "demo" ? tx("DEMO RISK ASSESSMENT", "ДЕМООЦЕНКА РИСКОВ") : tx("AI RISK ASSESSMENT", "ИИ-ОЦЕНКА РИСКОВ")} <Badge tone={riskTone}>{riskLabel}</Badge></div>
          <h3>{riskTitle}</h3><p>{assessment.summary}</p>
          <div className="verification-note"><Info size={14} /> {tx("Official eligibility not verified", "Официальный допуск не проверен")} <span>·</span> {tx("Manual verification required", "Нужна ручная проверка")}</div>
        </div>
      </div>
      <div className="requirement-breakdown">
        <span className="breakdown-label">{tx("REQUIREMENT CHECK", "ПРОВЕРКА ТРЕБОВАНИЙ")}</span>
        <div className="breakdown-bar">{Object.entries(counts).map(([status, count]) => count > 0 && <span key={status} className={`bar-${status}`} style={{ flex: count }} title={`${statusLabels[status as keyof typeof counts]}: ${count}`} />)}</div>
        <div className="breakdown-labels">{Object.entries(counts).map(([status, count]) => <span key={status}><i className={`bar-${status}`} />{count} {statusLabels[status as keyof typeof counts]}</span>)}</div>
      </div>
    </div>

    {!stale && !reportLanguageMismatch && <section className="review-priorities" aria-label={tx("Where to start", "С чего начать")}>
      <article className={`review-priority ${focusFinding?.status === "missing" ? "priority-gap" : ""}`}>
        <span className="priority-kicker"><FileCheck2 size={15} />{tx("REVIEW THE EVIDENCE", "ПРОВЕРЬТЕ ПОДТВЕРЖДЕНИЯ")}</span>
        <h3>{focusFinding?.title ?? tx("Review the original documents", "Сверьте оригиналы документов")}</h3>
        <p>{focusFinding ? tx(`${counts.missing} missing · ${counts.at_risk} at risk · ${counts.unknown} unresolved`, `Отсутствует: ${counts.missing} · С риском: ${counts.at_risk} · Нет данных: ${counts.unknown}`) : tx("Recorded matches still need a specialist's review.", "Совпадения по данным профиля требуют проверки специалистом.")}</p>
        <button disabled={isLoading} onClick={() => inspect("requirements", true)}>{tx("Inspect the evidence", "Посмотреть обоснование")}<ArrowRight size={14} /></button>
      </article>
      <article className="review-priority">
        <span className="priority-kicker"><CalendarClock size={15} />{tx("WATCH THE DATES", "УЧТИТЕ СРОКИ")}</span>
        <h3>{nextDeadline ? formatDate(nextDeadline.date, true, locale) : passedDeadlines.length ? tx("Listed deadlines have passed", "Указанные сроки прошли") : tx("Verify the dates manually", "Уточните даты вручную")}</h3>
        <p>{nextDeadline ? `${nextDeadline.title} · ${tx("Almaty", "Алматы")}` : tx("Check the complete tender and its current status.", "Проверьте полный текст тендера и его текущий статус.")}</p>
        {passedDeadlines.length > 0 && <span className="priority-past">{tx(`Passed deadlines: ${passedDeadlines.length}`, `Прошедших сроков: ${passedDeadlines.length}`)}</span>}
        <button disabled={isLoading} onClick={() => inspect("deadlines")}>{tx("All deadlines", "Все сроки")}<ArrowRight size={14} /></button>
      </article>
      <article className="review-priority priority-action">
        <span className="priority-kicker"><ListChecks size={15} />{tx("YOUR NEXT ACTION", "СЛЕДУЮЩЕЕ ДЕЙСТВИЕ")}</span>
        <h3>{firstAction?.title ?? tx("Review the source together", "Проверьте источник со специалистом")}</h3>
        <p>{tx("A recommendation for your review. Confirm it against the full tender.", "Рекомендация для вашей проверки. Сверьте её с полной документацией.")}</p>
        <button disabled={isLoading} onClick={() => inspect("actions")}>{tx("Action plan", "План действий")}<ArrowRight size={14} /></button>
      </article>
    </section>}

    <div className="panel result-panel">
      <div className="result-tabs" role="tablist" aria-label={tx("Assessment details", "Подробности проверки")}>
        {tabs.map(({ id, label, count, icon: Icon }, index) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} className={tab === id ? "selected" : ""} onClick={() => setTab(id)} onKeyDown={e => { let next = index; if (e.key === "ArrowRight") next = (index + 1) % tabs.length; else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length; else if (e.key === "Home") next = 0; else if (e.key === "End") next = tabs.length - 1; else return; e.preventDefault(); setTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }}><Icon size={16} /><span>{label}</span>{count !== null && <span className="tab-count">{count}</span>}</button>)}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-content" tabIndex={0}>
        {tab === "requirements" && <>
          <div className="tab-description"><p>{tx("Requirements matrix", "Матрица требований")} <span>{tx("Each finding is linked to the provided tender.", "Каждый вывод подкреплён текстом тендера.")}</span></p><span className="expand-hint">{tx("Expand a row to inspect evidence", "Раскройте строку, чтобы увидеть обоснование")} <ChevronDown size={13} /></span></div>
          <div className="requirements-header"><span>{tx("TENDER REQUIREMENT", "ТРЕБОВАНИЕ ТЕНДЕРА")}</span><span>{tx("COMPANY EVIDENCE", "ДАННЫЕ КОМПАНИИ")}</span><span>{tx("STATUS", "СТАТУС")}</span><span /></div>
          {assessment.requirements.length ? assessment.requirements.map((r, index) => <details id={`requirement-${index}`} className="requirement-row" data-status={r.status} key={index}>
            <summary><span className="requirement-title"><span className="row-number">{String(index + 1).padStart(2, "0")}</span><strong>{r.title}</strong></span><span className="company-evidence-preview">{translateCompanyEvidence(r.companyEvidence, locale)}</span><StatusBadge status={r.status} locale={locale} /><ChevronDown className="expand-icon" size={16} /></summary>
            <div className="requirement-expanded"><div><span className="evidence-label"><Quote size={13} /> {tx("TENDER EVIDENCE", "ЦИТАТА ИЗ ТЕНДЕРА")}</span><blockquote>{r.tenderEvidence}</blockquote></div><div><span className="evidence-label"><FileCheck2 size={13} /> {tx("COMPANY EVIDENCE", "ДАННЫЕ КОМПАНИИ")}</span><p>{translateCompanyEvidence(r.companyEvidence, locale)}</p><span className="evidence-label">{tx("ASSESSMENT", "ОЦЕНКА")}</span><p>{r.explanation}</p></div></div>
          </details>) : <EmptyDetail text={tx("No supported requirements were extracted. Add clearer tender text and run again.", "Подтверждённые требования не найдены. Добавьте более подробный текст тендера и повторите проверку.")} />}
        </>}

        {tab === "deadlines" && <>
          <div className="tab-description"><p>{tx("Tender deadlines", "Сроки тендера")} <span>{tx("All times shown in Asia/Almaty (UTC+5).", "Время указано по Алматы (UTC+5).")}</span></p><Badge tone="neutral">{tx("Source-backed dates", "Даты из текста")}</Badge></div>
          <div className="deadline-grid">{[...assessment.deadlines].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).map((d, index) => { const past = Date.parse(d.date) < Date.parse(now); return <article className="deadline-card" key={index}><div className="deadline-card-top"><span className="deadline-icon"><CalendarClock size={21} /></span><Badge tone={past ? "red" : "amber"}>{past ? tx("Deadline passed", "Срок прошёл") : tx("Upcoming", "Предстоит")}</Badge></div><h3>{d.title}</h3><time dateTime={d.date}>{formatDate(d.date, true, locale)}</time><span className="timezone-note">{tx("Asia/Almaty · UTC+5", "Алматы · UTC+5")}</span><div className="deadline-evidence"><Quote size={14} /><blockquote>{d.tenderEvidence}</blockquote></div></article>; })}</div>
          {!assessment.deadlines.length && <EmptyDetail text={tx("No deadline with a verifiable date and timezone was found. Check the source and add the exact date, time, and timezone.", "Не найдены сроки с подтверждённой датой и часовым поясом. Проверьте источник и добавьте точные дату, время и часовой пояс.")} />}
        </>}

        {tab === "actions" && <>
          <div className="tab-description"><p>{tx("Recommended actions", "Рекомендуемые действия")} <span>{tx("Suggestions for your review, separate from detected facts.", "Рекомендации для вашей проверки, отдельно от выявленных фактов.")}</span></p></div>
          <div className="action-list">{assessment.actions.map((a, index) => <article key={index} className="action-item"><span className="action-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{a.title}</h3><p>{a.description}</p></div><Badge tone={a.priority === "critical" ? "red" : a.priority === "high" ? "amber" : "neutral"}>{priorityLabels[a.priority]}</Badge></article>)}</div>
          {!assessment.actions.length && <EmptyDetail text={tx("No specific action was suggested. Verify the source documents before submitting.", "Конкретных рекомендаций нет. Проверьте исходные документы перед подачей заявки.")} />}
        </>}

        {tab === "alerts" && <>
          <div className="tab-description"><p>{tx("Draft reminders", "Черновики напоминаний")} <span>{tx("7 days, 3 days, and 24 hours before each deadline.", "За 7 дней, 3 дня и 24 часа до каждого срока.")}</span></p><Badge tone="neutral">{tx("Not sent or scheduled", "Отправка не настроена")}</Badge></div>
          <div className="alert-notice"><Info size={16} /><p>{tx("Drafts are review records only. No email or Telegram messages will be sent. Past reminder times are marked below.", "Черновики созданы только для просмотра. Сообщения по email и в Telegram не отправляются. Прошедшие даты напоминаний отмечены ниже.")}</p></div>
          <div className="alert-list">{[...assessment.alerts].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)).map((a, index) => <article className="alert-item" key={index}><span className="alert-icon"><Bell size={16} /></span><div><h3>{a.title}</h3><p><Clock3 size={13} /> {formatDate(a.scheduledAt, true, locale)} · {tx("Asia/Almaty", "Алматы")}</p></div><div className="alert-tags">{Date.parse(a.scheduledAt) < Date.parse(now) && <span className="past-label">{tx("Past reminder time", "Время уже прошло")}</span>}<Badge tone="neutral">{tx("Draft", "Черновик")}</Badge></div></article>)}</div>
          {!assessment.alerts.length && <EmptyDetail text={tx("Draft alerts appear when a supported deadline is extracted.", "Черновики напоминаний появятся, когда в тексте будет найден подтверждённый срок.")} />}
        </>}

        {tab === "evidence" && <>
          <div className="tab-description"><p>{tx("Source evidence", "Цитаты из источника")} <span>{tx("Direct excerpts from the analyzed tender text.", "Дословные выдержки из проверенного текста тендера.")}</span></p><Badge tone="neutral">{tx(`${assessment.requirements.length + assessment.deadlines.length} excerpts`, `Цитат: ${assessment.requirements.length + assessment.deadlines.length}`)}</Badge></div>
          <div className="evidence-grid">{[...assessment.requirements.map(r => ({ title: r.title, evidence: r.tenderEvidence, type: tx("REQUIREMENT", "ТРЕБОВАНИЕ") })), ...assessment.deadlines.map(d => ({ title: d.title, evidence: d.tenderEvidence, type: tx("DEADLINE", "СРОК") }))].map((e, index) => <article key={index} className="source-card"><span className="source-type"><Quote size={14} /> {e.type} <span>{String(index + 1).padStart(2, "0")}</span></span><h3>{e.title}</h3><blockquote>{e.evidence}</blockquote><span className="source-origin"><FileCheck2 size={12} /> {tx("Provided tender text", "Предоставленный текст тендера")}</span></article>)}</div>
          {!assessment.requirements.length && !assessment.deadlines.length && <EmptyDetail text={tx("No supported excerpts were found in this text.", "В этом тексте не найдены цитаты, подтверждающие требования или сроки.")} />}
        </>}
      </div>
    </div>
    <div className="responsible-note"><ShieldCheck size={19} /><p><strong>{tx("AI assists. You decide.", "ИИ помогает. Решение за вами.")}</strong> {assessment.disclaimer}</p></div>
  </>;
}

function EmptyDetail({ text }: { text: string }) { return <div className="empty-detail"><CircleHelp size={23} /><p>{text}</p></div>; }
