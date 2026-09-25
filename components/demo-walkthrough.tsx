"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Info, X } from "lucide-react";
import styles from "./demo-walkthrough.module.css";

type WalkthroughTarget = "company-profile" | "tender-analyzer" | "requirements" | "deadlines" | "actions";

type DemoWalkthroughProps = {
  locale: "ru" | "en";
  hasCurrentReport: boolean;
  isLoading: boolean;
  onNavigate: (target: WalkthroughTarget) => void;
};

const TARGETS: WalkthroughTarget[] = ["company-profile", "tender-analyzer", "requirements", "deadlines", "actions"];

export function DemoWalkthrough({ locale, hasCurrentReport, isLoading, onNavigate }: DemoWalkthroughProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [requestedStep, setRequestedStep] = useState(0);
  const [compactOverride, setCompactOverride] = useState<{ step: number; value: boolean } | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigateRef = useRef(onNavigate);
  const id = useId();
  const canExploreReport = hasCurrentReport && !isLoading;
  const step = requestedStep >= 2 && !canExploreReport ? 1 : requestedStep;
  // Keep the normal analyzer button exposed while the presenter runs a check.
  // A manual fold/unfold changes only the guide's presentation, never its step.
  const isCompact = compactOverride?.step === step ? compactOverride.value : step === 1;
  const tr = (en: string, ru: string) => locale === "ru" ? ru : en;
  const steps = [
    {
      title: tr("Start with the company", "Начните с компании"),
      description: tr("Show the document profile: what is recorded, what is missing, and what still needs verification. Explain that this company and its records are fictional.", "Покажите профиль: какие документы указаны, чего не хватает и что ещё нужно проверить. Объясните, что компания и её записи вымышлены."),
    },
    {
      title: tr("Review the tender and run a check", "Изучите тендер и запустите проверку"),
      description: tr("Show the tender text and its dates, then use the analyzer's check button. Name the mode shown on screen: Demo Mode uses fixed rules; Live AI sends text to the model.", "Покажите текст тендера и даты, затем нажмите кнопку проверки в анализаторе. Назовите режим на экране: деморежим работает по правилам, онлайн-ИИ передаёт текст модели."),
    },
    {
      title: tr("Connect each finding to its evidence", "Свяжите вывод с доказательством"),
      description: tr("Expand a requirement to show its source quote and company evidence. Explain any missing document or unknown status. A matched requirement is not official approval.", "Раскройте требование: покажите цитату и данные компании. Объясните отсутствие документа или статус «нет данных». Выполненное требование не означает официального допуска."),
    },
    {
      title: tr("Show the dates and draft reminders", "Покажите сроки и черновики"),
      description: tr("Review the deadlines and their time zone, then open Draft alerts. Reminders are drafts only, including any dates that have already passed; nothing is sent.", "Проверьте сроки и часовой пояс, затем откройте вкладку «Напоминания». Это только черновики, в том числе на уже прошедшие даты; сообщения не отправляются."),
    },
    {
      title: tr("Finish with actions and export", "Завершите действиями и экспортом"),
      description: tr("Show the recommended next steps and export the report for review. Explain what the specialist should verify against the original documents before using it.", "Покажите следующие действия и экспортируйте отчёт для проверки. Объясните, что специалисту нужно сверить с оригиналами документов перед использованием результата."),
    },
  ];
  const atLastStep = step === steps.length - 1;
  const nextBlocked = !atLastStep && step + 1 >= 2 && !canExploreReport;

  function closeGuide() {
    setIsOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => { navigateRef.current = onNavigate; }, [onNavigate]);

  // Stale reports and checks in progress return the guide to the analyzer.
  // Navigation is the only external effect: the guide never starts a check.
  useEffect(() => {
    if (requestedStep >= 2 && !canExploreReport) setRequestedStep(1);
  }, [requestedStep, canExploreReport]);

  useEffect(() => {
    if (isOpen) navigateRef.current(TARGETS[step]);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus({ preventScroll: true });
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Let a native modal above this non-modal guide handle its own Escape.
      if (event.target instanceof Element && event.target.closest("dialog[open]")) return;
      event.preventDefault();
      setIsOpen(false);
      launcherRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen]);

  return <>
    <button
      ref={launcherRef}
      type="button"
      className={styles.launcher}
      aria-expanded={isOpen}
      aria-controls={isOpen ? `${id}-panel` : undefined}
      onClick={() => {
        if (isOpen) closeGuide();
        else { setRequestedStep(0); setCompactOverride(null); setIsOpen(true); }
      }}
    >
      <BookOpen size={16} aria-hidden="true" />
      {tr("Demo walkthrough", "Сценарий показа")}
    </button>

    {isOpen && <div
      ref={panelRef}
      id={`${id}-panel`}
      className={styles.panel}
      data-compact={isCompact}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-heading`}
      aria-describedby={isCompact ? `${id}-compact-description` : `${id}-description`}
      tabIndex={-1}
    >
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.guideIcon}><BookOpen size={17} aria-hidden="true" /></span>
          <div>
            <h2 id={`${id}-heading`} className={styles.heading}>{tr("Demo walkthrough", "Сценарий показа")}</h2>
            <span className={styles.counter}>{tr(`Step ${step + 1} of ${steps.length}`, `Шаг ${step + 1} из ${steps.length}`)}</span>
          </div>
        </div>
        <div className={styles.headerControls}>
          {!isCompact && <button type="button" className={styles.close} onClick={() => setCompactOverride({ step, value: true })} aria-label={tr("Minimize walkthrough and keep current step", "Свернуть сценарий, сохранив шаг")} title={tr("Minimize", "Свернуть")}><ChevronDown size={18} aria-hidden="true" /></button>}
          <button type="button" className={styles.close} onClick={closeGuide} aria-label={tr("Close walkthrough", "Закрыть сценарий показа")} title={tr("Close · Esc", "Закрыть · Esc")}><X size={18} aria-hidden="true" /></button>
        </div>
      </div>

      {isCompact ? <div className={styles.compactBody} aria-live="polite" aria-atomic="true">
        <p id={`${id}-compact-description`}>{step === 1
          ? isLoading ? tr("Check in progress.", "Идёт проверка.")
            : hasCurrentReport ? tr("Report ready. Continue below.", "Отчёт готов. Нажмите «Далее».")
              : tr("Use the analyzer's check button.", "Нажмите проверку в анализаторе.")
          : steps[step].title}</p>
        {nextBlocked && <span id={`${id}-gate`} className={styles.screenReaderOnly}>{isLoading ? tr("Wait for the check to finish.", "Дождитесь завершения проверки.") : tr("A current report is required to continue.", "Для продолжения нужен актуальный отчёт.")}</span>}
        <button type="button" className={styles.expand} onClick={() => setCompactOverride({ step, value: false })} aria-label={tr("Expand walkthrough without changing the step", "Развернуть сценарий без смены шага")}>{tr("Expand", "Развернуть")}</button>
      </div> : <div className={styles.body} aria-live="polite" aria-atomic="true">
        <div className={styles.progress} aria-hidden="true">{steps.map((_, index) => <span key={index} className={index <= step ? styles.progressActive : undefined} />)}</div>
        <h3 className={styles.stepTitle}>{steps[step].title}</h3>
        <p id={`${id}-description`} className={styles.description}>{steps[step].description}</p>
        {nextBlocked && <p id={`${id}-gate`} className={styles.hint}><Info size={15} aria-hidden="true" /><span>{isLoading
          ? tr("Wait for the current check to finish before continuing.", "Дождитесь завершения текущей проверки, чтобы продолжить.")
          : tr("Run a check in the analyzer. Continue when a current report is ready.", "Запустите проверку в анализаторе. Продолжить можно, когда появится актуальный отчёт.")}</span></p>}
      </div>}

      <div className={styles.footer}>
        <button type="button" className={styles.previous} disabled={step === 0} onClick={() => setRequestedStep(Math.max(0, step - 1))} aria-label={tr("Previous walkthrough step", "Предыдущий шаг сценария")}><ArrowLeft size={15} aria-hidden="true" />{!isCompact && tr("Back", "Назад")}</button>
        <button type="button" className={styles.next} disabled={nextBlocked} aria-describedby={nextBlocked ? `${id}-gate` : undefined} onClick={() => {
          if (atLastStep) closeGuide();
          else if (!nextBlocked) setRequestedStep(step + 1);
        }} aria-label={atLastStep ? tr("Finish walkthrough", "Завершить сценарий") : tr("Next walkthrough step", "Следующий шаг сценария")}>{atLastStep ? <>{tr("Done", "Готово")}<Check size={16} aria-hidden="true" /></> : <>{tr("Next", "Далее")}<ArrowRight size={15} aria-hidden="true" /></>}</button>
      </div>
    </div>}
  </>;
}
