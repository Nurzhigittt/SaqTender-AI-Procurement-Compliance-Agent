import { AssessmentSchema, type Assessment } from "../lib/types";
import type { AnalysisFailure } from "../lib/analysis-error";
import type { EvaluationCase } from "./cases";

const SERVER_CODES = [
  "ai_credit_balance_exhausted", "ai_quota_exceeded", "ai_rate_limited",
  "ai_authentication_failed", "ai_model_unavailable", "ai_access_denied",
  "ai_request_rejected", "ai_provider_unavailable", "analysis_unverified",
] as const satisfies readonly AnalysisFailure["code"][];

export type RemoteEvaluationCode = typeof SERVER_CODES[number]
  | "remote_invalid_origin" | "remote_preflight_required" | "remote_not_live"
  | "remote_http_failure" | "remote_network_failure" | "remote_invalid_json"
  | "remote_invalid_assessment";

/** Never retain untrusted response text, transport errors or credentials. */
export class RemoteEvaluationError extends Error {
  constructor(public readonly code: RemoteEvaluationCode) {
    super(code);
    this.name = "RemoteEvaluationError";
  }
}

export function normalizeEvaluationOrigin(input: string): string {
  const candidate = input.trim();
  // Check the original path too: URL parsing would normalize /a/.. into /.
  if (!/^https?:\/\/[^\s\\/?#@]+\/?$/i.test(candidate)) throw new RemoteEvaluationError("remote_invalid_origin");
  let url: URL;
  try { url = new URL(candidate); }
  catch { throw new RemoteEvaluationError("remote_invalid_origin"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (url.protocol !== "https:" && !(url.protocol === "http:" && local))) {
    throw new RemoteEvaluationError("remote_invalid_origin");
  }
  return url.origin;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function createRemoteAnalyzer(origin: string, transport: typeof fetch = fetch): {
  preflight(): Promise<void>;
  analyze(item: EvaluationCase): Promise<Assessment>;
} {
  const target = normalizeEvaluationOrigin(origin);
  let liveConfirmed = false;

  async function request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await transport(`${target}${path}`, {
        ...init, redirect: "error", credentials: "omit", cache: "no-store",
      });
    } catch { throw new RemoteEvaluationError("remote_network_failure"); }

    let body: unknown;
    try { body = await response.json(); }
    catch {
      throw new RemoteEvaluationError(response.ok ? "remote_invalid_json" : "remote_http_failure");
    }
    if (!response.ok) {
      const code = record(body)?.code;
      throw new RemoteEvaluationError(SERVER_CODES.includes(code as typeof SERVER_CODES[number])
        ? code as typeof SERVER_CODES[number] : "remote_http_failure");
    }
    return body;
  }

  return {
    async preflight() {
      liveConfirmed = false;
      const body = await request("/api/config", {
        method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000),
      });
      if (record(body)?.mode !== "live") throw new RemoteEvaluationError("remote_not_live");
      liveConfirmed = true;
    },
    async analyze(item) {
      if (!liveConfirmed) throw new RemoteEvaluationError("remote_preflight_required");
      const body = record(await request("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tenderText: item.tenderText, locale: item.locale, companyProfile: item.companyProfile }),
        signal: AbortSignal.timeout(60000),
      }));
      if (body?.mode !== "live") throw new RemoteEvaluationError("remote_not_live");
      const parsed = AssessmentSchema.safeParse(body.assessment);
      if (!parsed.success) throw new RemoteEvaluationError("remote_invalid_assessment");
      return parsed.data;
    },
  };
}
