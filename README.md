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

The application does not send notifications or schedule background jobs. Draft alerts are part of the returned assessment.

The walkthrough only helps navigate the interface. It does not replace tender text or start an analysis. Its report steps require a current completed assessment. Downloading is also disabled while the report needs a new check.

## Import a tender document

Select **Загрузить PDF / TXT / Import PDF / TXT**, choose a file, review and edit the extracted text, then select **Использовать текст / Use this text**. Applying replaces the editor contents and marks any previous assessment stale. Cancel leaves the existing tender and report unchanged. Run a new analysis separately.

- Supports text-layer PDFs and UTF-8 TXT, including Cyrillic and UTF-8 BOM. Limits: 5 MiB, 30 PDF pages, 20,000 characters, 30 seconds. Oversized text is rejected, never silently truncated.
- PDF extraction uses [Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/) in a dedicated browser worker, loaded from the same application. Original file bytes are not uploaded, persisted or sent to OpenAI. The reviewed text is sent to `/api/analyze` only when the user starts a check; in Live AI mode it is then sent to OpenAI.
- There is no OCR. PDFs without extractable text are rejected; partially empty PDFs identify pages requiring review and block application until the user confirms they checked those pages. Image-only sections within a page that also has text cannot be detected reliably.
- Password-protected or unreadable PDFs return an actionable error. Text order, table structure, glyphs and invisible text layers may be inaccurate: users must compare requirements, amounts and dates with the original. Source quotes in an assessment refer to the reviewed text, not a verified PDF page coordinate.
- Imports do not improve the deterministic demo's understanding of arbitrary tenders. Demo findings remain conservative; live-model accuracy across real tenders has not been measured.

## Interface languages

The interface opens in Russian and includes an **RU / EN** language switch. The sample tender, demo assessment, labels and recommendations are available in both languages. Live analysis uses the selected output language while preserving tender evidence as exact excerpts in the original language. Selecting Russian for an English tender does not translate or replace the source quotes.

The API accepts an optional `locale` of `ru` or `en`. Omitting it retains English API behavior for existing integrations. Document identifiers, structured status values and date formats stay stable across languages.

## AI workflow and boundaries

Live mode uses the official OpenAI Agents SDK on the server. One specialist, **SaqTender Compliance Agent**, is instructed to analyze only the supplied company profile and tender, preserve direct evidence, use `unknown` when evidence is insufficient, and distinguish facts from recommendations.

Its tools are:

- `getCompanyProfile`: returns the submitted company profile and canonical evidence strings (or the fictional sample when no profile is supplied).
- `checkDocumentDates`: takes exact deadline quotes, resolves their timestamps on the server, and compares recorded expiry dates using Asia/Almaty calendar days. A quote must contain exactly one explicit instant; missing timezones or conflicting times are rejected. The model copies the returned timestamps rather than calculating timezone offsets. This deterministic tool cannot verify document contents or legal sufficiency.
- `createAlerts`: produces draft alert records from extracted deadlines.

The server requires profile reading, calendar comparison and reminder creation for the final deadline set, in that order. Each successful tool sets the next required tool choice; calendar correction keeps the calendar tool required. Automatic tool choice is enabled only after draft reminders have been created. Final validation still rejects skipped tools or changed dates without the corresponding dependent checks. Company fields and tender text are untrusted data, never developer instructions.

Calendar results separate record presence from date validity and supply conservative status guidance for explicit validity-at-deadline conditions. A present record expiring before the relevant deadline yields `at_risk`; a record explicitly marked missing yields `missing`; unverified, undated or date-covering records yield `unknown` because calendar coverage alone does not establish compliance. Expiry on the deadline day is inclusive. The model must still identify whether the condition applies and select the correct document and deadline; conflicting or unresolved conditional clauses remain unknown. This is tool guidance, not a new final-output guarantee: a model that still labels a present record missing is rejected by the unchanged validator rather than silently corrected.

If a calendar quote lacks one unambiguous explicit timestamp, the tool can return one bounded correction message to the agent. The agent must submit a corrected list, keep unresolved dates out of reminders, and request manual clarification. The failed call never counts as a completed calendar check. Invented quotes, changed timestamps and repeated invalid calendar input still reject the run.

The model returns an internal findings object: qualification requirements, checked deadlines and quoted unresolved calendar information. It cannot supply a free-form summary, overall risk, action plan or disclaimer. The server derives those report fields from the validated findings, without scanning unrelated profile documents for additional recommendations. Every recommended action identifies a requirement row or quotes an unresolved deadline. Existing assessment fields are retained; an optional `conflictingEvidence` field preserves the complete opposing quote in a requirement, the interface and HTML export. Strict API consumers should update their schema for this additive field. Up to 90 actions cover the bounded 60 requirements and 30 unresolved calendar items without silently dropping findings.

