# SaqTender AI

**Procurement Compliance Agent — a demonstration MVP for the Astana IT University AI startup registry.**

SaqTender AI helps a tender specialist compare the requirements in a tender with a company document profile. It brings evidence, potential document gaps, deadlines and recommended next steps into one dashboard.

The initial audience is construction, design and engineering companies participating in procurement in Kazakhstan. This prototype demonstrates one complete review workflow using the fictional **OrdaBuild Demo LLP** and a fictional school-construction tender. It does not connect to procurement portals or determine official eligibility.

**[Open the public MVP](https://saq-tender-ai-procurement-complianc.vercel.app/)** — available in Russian and English, without a Vercel account. The interface identifies the configured analysis mode. Demo Mode uses deterministic results; Live AI calls the server-side model. See Verification below for the latest confirmed result.

## What the demo does

1. Shows the company's document profile and lets the user edit its name, industry, document availability and dates. Saving to this browser is optional.
2. Accepts editable tender text, a sample, or a PDF/TXT file. File imports have a review step before replacing the editor text.
3. Extracts requirements and deadlines with direct text evidence.
4. Compares requirements with the supplied profile.
5. Displays a requirements matrix, risk assessment and recommended actions.
6. Creates **draft** reminders 7 days, 3 days and 24 hours before each extracted deadline.
7. Highlights three review priorities: a document finding, a deadline and the next recommended action, with links to the report details.
8. Downloads the full assessment as a standalone HTML report, including source quotes, mode, draft alerts and limitations. Open the downloaded file to print it or save a PDF through the browser's print dialog.
9. Provides a five-step **Demo walkthrough / Сценарий показа** in Russian and English: company profile → tender and check → evidence → deadlines and drafts → actions and export.
10. Collects **team manual review** notes separately from the original assessment and exports both together as HTML or structured JSON.

The application does not send notifications or schedule background jobs. Draft alerts are part of the returned assessment.

The walkthrough only helps navigate the interface. It does not replace tender text or start an analysis. Its report steps require a current completed assessment. Downloading is also disabled while the report needs a new check.

## Import a tender document

Select **Загрузить PDF / TXT / Import PDF / TXT**, choose a file, review and edit the extracted text, then select **Использовать текст / Use this text**. Applying replaces the editor contents and marks any previous assessment stale. Cancel leaves the existing tender and report unchanged. Run a new analysis separately.

- Supports text-layer PDFs and UTF-8 TXT, including Cyrillic and UTF-8 BOM. Limits: 5 MiB, 30 PDF pages, 20,000 characters, 30 seconds. Oversized text is rejected, never silently truncated.
- PDF extraction uses [Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/) in a dedicated browser worker, loaded from the same application. Original file bytes are not uploaded, persisted or sent to OpenAI. The reviewed text is sent to `/api/analyze` only when the user starts a check; in Live AI mode it is then sent to OpenAI.
- There is no OCR. PDFs without extractable text are rejected; partially empty PDFs identify pages requiring review and block application until the user confirms they checked those pages. Image-only sections within a page that also has text cannot be detected reliably.
- Password-protected or unreadable PDFs return an actionable error. Text order, table structure, glyphs and invisible text layers may be inaccurate: users must compare requirements, amounts and dates with the original. Source quotes in an assessment refer to the reviewed text, not a verified PDF page coordinate.
- Imports do not improve the deterministic demo's understanding of arbitrary tenders. Demo findings remain conservative; live-model accuracy across real tenders has not been measured.


## Data handling and limitations

- No database, user accounts, server-side file uploads, OCR, registry integration, background monitoring or document-authenticity checks.
- Tender text and assessments are not persisted to application storage. The profile stays in the current tab unless the user selects **Remember this profile in this browser**; this saves only the profile in localStorage, accessible to other users of that browser. Unchecking and applying removes that saved copy. Language is remembered in a cookie. Downloaded reports are saved on the user's device.
- In live mode, tender text and the supplied company profile are sent to OpenAI to generate the assessment. Provider processing and retention policies still apply; the absence of an application database is not a promise that no external service processes the data.
- Default document dates/statuses are fictional; edited records are user statements and remain unverified. Time-sensitive interface labels use the current date; the sample retains fixed September 2026 deadlines. There is no verified company registration, license, tax status, supplier blacklist or manufacturer-registry lookup.
- No legal advice or official eligibility determination. Extraction and matching can be incomplete or incorrect.
- No email, Telegram or other notification delivery. Draft reminder times can already be in the past, particularly when using the fixed sample after its deadlines.
- There is one editable profile per tab/browser, not an authenticated multi-tenant company workspace. No original document contents are uploaded or checked.

