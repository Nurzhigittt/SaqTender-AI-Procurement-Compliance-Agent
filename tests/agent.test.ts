import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

// The production module is intentionally server-only. A separate process uses
// its documented react-server export condition while retaining the real SDK.
// All provider transport is intercepted; these tests never contact OpenAI.
const fixture = path.join(process.cwd(), "tests/fixtures/agent-transport.ts");

const scenarios = [
  ["happy", "live SDK forces the profile tool, runs alert creation, and returns grounded structured output"],
  ["missing-profile", "live SDK output is rejected when the required company-profile tool was skipped"],
  ["wrong-evidence", "live SDK output is rejected when a requirement cites fabricated evidence"],
  ["wrong-alert-input", "live SDK output is rejected when the alert tool received different deadlines"],
  ["normalize-final", "live SDK output cannot override server-generated reminder dates or disclaimer"],
  ["abort", "live SDK transport aborts promptly when the run signal times out"],
  ["provider-error", "live SDK provider errors do not log a secret or tender text"],
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
