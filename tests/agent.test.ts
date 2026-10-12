import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

// The production module is intentionally server-only. A separate process uses
// its documented react-server export condition while retaining the real SDK.
// All provider transport is intercepted; these tests never contact OpenAI.
const fixture = path.join(process.cwd(), "tests/fixtures/agent-transport.ts");

const scenarios = [
  ["happy", "live SDK resolves numbered source deadlines on the server and preserves the canonical timestamps through the final output"],
  ["russian", "live SDK returns Russian report text while preserving English original source quotations"],
  ["rephrased-deadline-titles", "live SDK accepts rephrased deadline titles while preserving exact dates and evidence across tools"],
  ["missing-profile", "live SDK output is rejected when the required company-profile tool was skipped"],
  ["missing-date-check", "live SDK rejects alerts when the calendar check was skipped"],
  ["wrong-date-input", "live SDK rejects calendars checked for a different deadline set"],
  ["wrong-evidence", "live SDK output is rejected when a requirement references an unknown source fragment"],
  ["wrong-alert-input", "live SDK output is rejected when the alert tool received different deadlines"],
  ["wrong-deadline-date", "live SDK rejects an alert timestamp that differs from its server-resolved deadline"],
  ["wrong-deadline-evidence", "live SDK rejects a tool deadline with an unknown source fragment"],
  ["ambiguous-date-quote", "live SDK rejects a deadline quote containing two different explicit timestamps"],
  ["missing-timezone-quote", "live SDK retains a timezone-less candidate but rejects a fabricated absolute date sent to alerts"],
  ["calendar-feedback-recovery", "live SDK permits one corrected calendar check and returns manual verification without invented dates"],
  ["calendar-feedback-repeated", "live SDK stops after a repeated ambiguous calendar input"],
  ["calendar-feedback-bypass", "live SDK rejects alerts after feedback when the corrected calendar check was skipped"],
  ["recheck-after-alert", "live SDK forces alert creation again after a later calendar recalculation"],
  ["normalize-final", "live SDK requests findings only, leaving summary, actions, reminder dates and disclaimer to the server"],
  ["conflicting-clauses", "live SDK normalizes conflicting clauses to unknown and preserves both quotes for manual review"],
  ["fabricated-conflicting-evidence", "live SDK rejects an unknown opposing-clause reference instead of treating it as a conflict"],
  ["reversed-source-reference", "live SDK rejects reversed source ranges instead of selecting unrelated text"],
  ["model-authored-quote", "live SDK rejects model-authored evidence even when a valid requirement reference is supplied"],
  ["model-authored-deadline-quote", "live SDK rejects model-authored final deadline evidence beside a valid reference"],
  ["model-authored-tool-quote", "live SDK rejects model-authored calendar evidence beside a valid reference"],
  ["unknown-unresolved-reference", "live SDK rejects an unresolved deadline with an unknown source reference"],
  ["linewrapped-source-references", "live SDK preserves PDF-wrapped negation and restores original relative duration clauses from references"],
  ["mixed-relative-absolute-references", "live SDK keeps a relative duration unresolved beside an independently checked absolute timestamp"],
  ["calendar-mixed-relative", "live SDK separates relative candidates from valid dates without shifting their source references"],
  ["calendar-retain-relative", "live SDK retains relative, month-only and guarantee passages when the final model output omits them"],
  ["calendar-deduplicate-unresolved", "live SDK emits one neutral clarification for matching tool and final unresolved passages"],
  ["calendar-empty-recheck-retains", "live SDK retains earlier clarification passages after an empty calendar recheck"],
  ["calendar-forged-relative-date", "live SDK rejects an invented absolute date for a retained relative passage"],
  ["calendar-unresolved-overflow", "live SDK rejects more than thirty combined unresolved passages without silent truncation"],
  ["calendar-failed-mixed-atomic", "live SDK commits no partial clarification state from a failed mixed calendar check"],
  ["calendar-missing-timezone-retained", "live SDK retains an incomplete timestamp as a clarification without guessing its timezone"],
  ["expired-present-document", "live SDK exposes an expiry risk for a present document and accepts at_risk without calling it missing"],
  ["expired-present-as-missing", "live SDK still rejects a missing claim for a present document despite its expired validity"],
  ["missing-validity-document", "live SDK preserves a genuine missing record when validity is required at submission"],
  ["same-day-validity", "live SDK treats expiry on the closing day as inclusive and does not infer compliance from calendar coverage"],
  ["renewed-validity", "live SDK removes the expiry risk for a renewed record while allowing unknown sufficiency"],
  ["abort", "live SDK transport aborts promptly when the run signal times out"],
  ["provider-error", "live SDK provider errors do not log a secret or tender text"],
  ["route-auth-error", "API route returns a localized key configuration error without leaking provider data"],
  ["route-quota-error", "API route distinguishes exhausted quota from a retryable request rate limit"],
  ["custom-profile", "API and real SDK use submitted profile data only through tool results"],
  ["custom-profile-old-evidence", "live SDK rejects old demo evidence for a changed company profile"],
] as const;

for (const [scenario, title] of scenarios) {
  test(title, { timeout: 30000 }, () => {
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", fixture, scenario], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 25000,
      env: { ...process.env, OPENAI_API_KEY: "test-key-never-sent", OPENAI_MODEL: "gpt-4.1-mini", DEMO_MODE: "false" },
    });
    assert.equal(result.status, 0, `Offline agent scenario failed (${scenario}): ${result.stderr || result.stdout || result.error?.message}`);
    assert.equal(result.stderr.includes("test-key-never-sent"), false, "No test credential may appear in logs");
  });
}
