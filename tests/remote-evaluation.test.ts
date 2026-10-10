import assert from "node:assert/strict";
import test from "node:test";
import { EVALUATION_CASES } from "../evals/cases";
import { createRemoteAnalyzer, normalizeEvaluationOrigin, RemoteEvaluationError } from "../evals/remote-client";
import type { Assessment } from "../lib/types";

const ORIGIN = "https://evaluation.example";
const item = EVALUATION_CASES[0];
// Transport fixture only; this is not an AI response or an evaluation result.
const assessment: Assessment = {
  summary: "Offline transport fixture.", overallRisk: "unknown", officialEligibilityVerified: false,
  requirements: [], deadlines: [], actions: [], alerts: [], disclaimer: "Synthetic test only.",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function code(expected: string) {
  return (error: unknown) => error instanceof RemoteEvaluationError && error.code === expected && error.message === expected;
}

test("remote origins permit HTTPS and loopback HTTP, rejecting credentials and extra URL data", () => {
  for (const origin of ["https://example.org", "https://example.org:8443", "http://localhost:3001", "http://127.0.0.1:3001", "http://[::1]:3001"]) {
    assert.equal(normalizeEvaluationOrigin(`${origin}/`), origin);
  }
  for (const origin of ["http://example.org", "ftp://example.org", "https://user:secret@example.org", "https://@example.org", "https://example.org/api", "https://example.org/a/..", "https://example.org\\", "https://example.org/?secret=123", "https://example.org/?", "https://example.org/#", "https://example.org\n.evil", "not a URL"]) {
    assert.throws(() => normalizeEvaluationOrigin(origin), code("remote_invalid_origin"));
  }
});

test("demo preflight and missing preflight cannot send a paid POST", async () => {
  const methods: (string | undefined)[] = [];
  const client = createRemoteAnalyzer(ORIGIN, async (_url, init) => {
    methods.push(init?.method);
    return json({ mode: "demo" });
  });
  await assert.rejects(client.analyze(item), code("remote_preflight_required"));
  assert.equal(methods.length, 0);
  await assert.rejects(client.preflight(), code("remote_not_live"));
  await assert.rejects(client.analyze(item), code("remote_preflight_required"));
  assert.deepEqual(methods, ["GET"]);
});

test("successful remote transport sends only case inputs, disables redirects and ambient credentials", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = createRemoteAnalyzer(ORIGIN, async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return init?.method === "GET" ? json({ mode: "live" }) : json({ mode: "live", assessment });
  });
  await client.preflight();
  assert.deepEqual(await client.analyze(item), assessment);
  assert.deepEqual(calls.map(call => call.url), [`${ORIGIN}/api/config`, `${ORIGIN}/api/analyze`]);
  for (const { init } of calls) {
    assert.equal(init.redirect, "error");
    assert.equal(init.credentials, "omit");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new Headers(init.headers).has("authorization"), false);
    assert.equal(new Headers(init.headers).has("cookie"), false);
  }
  assert.deepEqual(Object.fromEntries(new Headers(calls[1].init.headers)), { accept: "application/json", "content-type": "application/json" });
  assert.deepEqual(JSON.parse(calls[1].init.body as string), { tenderText: item.tenderText, locale: item.locale, companyProfile: item.companyProfile });
  assert.equal(calls[0].init.body, undefined);
});

test("remote analysis rejects a demo fallback and schema-invalid live output", async () => {
  for (const [body, expectedCode] of [
    [{ mode: "demo", assessment }, "remote_not_live"],
    [{ mode: "live", assessment: { ...assessment, officialEligibilityVerified: true } }, "remote_invalid_assessment"],
    [{ mode: "live", assessment: { summary: "Incomplete" } }, "remote_invalid_assessment"],
  ] as const) {
    const client = createRemoteAnalyzer(ORIGIN, async (_url, init) => init?.method === "GET" ? json({ mode: "live" }) : json(body));
    await client.preflight();
    await assert.rejects(client.analyze(item), code(expectedCode));
  }
});

test("HTTP failures retain only known server codes, never raw server secrets", async () => {
  for (const [serverCode, expectedCode] of [["ai_quota_exceeded", "ai_quota_exceeded"], ["sk-secret-from-server", "remote_http_failure"]]) {
    const client = createRemoteAnalyzer(ORIGIN, async (_url, init) => init?.method === "GET"
      ? json({ mode: "live" }) : json({ code: serverCode, error: "private tender and sk-secret-from-server", stack: "private stack" }, 503));
    await client.preflight();
    await assert.rejects(client.analyze(item), error => {
      assert.ok(code(expectedCode)(error));
      assert.equal(JSON.stringify(error).includes("secret"), false);
      assert.equal((error as Error).cause, undefined);
      return true;
    });
  }
});

test("invalid JSON, HTTP redirects and network failures yield safe errors without retry", async () => {
  for (const [reply, expectedCode] of [
    [() => new Response("private non-JSON response", { status: 200 }), "remote_invalid_json"],
    [() => new Response("private HTTP response", { status: 502 }), "remote_http_failure"],
    [() => new Response(null, { status: 307, headers: { Location: "https://secret.example" } }), "remote_http_failure"],
    [() => { throw new Error("sk-secret in network diagnostics"); }, "remote_network_failure"],
  ] as const) {
    let calls = 0;
    const client = createRemoteAnalyzer(ORIGIN, async () => { calls += 1; return reply(); });
    await assert.rejects(client.preflight(), code(expectedCode));
    assert.equal(calls, 1);
    await assert.rejects(client.analyze(item), code("remote_preflight_required"));
    assert.equal(calls, 1);
  }
});
