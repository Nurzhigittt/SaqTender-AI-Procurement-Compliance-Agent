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

# All 20 live cases, sequentially.
npm run eval:live
```

`OPENAI_API_KEY` must be set for live mode. `OPENAI_MODEL` chooses the same model as the application. The live runner calls the production agent directly; `DEMO_MODE=true` does not turn a requested live evaluation into a demo run. Never put credentials in CLI arguments or commit them. SDK transport can perform its own bounded retries.

Reports are written to ignored `evals/runs/` files, including mode, model, dataset version, selected/completed/unrun cases, timing and failures. A run with failed expectations returns exit code 1. The runner never saves raw provider exceptions or credentials. Report files contain case IDs and grades, not submitted model transcripts.

## What is measured

- **Requirement matching precision/recall:** one-to-one matches of source clauses *and* the corresponding company evidence. This combines extraction and profile mapping. A duplicate counts as an extra result.
- **Deadline precision/recall:** matching source clause and exact timestamp, independent of timezone representation.
- **Case pass:** all matches, accepted statuses/risk, grounded evidence, structured output, required manual-review action presence and deterministic draft reminders pass.
- A missing model response counts as an execution failure. Unrun cases remain explicitly unrun. Empty precision/recall denominators are `null`, not 100%.

The grader accepts exact source overlap of at least 12 characters. It cannot establish whether a quote preserves the full meaning, whether explanations are correct, whether a manual action is useful, or whether the tender is legally compliant. Precision for structurally valid returned items must be read alongside execution failures and coverage; failed structured responses have no countable returned items.

Review a sample of model answers manually before accepting improvements. Do not tune solely to these cases: add unseen, permissioned examples reviewed by tender specialists and retain a separate held-out set before reporting external accuracy.

## Initial baseline — 9 October 2026

The deterministic demo passed **5/20** full cases. Requirement matching: 0/13 annotated requirements; deadline matching: 7/7 expected timestamps, with 1 extra timestamp. This is an intentionally limited candidate extractor for new text; it does not understand arbitrary clauses or resolve amendments. These figures are **not model accuracy**.

**Live model benchmark: not run.** The production live check on 9 October returned `ai_authentication_failed`. A valid server key and a successful live run are needed before recording a model score.

`npm test` checks the calendar tool, validation boundaries, SDK orchestration with intercepted transport and the grader itself. Passing those tests demonstrates technical behavior, not the language model's extraction quality.
