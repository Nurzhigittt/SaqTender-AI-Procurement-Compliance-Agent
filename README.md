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

## Team manual review

After a completed analysis, open **Ручная проверка / Manual review**. Compare each requirement and deadline with its source quote, then mark it correct, incorrect or uncertain. An incorrect finding requires an explanation before export. Record omitted requirements or deadlines and other concerns in the separate notes fields. The counter tracks reviewed items, not model accuracy.

Start with the fictional sample while the team prepares its own checking process. These notes are not specialist certification, official eligibility verification or an expert-approved training dataset. They do not modify the original model answer or train the model automatically.

**Скачать проверку · HTML / Download review · HTML** produces a readable, printable file; **Сохранить для продолжения · JSON / Save to continue · JSON** preserves structured data with schema version `saqtender-review-v1`. Both contain the company snapshot, original assessment, source quotes, review notes and timestamps. They are not anonymized. The full tender text is not included; retain the original source separately for later comparison.

Notes remain in the current browser tab and are never sent to the server. They survive switching report tabs, but are reset for a new successful analysis or regenerated demo-language report and are lost on page reload. Download before those actions. Editing the tender or company profile makes the report stale and disables review edits and downloads until the inputs are restored or a new analysis completes. A failed analysis keeps the previous notes.

To resume later, choose **Открыть проверку / Open saved review** at the top of the page, select the saved JSON, inspect its company/date preview and open it. The saved review opens in a separate window without changing the current tender, company profile or analysis. Continue editing and save a new JSON or HTML. Closing the window retains these edits only in this tab; reload requires opening the downloaded JSON again. Selecting another file does not replace the open review until explicitly confirmed, so existing edits can still be downloaded.

Import accepts UTF-8 JSON (with an optional BOM), up to 8 MiB, with the `saqtender-review-v1` schema. Malformed, oversized, unsupported and inconsistent files are rejected without clearing the open review. Parsing runs entirely in the browser: no file contents or notes go to the server or the AI. Metadata such as mode, dates and language are preserved as claims from the file; format validation does not authenticate the report or establish that it is current. HTML files cannot restore editable reviews. Keep the full source tender separately.

To compare team notes, share a saved JSON of one original report, let each participant save their own review, then open one review and expand **Сравнить две проверки / Compare two reviews**. Choose the second JSON. Both files must have exactly the same original assessment, company snapshot, analysis date, language and mode; a fresh analysis is a different report even if its findings look similar.

The comparison uses current edits in the open review as A and the selected saved file as B. It separates matching marks, differing marks and incomplete rows; unreviewed rows never count as agreement. The discussion filter includes differing marks, incorrect/uncertain marks and different row comments. Possible omissions and general notes appear separately. Editing A updates the comparison immediately; an incomplete error explanation blocks comparison and export until corrected. **Скачать сравнение · HTML / Download comparison · HTML** preserves the original report and both sets of notes in the report's language. The comparison is local to the tab, adds no AI request, does not merge notes and does not establish reviewer identity, independence or model accuracy. Identical feedback is labelled as possibly copied. Save each review as JSON to resume later; the comparison HTML is for reading and discussion.


For a first walkthrough without preparing files, open **Открыть проверку / Open saved review → Попробовать на учебном примере / Try a practice example** and confirm the preview. The built-in exercise contains the full fictional tender and two prefilled reviews A/B of a fixed demo snapshot dated **24 September 2026**. They are fictional opinions for discussion, not actual team responses, expert labels or an answer key. It starts with two matching marks, one differing mark and three incomplete items. Source text is readable in the window; the original A/B JSON and source TXT are downloadable separately. Editing A changes the comparison, but original practice downloads remain unchanged. Use **Save to continue · JSON** below to save edits. Opening a practice preview does not replace existing saved notes until confirmed; the current tender, profile and AI mode remain unchanged. The exercise makes no AI request and works in both RU and EN.

## Interface languages

The interface opens in Russian and includes an **RU / EN** language switch. The sample tender, demo assessment, labels and recommendations are available in both languages. Live analysis uses the selected output language while preserving tender evidence as exact excerpts in the original language. Selecting Russian for an English tender does not translate or replace the source quotes.

The API accepts an optional `locale` of `ru` or `en`. Omitting it retains English API behavior for existing integrations. Document identifiers, structured status values and date formats stay stable across languages.

## AI workflow and boundaries

Live mode uses the official OpenAI Agents SDK on the server. One specialist, **SaqTender Compliance Agent**, is instructed to analyze only the supplied company profile and tender, preserve direct evidence, use `unknown` when evidence is insufficient, and distinguish facts from recommendations.

Its tools are:

- `getCompanyProfile`: returns the submitted company profile and canonical evidence strings (or the fictional sample when no profile is supplied).
- `checkDocumentDates`: takes numbered source ranges, restores their exact original text, and separates exact timestamps from passages needing clarification. A range with exactly one supported explicit instant becomes a canonical deadline, with document expiry comparisons using Asia/Almaty calendar days. A range without a supported complete instant is retained for clarification, including relative periods and dates missing a timezone. Multiple distinct instants require correction. The model copies only the returned exact deadlines and references into reminders; it never calculates timezone offsets or missing anchor dates. This deterministic tool cannot verify document contents or legal sufficiency.
- `createAlerts`: produces draft alert records from extracted deadlines.

