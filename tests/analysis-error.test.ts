import assert from "node:assert/strict";
import test from "node:test";
import { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";
import { getAnalysisFailure } from "../lib/analysis-error";

const SECRET = "sk-secret-never-show-this";
const TENDER = "PRIVATE_TENDER_PAYLOAD_849302";

function providerError(status: number, code: string, type = "invalid_request_error"): APIError {
  return APIError.generate(status, {
    error: { code, type, message: `${SECRET} ${TENDER}`, param: TENDER },
  }, SECRET, new Headers({ "x-request-id": SECRET, authorization: `Bearer ${SECRET}` }));
}

test("actual SDK quota errors are distinct from transient rate limits and localized safely", () => {
  const quota = getAnalysisFailure(providerError(429, "insufficient_quota", "insufficient_quota"), "ru");
  const rate = getAnalysisFailure(providerError(429, "rate_limit_exceeded"), "ru");
  assert.equal(quota.code, "ai_quota_exceeded");
  assert.equal(rate.code, "ai_rate_limited");
  assert.equal(quota.status, 503);
  assert.match(quota.message, /кредитам|баланс/u);
  assert.match(rate.message, /частоту/u);
  assert.notEqual(quota.message, rate.message);
  const english = getAnalysisFailure(providerError(429, "insufficient_quota"), "en");
  assert.match(english.message, /credit or usage limit/);
  assert.equal(/[А-Яа-яЁё]/u.test(english.message), false);
});

test("known API credit and spending limit codes do not all prescribe adding money", () => {
  const credit = getAnalysisFailure(providerError(429, "credit_balance_exhausted"), "en");
  assert.equal(credit.code, "ai_credit_balance_exhausted");
  assert.match(credit.message, /credit balance is exhausted/);
  for (const code of ["organization_spend_limit_exceeded", "project_spend_limit_exceeded", "organization_usage_limit_exceeded"]) {
    const limit = getAnalysisFailure(providerError(429, code), "en");
    assert.equal(limit.code, "ai_quota_exceeded");
    assert.match(limit.message, /spending and usage limits/);
    assert.equal(/top.up|add.*money|buy|purchase/i.test(limit.message), false);
  }
  assert.equal(getAnalysisFailure(providerError(429, "slow_down"), "en").code, "ai_rate_limited");
});

test("actual SDK credentials, model, access and rejected requests become safe server failures", () => {
  const cases = [
    [401, "invalid_api_key", "ai_authentication_failed"],
    [404, "model_not_found", "ai_model_unavailable"],
    [403, "permission_denied", "ai_access_denied"],
    [400, "arbitrary_secret_code", "ai_request_rejected"],
    [404, "unknown_route", "ai_request_rejected"],
  ] as const;
  for (const [status, providerCode, expected] of cases) {
    const result = getAnalysisFailure(providerError(status, providerCode), "ru");
    assert.equal(result.code, expected);
    assert.equal(result.status, 502, "A provider credential failure must not become a browser login response");
    assert.match(result.message, /[А-Яа-яЁё]/u);
  }
});

test("SDK server and connection failures are retryable service failures", () => {
  for (const error of [
    providerError(503, "server_error"),
    new APIConnectionError({ message: SECRET }),
    new APIConnectionTimeoutError({ message: TENDER }),
    new Error(SECRET, { cause: { code: "ECONNRESET" } }),
  ]) {
    const result = getAnalysisFailure(error, "en");
    assert.equal(result.code, "ai_provider_unavailable");
    assert.equal(result.status, 503);
  }
});

test("nested SDK wrappers and cycles preserve useful classification with bounded traversal", () => {
  const cyclic: { cause?: unknown; originalError?: unknown; error?: unknown } = {};
  cyclic.cause = cyclic;
  cyclic.originalError = { error: providerError(429, "insufficient_quota") };
  assert.equal(getAnalysisFailure(cyclic, "en").code, "ai_quota_exceeded");
  const beyondDepth = { cause: { cause: { cause: { cause: { cause: providerError(401, "invalid_api_key") } } } } };
  assert.equal(getAnalysisFailure(beyondDepth, "en").code, "analysis_unverified");
  const irrelevantPayload = { state: { error: providerError(401, "invalid_api_key") }, response: providerError(403, "permission_denied") };
  assert.equal(getAnalysisFailure(irrelevantPayload, "en").code, "analysis_unverified");
});

test("unknown failures expose no raw strings, provider metadata, tender data, or arbitrary codes", () => {
  const cases: unknown[] = [
    SECRET, null, undefined, new Error(`Ungrounded requirement evidence ${TENDER}`),
    { message: SECRET, code: TENDER, stack: SECRET, headers: { authorization: SECRET }, payload: TENDER },
    providerError(429, TENDER), providerError(401, SECRET), providerError(500, TENDER),
  ];
  for (const cause of cases) {
    for (const locale of ["ru", "en"] as const) {
      const result = getAnalysisFailure(cause, locale);
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes(SECRET), false);
      assert.equal(serialized.includes(TENDER), false);
      assert.deepEqual(Object.keys(result).sort(), ["code", "message", "status"]);
      assert.ok(result.status === 502 || result.status === 503);
    }
  }
  assert.equal(getAnalysisFailure(new Error("Ungrounded company evidence"), "ru").code, "analysis_unverified");
});

test("error inspection does not invoke getters or throw on inaccessible metadata", () => {
  let calls = 0;
  const hostile = Object.defineProperties({}, Object.fromEntries(["status", "code", "type", "cause", "originalError", "error", "message"].map((key) => [key, {
    get() { calls += 1; throw new Error(SECRET); },
  }])));
  assert.equal(getAnalysisFailure(hostile, "en").code, "analysis_unverified");
  assert.equal(calls, 0);
  const inaccessible = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error(SECRET); }, getPrototypeOf() { throw new Error(SECRET); } });
  assert.equal(getAnalysisFailure(inaccessible, "ru").code, "analysis_unverified");
});