Requirements identified by the model as contradictory must include two distinct exact source quotes. The server marks that branch `unknown` and generates a clarification action; a missing or available company document does not resolve contradictory tender wording. Ordinary unsupported `met` claims still fail validation. Conditional requirements with unknown applicability also remain `unknown`. Recognizing which clauses conflict or apply is still a model judgment: source validation establishes that the quotes occur, not that their interpretation is correct. Titles and ordinary requirement explanations still require human review.

The profile editor marks user records as unverified. Changing the profile makes the previous report stale and disables export until another check succeeds. The report retains the company snapshot used for that check. An available document does not automatically mean a requirement is met.

Zod validates incoming requests and structured assessment output. Every assessment sets `officialEligibilityVerified` to `false` and includes a decision-support disclaimer. Error responses are safe user-facing messages rather than internal exception details. The API key is used only on the server.

**AI output requires human review.** A document marked active in the fictional profile has not been authenticated. A matched requirement is not proof of legal eligibility. Verify the original tender, document validity and applicable rules against official sources before acting.

## Local setup

Use Node.js 22.13 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). The application runs without an API key and visibly labels the result as **Demo Mode**.

Production build:

```bash
npm run build
npm start
```

Run the focused regression checks:

```bash
npm test
```

## Verification

- `npm install` and the optimized production build complete successfully.
- `npm test`: 110 tests pass, covering PDF/TXT extraction and import limits, profile input and evidence, calendar comparisons, localization, error handling, HTML export, the benchmark grader and the real Agents SDK with intercepted offline provider transport. Checks also cover server-generated summaries/actions, exact opposing clauses including long quotes, incomplete-calendar findings, and separate presence/validity guidance for expired, missing, renewed and same-day records. A present-but-expired record incorrectly classified as missing still rejects. Provider requests enforce the required next tool, including correction and recalculation. Deadline display titles may change between tools and final output, while server-resolved timestamps and exact source quotes must match. These are technical regression checks, not a measured accuracy score on real tenders.
- Browser checks cover sample analysis, all report tabs, expanded evidence, edited-text behavior, validation errors, mobile widths (320px and 390px), and 200% zoom.
- The public deployment was rechecked on 25 September 2026 in Demo Mode: the sample API request returned HTTP 200 with four requirements, two deadlines and six draft reminders. Earlier production browser checks covered public access, report tabs, source evidence and a 390px mobile viewport.
- **One real Live AI analysis was verified on 10 October 2026 at 17:38 Asia/Almaty**, on deployed code `773595c`. The public site's Russian sample produced four grounded requirements, the missing experience-document finding, two correct deadlines (26 September at 18:00 and 29 September at 10:00, Asia/Almaty), and six deterministic draft reminders. Browser checks confirmed the AI-result label, exact source quotes and a downloaded HTML report. This validates the end-to-end sample workflow, not general accuracy, repeatability or official eligibility.
- At **18:08 on 10 October 2026**, deployed code `663a13a` was tested on three synthetic edge cases in two bounded remote runs. Profile instruction injection passed; a missing-timezone answer avoided invented dates but included unsupported profile-based advice; conflicting clauses produced a rejected unsupported `met` claim. Two assessments were returned, one full automatic case passed, and one run failed execution. Returned answers were manually reviewed. [Detailed results and remaining limitations](evals/README.md#remote-development-checks--10-october-2026) are recorded without changing the grader. The full live benchmark and real-world accuracy remain unmeasured.
- At **20:41 on 10 October 2026**, deployed code `bad17df` passed the missing-timezone and contradictory-clause development cases; manual review confirmed that unrelated advice was absent and both opposing clauses were retained with unknown status. A third case involving a present but expired document failed safely with `unsupported_missing_claim` and remains unresolved. A separate browser analysis verified the contradictory-clause display and downloaded HTML report. These four live requests used fictional data, with no client retries; two passes out of three selected benchmark cases do not establish general accuracy. [Latest findings and limitations](evals/README.md#published-code-bad17df-2041-asiaalmaty).
- At **21:31 on 10 October 2026**, deployed code `95628eb` passed all three selected live development cases: expired, renewed and same-day expiry. Manual review confirmed that the expired record remained present with `at_risk` status, while renewed and same-day records remained in the checklist with `unknown` status and no early-expiry risk. A separate public browser check and HTML download confirmed the expiry finding. The preceding version passed two cases but omitted the same-day requirement; [both runs and limitations](evals/README.md#published-code-31f4b35-2128-asiaalmaty) are preserved. This targeted result does not establish general accuracy or repeatability.

The [20-case synthetic benchmark](evals/README.md) has separate dataset-validation, demo-baseline and paid live-model commands. The demo passed 5/20 cases. Run `npm run eval:check` without credentials, `npm run eval:live -- --limit 3` using a local server key, or `npm run eval:remote -- https://your-deployment.example --limit 3` to use the deployment's existing key. Remote runs require explicit selection of at most three fictional cases, reject demo output, stop on execution failure, and retain structured results for manual review. The benchmark is not expert-approved and does not establish real-world accuracy.

The build uses Next.js with webpack for compatibility with restricted local environments.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side OpenAI API key. If empty, the application uses deterministic demo output. |
| `OPENAI_MODEL` | Optional model identifier supported by your OpenAI account. Defaults to `gpt-4.1-mini`. |
| `DEMO_MODE` | Set to `true` to force demo behavior, even when a key is available. Defaults to `false`. |

Keep credentials in `.env.local` locally and in deployment environment variables in production. Never use a `NEXT_PUBLIC_` prefix for the API key or commit credentials.

**Demo Mode** makes no OpenAI API calls. It is deterministic local analysis for demonstrating the workflow and is not evidence of a successful live AI request. The unchanged sample produces a predefined, evidence-checked assessment. Editing it switches to conservative requirement candidates marked `unknown`; only supported deadlines with an explicit full date, time and timezone are extracted. It never silently reuses the sample's conclusions for a different tender.

The sample tender is the recommended presentation path. Its fixed deadlines are in September 2026; they are fictional dates, not current opportunities. For the original fictional profile, an expert opinion valid through the sample's submission date is marked met for that stated period; its expiry is a separate renewal recommendation. With a user-edited profile, the unchanged sample uses its recorded availability and dates, while document sufficiency remains unknown until originals are reviewed. Editing the tender switches back to conservative candidates.

For **Live AI** mode, set a valid `OPENAI_API_KEY`, select an available model if needed, leave `DEMO_MODE=false`, and restart the server or redeploy. Run the sample and confirm the live-mode label, evidence, structured result and draft alerts. A model or timeout failure returns a retryable error; it should never be represented as a successful live analysis.

Live execution must be verified with an available API account before describing it as tested in a submission or demonstration. Provider failures return localized messages for unavailable credits or quota, temporary rate limits, credentials, and model access. Raw provider errors, keys, and submitted tender text are not exposed in these messages.

Failed live runs log only allowlisted error, stage and reason labels on the server. These diagnostics identify failed checks without logging tender text, company records, credentials, model output or raw exceptions.

## Deploy to Vercel

1. Push the project directory to a Git repository. The repository root should contain `package.json`.
2. Import the repository into Vercel. Select the **Next.js** framework preset and a supported Node.js version, preferably Node.js 22.
3. For a public demo, set `DEMO_MODE=true`. For live mode, set `OPENAI_API_KEY`, optionally `OPENAI_MODEL`, and `DEMO_MODE=false` in Vercel environment settings.
4. Deploy with the default build command, `npm run build`.
5. Open the deployed URL, load the sample tender, run the assessment, inspect the results and confirm the mode badge. Also check the layout on a narrow screen.

Environment changes require a new deployment. Live requests are subject to model availability, API billing and the hosting plan's execution limits. This unauthenticated prototype is intended for a controlled demonstration; keep a public instance in Demo Mode unless appropriate access controls and usage limits are added.

## Data handling and limitations

- No database, user accounts, server-side file uploads, OCR, registry integration, background monitoring or document-authenticity checks.
- Tender text and assessments are not persisted to application storage. The profile stays in the current tab unless the user selects **Remember this profile in this browser**; this saves only the profile in localStorage, accessible to other users of that browser. Unchecking and applying removes that saved copy. Language is remembered in a cookie. Downloaded reports are saved on the user's device.
- In live mode, tender text and the supplied company profile are sent to OpenAI to generate the assessment. Provider processing and retention policies still apply; the absence of an application database is not a promise that no external service processes the data.
- Default document dates/statuses are fictional; edited records are user statements and remain unverified. Time-sensitive interface labels use the current date; the sample retains fixed September 2026 deadlines. There is no verified company registration, license, tax status, supplier blacklist or manufacturer-registry lookup.
- No legal advice or official eligibility determination. Extraction and matching can be incomplete or incorrect.
- No email, Telegram or other notification delivery. Draft reminder times can already be in the past, particularly when using the fixed sample after its deadlines.
- There is one editable profile per tab/browser, not an authenticated multi-tenant company workspace. No original document contents are uploaded or checked.

## Roadmap

1. Validate the workflow with tender specialists and construction companies.
2. Add authenticated company profiles, explicit retention controls and a reviewed document lifecycle.
3. Evaluate authorized procurement and registry integrations before claiming automated verification.
4. Add persistent reminders with consent, delivery status and timezone-aware scheduling.
5. Expand the synthetic evaluation set with held-out, permissioned tenders and specialist annotations; verify live quality before expanding AI capabilities.

Submission copy and a Russian demonstration script are in [docs/AITU-SUBMISSION.md](docs/AITU-SUBMISSION.md).