Live findings also require a `kind`: mandatory bid requirement, contract-performance obligation, evaluation/price criterion, explicit exemption, or unclear applicability. Nonqualification kinds require a separate numbered context reference (which can point to a distant section heading); the server restores that quote too. Exemptions never create missing-document actions, and scoring/performance conditions are excluded from qualification-risk counts and get separate review actions. Conflicts, conditional exemptions and selected clauses containing obvious waiver/post-award cues stay unclear rather than creating a missing-document claim. These cues are conservative review triggers, not a legal parser. The model still chooses clauses, context and classification; misclassification or omitted context remains possible.

The present profile stores document presence and dates, without category, licensed activities, contents or authenticity. Consequently, every ordinary live `met` claim backed only by an active record becomes `unknown` with a server explanation. Unsupported `met` against a missing/unverified record is still rejected before conversion. Existing missing-document and expiry checks remain. The UI, exact source view, manual review and all HTML exports retain classification and complete context, and label classification as an AI interpretation. Public fields are optional without defaults so historical review-v1 packets preserve their original contents and comparison identity.

The server requires profile reading, calendar comparison and reminder creation for the final deadline set, in that order. Each successful tool sets the next required tool choice; calendar correction keeps the calendar tool required. Automatic tool choice is enabled only after draft reminders have been created. Final validation still rejects skipped tools or changed dates without the corresponding dependent checks. Company fields and tender text are untrusted data, never developer instructions.

Calendar results separate record presence from date validity and supply conservative status guidance for explicit validity-at-deadline conditions. A present record expiring before the relevant deadline yields `at_risk`; a record explicitly marked missing yields `missing`; unverified, undated or date-covering records yield `unknown` because calendar coverage alone does not establish compliance. Expiry on the deadline day is inclusive. The model must still identify whether the condition applies and select the correct document and deadline; conflicting or unresolved conditional clauses remain unknown. This is tool guidance, not a new final-output guarantee: a model that still labels a present record missing is rejected by the unchanged validator rather than silently corrected.

If a restored calendar passage contains multiple distinct explicit instants, the tool can return one bounded correction message to the agent. The agent must separate ranges when their meaning is clear, or preserve the ambiguous passage for manual review and submit a corrected list. The failed call never counts as a completed calendar check. Invalid references, changed timestamps and repeated multiple-instant input still reject the run.

Zero-instant passages do not fail the calendar call. Their exact text is retained on the server after the entire call validates; a later empty tool call or omitted final model item cannot erase them. The server merges these clarifications into final findings, deduplicating only identical source text with a maximum of 30 unique passages. Overlaps are kept, and overflow rejects instead of truncating. No exact date or reminder is invented for an incomplete passage. The neutral wording applies to that selected passage alone, because a wider part of the document may establish the date. Selecting relevant timing obligations still depends on the model; this is not automatic understanding of every relative period or official deadline verification.

The model returns an internal findings object: qualification requirements, checked deadlines and unresolved calendar information, each bound to source references. It cannot supply a free-form summary, overall risk, action plan or disclaimer. The server derives those report fields from the validated findings, without scanning unrelated profile documents for additional recommendations. Every recommended action identifies a requirement row or quotes an unresolved deadline. Existing assessment fields are retained; an optional `conflictingEvidence` field preserves the complete opposing quote in a requirement, the interface and HTML export. Strict API consumers should update their schema for this additive field. Up to 90 actions cover the bounded 60 requirements and 30 unresolved calendar items without silently dropping findings.

An unresolved deadline's reason controls only the wording of its clarification action. If the model's specific reason is unsupported by the quote's syntax (for example, `missing_timezone` for 120 days from contract signing), the server uses the neutral **Clarify the deadline / Уточните срок** wording. It does not guess another specific reason, create a timestamp or reminder, discard the item, or repeat the model request. Exact source validation and rejection of a unique complete timestamp misclassified as unresolved remain strict. Long action quotes are excerpted to 400 characters; always retain the original tender for review.

For each live request the server numbers source fragments and retains their original character offsets. The model receives a JSON catalog of `{id, text}` and returns inclusive `{startFragment, endFragment}` ranges for requirements, opposing clauses and deadlines. It cannot return tender quote strings. The server restores each range with an original-text slice, including internal PDF line breaks and whitespace; unknown, reversed, non-integer and over-2,000-character ranges are rejected. Catalog IDs are created by the server for that request; numbers written inside document text cannot redefine them. Explicit timestamps remain independently addressable, including when a relative duration shares the same sentence. The public report and export still contain exact quotations, without changing their schema.

