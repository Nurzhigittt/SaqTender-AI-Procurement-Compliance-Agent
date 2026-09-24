import assert from "node:assert/strict";
import { analyzeLiveTender } from "../../lib/agent";
import { getDisclaimer, SAMPLE_TENDER } from "../../lib/demo-data";
import { analyzeDemoTender } from "../../lib/mock-analysis";

async function main() {
  const scenario = process.argv[2];
  const locale = scenario === "russian" ? "ru" : "en";
  const canonical = analyzeDemoTender(SAMPLE_TENDER, locale);
  const finalOutput = structuredClone(canonical);
  const requests: Array<Record<string, unknown>> = [];
  const capturedLogs: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...items: unknown[]) => capturedLogs.push(items.map(String).join(" "));
  console.warn = (...items: unknown[]) => capturedLogs.push(items.map(String).join(" "));

  if (scenario === "wrong-evidence") finalOutput.requirements[0].tenderEvidence = "This evidence does not occur in the supplied tender.";
  if (scenario === "normalize-final") {
    finalOutput.alerts[0].scheduledAt = "2040-01-01T00:00:00.000Z";
    finalOutput.disclaimer = "A model-authored disclaimer must be replaced.";
  }

  const functionCall = (name: string, args: unknown, index: number) => ({
    type: "function_call", id: `fc_${index}`, call_id: `call_${index}`, name,
    arguments: JSON.stringify(args), status: "completed",
  });
  const finalMessage = () => ({
    id: "msg_final", type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(finalOutput), annotations: [] }],
  });

  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    // Any tracing endpoint or unexpected provider request fails locally.
    assert.equal(url, "https://api.openai.com/v1/responses");
    const requestBody = JSON.parse(String(init?.body));
    requests.push(requestBody);
    assert.equal(requestBody.store, false);
    if (requests.length === 1) {
      assert.deepEqual(requestBody.tool_choice, { type: "function", name: "getCompanyProfile" });
      if (scenario === "russian") assert.match(String(requestBody.instructions), /Return concise plain Russian/);
    }

    if (scenario === "abort") {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      assert.ok(signal, "The SDK must propagate the run AbortSignal to the provider");
      return await new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted by test deadline", "AbortError"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    }
    if (scenario === "provider-error") {
      return new Response(JSON.stringify({ error: {
        message: `test-key-never-sent ${SAMPLE_TENDER}`,
        type: "invalid_request_error", code: "invalid_api_key",
      } }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const output = scenario === "missing-profile" ? finalMessage()
      : requests.length === 1 ? functionCall("getCompanyProfile", {}, 1)
        : requests.length === 2 ? functionCall("createAlerts", {
          deadlines: scenario === "wrong-alert-input" ? [] : canonical.deadlines,
        }, 2)
          : finalMessage();

    return new Response(JSON.stringify({
      id: `resp_${requests.length}`, object: "response", status: "completed",
      created_at: 1780000000, model: "gpt-4.1-mini", output: [output],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const controller = new AbortController();
  let abortTimer: ReturnType<typeof setTimeout> | undefined;
  if (scenario === "abort") abortTimer = setTimeout(() => controller.abort(), 100);
  try {
    if (["missing-profile", "wrong-evidence", "wrong-alert-input", "abort", "provider-error"].includes(scenario)) {
      await assert.rejects(analyzeLiveTender(SAMPLE_TENDER, controller.signal, locale));
      if (scenario === "abort") assert.equal(controller.signal.aborted, true);
    } else {
      const assessment = await analyzeLiveTender(SAMPLE_TENDER, controller.signal, locale);
      assert.equal(requests.length, 3, "Expected profile tool, alert tool, and final structured response");
      assert.deepEqual(assessment.alerts, canonical.alerts);
      assert.equal(assessment.disclaimer, getDisclaimer(locale));
      assert.equal(assessment.officialEligibilityVerified, false);
      if (scenario === "russian") {
        assert.match(assessment.summary, /[А-Яа-яЁё]/u);
        assert.match(assessment.disclaimer, /[А-Яа-яЁё]/u);
        assert.ok(assessment.requirements.every((item) => SAMPLE_TENDER.includes(item.tenderEvidence)));
        assert.ok(assessment.alerts.every((item) => /[А-Яа-яЁё]/u.test(item.title)));
      }

      // The later model requests must actually contain the local tool results.
      const allInputs = JSON.stringify(requests.map((request) => request.input));
      assert.ok(allInputs.includes("OrdaBuild Demo LLP"));
      assert.ok(allInputs.includes("evidenceByDocumentId"));
      assert.ok(allInputs.includes("2026-09-22T05:00:00.000Z"));
      assert.ok(allInputs.includes("function_call_output"));
    }
    assert.ok(requests.length > 0, "Test must exercise the actual SDK provider transport");
    const logText = capturedLogs.join("\n");
    assert.equal(logText.includes("test-key-never-sent"), false);
    assert.equal(logText.includes("FICTIONAL DEMO TENDER"), false);
  } finally {
    clearTimeout(abortTimer);
    console.error = originalError;
    console.warn = originalWarn;
  }
}

main().catch((error: unknown) => {
  // A failing assertion is useful for development; never print a provider error
  // object, which may include test credentials or submitted tender content.
  console.error(error instanceof assert.AssertionError ? error.message : "Offline agent transport scenario failed.");
  process.exitCode = 1;
});
