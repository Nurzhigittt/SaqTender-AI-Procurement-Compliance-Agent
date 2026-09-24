# SaqTender AI

**Procurement Compliance Agent — a demonstration MVP for the Astana IT University AI startup registry.**

SaqTender AI helps a tender specialist compare the requirements in a tender with a company document profile. It brings evidence, potential document gaps, deadlines and recommended next steps into one dashboard.

The initial audience is construction, design and engineering companies participating in procurement in Kazakhstan. This prototype demonstrates one complete review workflow using the fictional **OrdaBuild Demo LLP** and a fictional school-construction tender. It does not connect to procurement portals or determine official eligibility.

## What the demo does

1. Shows the company's document profile.
2. Accepts an editable tender text, with a sample available to load.
3. Extracts requirements and deadlines with direct text evidence.
4. Compares requirements with the supplied profile.
5. Displays a requirements matrix, risk assessment and recommended actions.
6. Creates **draft** reminders 7 days, 3 days and 24 hours before each extracted deadline.

The application does not send notifications or schedule background jobs. Draft alerts are part of the returned assessment.

## AI workflow and boundaries

Live mode uses the official OpenAI Agents SDK on the server. One specialist, **SaqTender Compliance Agent**, is instructed to analyze only the supplied company profile and tender, preserve direct evidence, use `unknown` when evidence is insufficient, and distinguish facts from recommendations.

Its tools are:

- `getCompanyProfile`: returns the structured fictional company profile.
- `createAlerts`: produces draft alert records from extracted deadlines.

Zod validates incoming requests and structured assessment output. Every assessment sets `officialEligibilityVerified` to `false` and includes a decision-support disclaimer. Error responses are safe user-facing messages rather than internal exception details. The API key is used only on the server.

**AI output requires human review.** A document marked active in the fictional profile has not been authenticated. A matched requirement is not proof of legal eligibility. Verify the original tender, document validity and applicable rules against official sources before acting.

## Local setup

Use Node.js 22 or newer and npm.

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
- `npm test`: 17 tests pass, including evidence/date validation and the real Agents SDK with an intercepted, offline provider transport.
- Browser checks cover sample analysis, all report tabs, expanded evidence, edited-text behavior, validation errors, mobile widths (320px and 390px), and 200% zoom.
- A real OpenAI API request is **not yet verified** because no API key was provided. Offline SDK tests do not replace that check.

The build uses Next.js with webpack for compatibility with restricted local environments.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side OpenAI API key. If empty, the application uses deterministic demo output. |
| `OPENAI_MODEL` | Optional model identifier supported by your OpenAI account. Defaults to `gpt-4.1-mini`. |
| `DEMO_MODE` | Set to `true` to force demo behavior, even when a key is available. Defaults to `false`. |

Keep credentials in `.env.local` locally and in deployment environment variables in production. Never use a `NEXT_PUBLIC_` prefix for the API key or commit credentials.

**Demo Mode** makes no OpenAI API calls. It is deterministic local analysis for demonstrating the workflow and is not evidence of a successful live AI request. The unchanged sample produces a predefined, evidence-checked assessment. Editing it switches to conservative requirement candidates marked `unknown`; only supported deadlines with an explicit full date, time and timezone are extracted. It never silently reuses the sample's conclusions for a different tender.

The sample tender is the recommended presentation path. Its fixed deadlines are in September 2026; they are fictional dates, not current opportunities. An expert opinion valid through the sample's submission date is marked met for that stated period; its approaching expiry is a separate renewal recommendation. Financial-document sufficiency remains unknown because the profile does not establish the buyer's full criteria.

For **Live AI** mode, set a valid `OPENAI_API_KEY`, select an available model if needed, leave `DEMO_MODE=false`, and restart the server or redeploy. Run the sample and confirm the live-mode label, evidence, structured result and draft alerts. A model or timeout failure returns a retryable error; it should never be represented as a successful live analysis.

The project was prepared without an API key. Live execution must be verified with a funded API account before describing it as tested in a submission or demonstration.

## Deploy to Vercel

1. Push the project directory to a Git repository. The repository root should contain `package.json`.
2. Import the repository into Vercel. Select the **Next.js** framework preset and a supported Node.js version, preferably Node.js 22.
3. For a public demo, set `DEMO_MODE=true`. For live mode, set `OPENAI_API_KEY`, optionally `OPENAI_MODEL`, and `DEMO_MODE=false` in Vercel environment settings.
4. Deploy with the default build command, `npm run build`.
5. Open the deployed URL, load the sample tender, run the assessment, inspect the results and confirm the mode badge. Also check the layout on a narrow screen.

Environment changes require a new deployment. Live requests are subject to model availability, API billing and the hosting plan's execution limits. This unauthenticated prototype is intended for a controlled demonstration; keep a public instance in Demo Mode unless appropriate access controls and usage limits are added.

## Data handling and limitations

- No database, user accounts, uploads, registry integration, background monitoring or document-authenticity checks.
- The application does not persist submitted text or assessments to application storage. Reloading starts a fresh workflow.
- In live mode, tender text and the demo company profile are sent to OpenAI to generate the assessment. Provider processing and retention policies still apply; the absence of an application database is not a promise that no external service processes the data.
- Document dates and statuses are fictional. Time-sensitive interface labels use the current date; the sample itself retains its fixed September 2026 deadlines. There is no verified company registration, license, tax status, supplier blacklist or manufacturer-registry lookup.
- No legal advice or official eligibility determination. Extraction and matching can be incomplete or incorrect.
- No email, Telegram or other notification delivery. Draft reminder times can already be in the past, particularly when using the fixed sample after its deadlines.
- The current profile is a single demo company. This is not a production multi-tenant procurement platform.

## Roadmap

1. Validate the workflow with tender specialists and construction companies.
2. Add authenticated company profiles, explicit retention controls and a reviewed document lifecycle.
3. Evaluate authorized procurement and registry integrations before claiming automated verification.
4. Add persistent reminders with consent, delivery status and timezone-aware scheduling.
5. Build extraction evaluations and human review of evidence before expanding AI capabilities.

Submission copy and a Russian demonstration script are in [docs/AITU-SUBMISSION.md](docs/AITU-SUBMISSION.md).