Company evidence remains a canonical string from the profile tool. Selection of a passage, its full context and its interpretation still require model judgment and human review: exact provenance is not semantic accuracy. The earlier whitespace-only quote-restoration helper remains in the internal report builder for existing fixtures, but live tender quotes now come directly from source ranges, not model-generated strings.

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
- `npm test`: 288 tests pass, covering PDF/TXT extraction and import limits, profile input and evidence, calendar comparisons, localization, error handling, HTML export, the benchmark grader and the real Agents SDK with intercepted offline provider transport. Checks also cover server-generated summaries/actions, exact opposing clauses including long quotes, incomplete-calendar findings, and separate presence/validity guidance for expired, missing, renewed and same-day records. The 42 relative-deadline regressions verify neutral clarification without invented dates, retained findings and unchanged evidence safeguards. A present-but-expired record incorrectly classified as missing still rejects. Provider requests enforce the required next tool, including correction and recalculation. Deadline display titles may change between tools and final output, while server-resolved timestamps and exact source quotes must match. These are technical regression checks, not a measured accuracy score on real tenders.
- Numbered-source verification includes 11 fragment/resolver/report tests and 51 intercepted SDK scenarios: invalid IDs/ranges, forbidden model-authored quotations, exact PDF whitespace and negation, conflicting clauses, mixed relative/absolute deadlines, long input and unchanged calendar/profile guards. The 10,913-character archival input produces 348 exact source fragments with all non-whitespace content retained. These offline checks do not establish extraction quality.
- Calendar retention adds 13 focused helper/report tests plus eight SDK scenarios within the count above. They verify mixed exact/incomplete candidate ordering, omitted final items, later empty checks, exact-text deduplication, atomic failures, combined limits and rejection of guessed dates. Calendar ambiguity-retry checks still use two distinct complete timestamps; missing timezones are retained for clarification and never guessed.
- Classification regression coverage adds 17 contract/unit tests and six SDK transport scenarios within the count above: exemptions, price criteria, distant post-award context, uncertain scope, category-insufficient licenses, invalid/omitted context, forged profile data, unchanged mandatory risks, legacy review compatibility, comparison identity and all HTML exports. The existing synthetic-v1 grader is unchanged and counts all returned rows; it is not classification-aware (retained exemptions can be reported as extra rows). No new benchmark accuracy claim is made. [Classification scope and verification](evals/README.md#requirement-applicability-and-context--12-october-2026).
- On **12 October 2026 at 10:20 Asia/Almaty**, deployed `09db336` completed one 10,913-character archival request: ten exact source quotes, zero exact dates/reminders and one retained relative-period clarification. A preceding accidental sample request is recorded separately. Source comparison found semantic failures: an experience exemption became a missing requirement, generic license records incorrectly established compliance, post-award conditions lost their context, and some relative periods were omitted. This is execution success, not validated tender accuracy. [Complete findings and request accounting](evals/README.md#incomplete-calendar-candidate-retention--12-october-2026).
- On **12 October 2026 at 10:02 Asia/Almaty**, one archival-document production check on numbered-reference code `0324d53` failed during calendar validation (`profile_read` / `deadline_source_ambiguous`), before final findings. No report was returned and no client retry was made. The exact-range implementation was tested, but this run returned no report. [Execution result and limitations](evals/README.md#numbered-source-references--12-october-2026).
- Team review regression tests cover validation, detached snapshots, note requirements, escaping and original-report preservation. Saved-review import tests also cover version and schema rejection, byte limits, BOM, large valid exports and complete round trips. Local browser checks verified both downloads, required-note focus, tab persistence, stale-report locking and reset on a new analysis.
- On **11 October 2026 at 14:09 Asia/Almaty**, published code `e3f0594` completed one fictional Live AI expiry example. The new review tab accepted a clearly labelled practice note and downloaded HTML containing the original report and that note. This verifies the feedback workflow, not an expert assessment or real-tender accuracy.
- Saved-review browser checks on **11 October 2026** verified opening an older exported JSON, editing and downloading it, restoring that new file after reload, and preserving original report/profile/analysis date. Close/reopen retained notes; invalid JSON did not clear them; file replacement required a separate click while downloading existing edits remained available. A simultaneous current report kept its own notes, with distinct field IDs and correct error focus inside the saved-review window. These checks used fictional demo data without a new paid AI request.
- Comparison tests cover exact original-report matching, incomplete rows, identical feedback, discussion rules, detached results, HTML escaping and original-report preservation in both languages. Local browser checks verified differing team marks, filtering, immediate updates after edits, invalid-note recovery, rejection of a different report without losing the previous comparison, close/reopen persistence and an HTML download containing both sets of notes. Fixtures are fictional and do not represent independent expert reviews.
- Practice-exercise browser checks verified the RU and EN walkthrough, seeded comparison counts, immediate comparison updates after edits, cancelling replacement without losing notes, ordinary JSON replacement clearing the practice context, and the unchanged current tender. Original A/B JSON downloads retained their prefilled marks after edits; the downloaded TXT contained every source quote. The full source region is keyboard-focusable and scrollable. Eight data tests cover repeatability, shared originals, source evidence, import round trips, language separation and detached immutable snapshots.
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
