"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, BookOpen, Building2, CalendarClock, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileCheck2, FileClock, FileSearch, FileText, FolderOpen, Info, LayoutDashboard, LoaderCircle, LockKeyhole, Plus, RotateCcw, ScanLine, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import type { Assessment } from "@/lib/types";
import { DEMO_COMPANY, SAMPLE_TENDER } from "@/lib/demo-data";
import { Badge, StatusBadge, formatDate } from "./ui";
import { AssessmentResults } from "./results";

type Mode = "demo" | "live";
type ResponseData = { assessment: Assessment; mode: Mode; analyzedAt: string };
class AnalysisError extends Error {}

export function Dashboard({ initialMode, initialNow }: { initialMode: Mode; initialNow: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [tenderText, setTenderText] = useState(SAMPLE_TENDER);
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
  const maxLength = 20000;
  const activeDocuments = DEMO_COMPANY.documents.filter(d => d.status === "active" && (!d.expiresAt || new Date(`${d.expiresAt}T23:59:59+05:00`) >= now));
  const riskyDocuments = DEMO_COMPANY.documents.filter(d => d.status === "not_verified" || (d.expiresAt && new Date(`${d.expiresAt}T23:59:59+05:00`).getTime() - now.getTime() < 30 * 86400000));
  const missingDocuments = DEMO_COMPANY.documents.filter(d => d.status === "missing");

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  function jump(id: string) {
    setActiveNav(id);
    if (id === "alerts") { setTab("alerts"); id = "assessment"; }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function analyze() {
    if (isLoading) return;
    if (!tenderText.trim()) { setError("Add some tender text before running a compliance check."); textRef.current?.focus(); return; }
    if (tenderText.length > maxLength) { setError("Please shorten the tender to 20,000 characters."); return; }
    const submittedText = tenderText.trim();
    const abortController = new AbortController();
    controller.current = abortController;
    setIsLoading(true); setError(null); setElapsed(0);
    const timeout = setTimeout(() => abortController.abort(), 65000);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenderText: submittedText }), signal: abortController.signal });
      const data = await response.json().catch(() => { throw new AnalysisError("The server response could not be read. Please try again."); });
      if (!response.ok) throw new AnalysisError(typeof data?.error === "string" ? data.error : "The check could not be completed. Please try again.");
      if (!data?.assessment || !["demo", "live"].includes(data.mode)) throw new AnalysisError("The report could not be read. Please try again.");
      setResult(data); setAnalyzedText(submittedText); setMode(data.mode); setTab("requirements");
      setActiveNav("assessment");
      requestAnimationFrame(() => { resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); resultsRef.current?.focus({ preventScroll: true }); });
    } catch (err) {
      setError(err instanceof Error && err.name === "AbortError" ? "The check took too long. Please try again." : err instanceof AnalysisError ? err.message : "We couldn’t connect. Check your connection and retry.");
    } finally { clearTimeout(timeout); setIsLoading(false); controller.current = null; }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#tender-analyzer">Skip to tender analyzer</a>
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="SaqTender AI overview"><span className="brand-icon"><ShieldCheck size={23} /></span><span>SaqTender<span className="brand-ai">AI</span></span></a>
      <div className="workspace-label">PROCUREMENT WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {[
          { id: "overview", label: "Overview", Icon: LayoutDashboard },
          { id: "company-profile", label: "Company profile", Icon: Building2 },
          { id: "tender-analyzer", label: "Tender analyzer", Icon: FileSearch },
          { id: "alerts", label: "Draft alerts", Icon: Bell },
        ].map(({ id, label, Icon }) => <button key={id} className={`nav-item ${activeNav === id ? "is-active" : ""}`} title={label} aria-label={label} aria-current={activeNav === id ? "location" : undefined} onClick={() => jump(id)}><Icon size={18} /><span>{label}</span>{id === "alerts" && result && !stale && <span className="nav-count">{assessment?.alerts.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="sidebar-note-icon"><ShieldCheck size={18} /></span><strong>A second pair of eyes.</strong><p>Evidence-led checks for your next tender.</p><button onClick={() => helpDialog.current?.showModal()}>How it works <ArrowUpRight size={14} /></button></div>
        <button className="help-link" onClick={() => helpDialog.current?.showModal()}><CircleHelp size={18} /> Demo guide</button>
        <div className="workspace-profile"><span className="avatar">OB</span><span><strong>OrdaBuild Demo</strong><small>Fictional workspace</small></span><Badge tone="nav">DEMO</Badge></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span className="mobile-brand"><ShieldCheck size={21} /> SaqTender AI</span><span className="desktop-crumb">Workspace <ChevronRight size={14} /> <strong>Compliance overview</strong></span></div><div className="header-right"><Badge tone={mode === "demo" ? "amber" : "green"} dot>{mode === "demo" ? "Demo Mode" : "Live AI"}</Badge><span className="topbar-divider" /><span className="header-avatar">OB</span></div></header>
      <main id="overview" className="workspace-main">
        <div className="page-heading"><div><div className="eyebrow">PROCUREMENT COMPLIANCE AGENT</div><h1>Clarity before you submit<span>.</span></h1><p>Your documents, tender requirements, and next steps. In one place.</p></div><div className="today-label"><CalendarClock size={16} /><span>{formatDate(initialNow)}<small>Asia/Almaty · UTC+5</small></span></div></div>
        <div className="demo-notice"><span className="notice-symbol"><Info size={17} /></span><p><strong>This is a demo workspace.</strong> Company and sample tender data are fictional. {mode === "demo" ? "Checks use a deterministic demo, with no live AI call." : "Checks use live AI. Submitted text is sent to OpenAI."}</p><button onClick={() => helpDialog.current?.showModal()} aria-label="Read demo guide"><ArrowUpRight size={16} /></button></div>

        <section className="stats-grid" aria-label="Compliance overview">
          <StatCard title="Documents active" value={activeDocuments.length} description="On the company profile" Icon={FileCheck2} tone="green" />
          <StatCard title="Documents at risk" value={riskyDocuments.length} description="Expiring or unverified" Icon={FileClock} tone="amber" />
          <StatCard title="Missing documents" value={missingDocuments.length} description="Need your attention" Icon={FolderOpen} tone="red" />
          <StatCard title="Critical deadlines" value={assessment && !stale ? assessment.deadlines.length : "—"} description={assessment && !stale ? "Extracted from tender text" : "Run a check to identify"} Icon={CalendarClock} tone="blue" />
        </section>

        <div className="input-grid">
          <section id="company-profile" className="panel company-panel">
            <div className="panel-heading"><div><span className="section-kicker">01 / YOUR COMPANY</span><h2>Compliance profile</h2></div><Building2 className="muted-icon" size={20} /></div>
            <div className="company-summary"><span className="company-mark"><Building2 size={25} /></span><div><h3>{DEMO_COMPANY.name}</h3><p>{DEMO_COMPANY.industry}</p><span className="fictional-label">Fictional company · Demo data</span></div></div>
            <div className="document-list-heading"><span>COMPANY DOCUMENTS</span><span>{DEMO_COMPANY.documents.length} records</span></div>
            <div className="document-list">
              {DEMO_COMPANY.documents.map((document, index) => {
                const expiryTime = document.expiresAt ? new Date(`${document.expiresAt}T23:59:59+05:00`).getTime() : null;
                const expired = expiryTime !== null && expiryTime < now.getTime();
                const remaining = expiryTime !== null ? Math.ceil((expiryTime - now.getTime()) / 86400000) : null;
                const expirySoon = !expired && remaining !== null && remaining <= 30;
                return <div className={`document-item ${document.status === "missing" ? "document-missing" : ""}`} key={document.id}>
                  <span className={`document-icon doc-${document.status}`}><FileText size={17} /></span><div className="document-detail"><strong>{document.title}</strong><small>{document.expiresAt ? `Expires ${formatDate(document.expiresAt)}` : document.updatedAt ? `Updated ${formatDate(document.updatedAt)}` : document.status === "missing" ? "No supporting document" : "Verification is pending"}{expirySoon && <span className="expiry-soon"> · {remaining}d left</span>}</small></div><StatusBadge status={expired ? "expired" : document.status} />
                </div>;
              })}
            </div>
            <div className="profile-footer"><LockKeyhole size={14} /><span>Demo profile loaded · No official registry connection</span></div>
          </section>

          <section id="tender-analyzer" className="panel analyzer-panel" tabIndex={-1}>
            <div className="panel-heading"><div><span className="section-kicker">02 / YOUR TENDER</span><h2>Tender analyzer</h2></div><span className="ai-icon"><Sparkles size={19} /></span></div>
            <div className="analyzer-intro"><p>Turn tender text into a clear compliance checklist.</p><button className="text-button" disabled={isLoading} onClick={() => { setTenderText(SAMPLE_TENDER); setError(null); textRef.current?.focus(); }}><RotateCcw size={13} /> Load sample tender</button></div>
            <label className="editor-label" htmlFor="tender-text">Tender requirements <span>Editable text</span></label>
            <div className={`tender-editor ${error ? "has-error" : ""}`}><div className="editor-toolbar"><span><FileText size={14} /> {tenderText === SAMPLE_TENDER ? "School construction · Fictional sample" : "Your tender text"}</span><Badge tone="neutral">TEXT</Badge></div><textarea ref={textRef} id="tender-text" value={tenderText} onChange={e => { setTenderText(e.target.value); setError(null); }} disabled={isLoading} spellCheck={false} aria-describedby="tender-hint" aria-invalid={!!error} maxLength={maxLength + 1} placeholder="Paste the tender requirements and deadlines here…" /><div className="editor-footer"><span><LockKeyhole size={12} /> Not saved by this app</span><span className={tenderText.length > maxLength ? "text-danger" : ""}>{tenderText.length.toLocaleString("en-US")} / 20,000</span></div></div>
            <p id="tender-hint" className="input-hint">Include document requirements, dates, and the original wording.</p>
            {error && <div className="error-message" role="alert"><TriangleAlert size={17} /><p>{error}</p><button onClick={analyze} disabled={isLoading}>Retry <RotateCcw size={13} /></button></div>}
            <button className="run-button" onClick={analyze} disabled={isLoading || !tenderText.trim() || tenderText.length > maxLength}>{isLoading ? <><LoaderCircle className="spin" size={19} /> Checking tender… <span>{elapsed}s</span></> : <><Sparkles size={18} /> Run AI Compliance Check <ArrowRight size={18} /></>}</button>
            <p className="run-caption" aria-live="polite">{isLoading ? "Reviewing the provided text and company profile. This may take a moment." : mode === "demo" ? "Demo analysis · Evidence included · No data saved" : "Live AI analysis · Text sent to OpenAI · Verify every finding"}</p>
          </section>
        </div>

        <section id="assessment" className="results-section" ref={resultsRef} tabIndex={-1} aria-label="Compliance assessment">
          {assessment ? <AssessmentResults assessment={assessment} mode={result!.mode} analyzedAt={result!.analyzedAt} stale={stale} tab={tab} setTab={setTab} now={initialNow} onRerun={analyze} isLoading={isLoading} /> : <div className="empty-results"><div className="empty-result-icon"><ScanLine size={27} /><span><Sparkles size={12} /></span></div><div><h2>A clearer picture starts with one check.</h2><p>Run the analyzer to see requirements, risks, and what to do next.</p></div><div className="empty-steps"><span><Check size={14} /> Match documents</span><span><Clock3 size={14} /> Extract deadlines</span><span><Bell size={14} /> Draft reminders</span></div></div>}
        </section>

        <footer className="page-footer"><span><ShieldCheck size={15} /> SaqTender AI <span className="footer-dot">·</span> Built for better-informed bids.</span><button onClick={() => helpDialog.current?.showModal()}><BookOpen size={14} /> Responsible AI & demo guide</button></footer>
      </main>
    </div>

    <dialog ref={helpDialog} className="help-dialog" aria-labelledby="demo-guide-title" onClick={e => { if (e.target === e.currentTarget) helpDialog.current?.close(); }}><div className="dialog-header"><span className="brand-icon"><ShieldCheck size={22} /></span><button className="icon-button" onClick={() => helpDialog.current?.close()} aria-label="Close demo guide"><X size={20} /></button></div><span className="section-kicker">THE DEMO GUIDE</span><h2 id="demo-guide-title">A second pair of eyes for your bid.</h2><p>SaqTender AI compares the text you provide with a fictional company profile and builds a review checklist.</p><ol className="guide-steps"><li><span>1</span><div><strong>Review the company profile</strong><p>Five fictional document records are loaded for OrdaBuild Demo LLP.</p></div></li><li><span>2</span><div><strong>Load or edit the tender</strong><p>The sample covers school construction. Keep exact requirements and dates in the text.</p></div></li><li><span>3</span><div><strong>Run a compliance check</strong><p>Review every finding alongside its source evidence. Alerts are drafts only and are never sent.</p></div></li></ol><div className="guide-disclaimer"><Info size={18} /><p><strong>Decision support, with human review.</strong> Official eligibility is never verified. There is no procurement portal or registry connection. Demo Mode makes no live AI call. Live AI sends your text to OpenAI; avoid personal or confidential information in this demo. Nothing is saved by the application.</p></div><button className="run-button" onClick={() => { helpDialog.current?.close(); jump("tender-analyzer"); }}>Try the analyzer <ArrowRight size={17} /></button></dialog>
  </div>;
}

function StatCard({ title, value, description, Icon, tone }: { title: string; value: number | string; description: string; Icon: typeof FileCheck2; tone: string }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-top"><span>{title}</span><span className="stat-icon"><Icon size={18} /></span></div><strong className="stat-value">{value.toString().padStart(typeof value === "number" ? 2 : 1, "0")}</strong><span className="stat-description">{description}</span><div className="stat-accent" /></div>;
}
