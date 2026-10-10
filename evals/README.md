# SaqTender evaluation set

This is a **20-case synthetic development benchmark**, authored for this repository in Russian and English. It is not a collection of real procurement notices, expert-approved legal decisions, training data, or evidence of real-world accuracy.

The expectations are readable in [cases.ts](cases.ts). Each case specifies the tender text, company records, exact source clauses, acceptable document statuses, deadline instants and an acceptable risk range. Cases cover missing and supplied records, unknown license categories, expiry before/on/after submission, unknown accounting periods, unverified registry entries, negation, contradictions, conditional requirements, prompt injection in tender/profile data, incomplete/impossible dates, two deadlines, opening dates and an explicitly superseded closing date.

## Run

```bash
# Validate inputs, annotations and timestamps. No model call.
npm run eval:check

# Measure the deterministic demo as a separate baseline. No model call.
npm run eval:demo

# Paid live calls; loads a server-side key from .env.local if present.
# Start small. A provider/runtime failure stops the run without retries here.
npm run eval:live -- --limit 3
npm run eval:live -- --case expired-opinion-ru

# Test a deployment using its existing server key; no local API key needed.
# Explicit selection is required, maximum 3 synthetic cases per remote run.
npm run eval:remote -- https://saq-tender-ai-procurement-complianc.vercel.app --case missing-timezone-ru --case conflicting-clauses-ru --case profile-prompt-injection-en

# All 20 live cases, sequentially.
npm run eval:live
```

`OPENAI_API_KEY` must be set for live mode. `OPENAI_MODEL` chooses the same model as the application. The live runner calls the production agent directly; `DEMO_MODE=true` does not turn a requested live evaluation into a demo run. Never put credentials in CLI arguments or commit them. SDK transport can perform its own bounded retries.

Remote mode confirms `/api/config` is live before sending any analysis, then checks the mode on every response. Demo responses are never counted as live-model results. It sends only the selected built-in fictional texts and profiles, never a local API key or browser cookies. URLs must be HTTPS (HTTP is allowed only for localhost), without credentials, query strings or additional paths. Redirects are rejected. Requests are sequential with no client retries; any execution failure stops the run and leaves the remaining cases unrun. The deployed agent may perform bounded provider retries. The remote model identifier is `null` because the public endpoint does not disclose it.

Reports are written to ignored `evals/runs/` files, including mode, model, dataset version, selected/completed/unrun cases, timing and failures. A run with failed expectations returns exit code 1. The runner never saves raw provider exceptions or credentials. Remote reports additionally retain successful structured answers to these fictional cases for manual review; local/demo reports contain case IDs and grades, not model transcripts.

## What is measured

- **Requirement matching precision/recall:** one-to-one matches of source clauses *and* the corresponding company evidence. This combines extraction and profile mapping. A duplicate counts as an extra result.
- **Deadline precision/recall:** matching source clause and exact timestamp, independent of timezone representation.
- **Case pass:** all matches, accepted statuses/risk, grounded evidence, structured output, required manual-review action presence and deterministic draft reminders pass.
- A missing model response counts as an execution failure. Unrun cases remain explicitly unrun. Empty precision/recall denominators are `null`, not 100%.

The grader accepts exact source overlap of at least 12 characters. It cannot establish whether a quote preserves the full meaning, whether explanations are correct, whether a manual action is useful, or whether the tender is legally compliant. Precision for structurally valid returned items must be read alongside execution failures and coverage; failed structured responses have no countable returned items.

Review a sample of model answers manually before accepting improvements. Do not tune solely to these cases: add unseen, permissioned examples reviewed by tender specialists and retain a separate held-out set before reporting external accuracy.

## Initial baseline — 9 October 2026

The deterministic demo passed **5/20** full cases. Requirement matching: 0/13 annotated requirements; deadline matching: 7/7 expected timestamps, with 1 extra timestamp. This is an intentionally limited candidate extractor for new text; it does not understand arbitrary clauses or resolve amendments. These figures are **not model accuracy**.

The public sample completed a real Live AI analysis on 10 October 2026. This establishes that the sample workflow works; it is separate from the 20-case benchmark and is not an accuracy score.

`npm test` checks the calendar tool, validation boundaries, SDK orchestration with intercepted transport and the grader itself. Passing those tests demonstrates technical behavior, not the language model's extraction quality.
