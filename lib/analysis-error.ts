import type { Locale } from "./i18n";
import type { AnalysisStage } from "./analysis-diagnostics";

const FAILURES = {
  ai_credit_balance_exhausted: {
    status: 503,
    en: "AI analysis is unavailable: OpenAI API reports that the available API credit balance is exhausted. The project owner should check the OpenAI API balance and billing settings.",
    ru: "ИИ-анализ недоступен: OpenAI API сообщает об исчерпании доступного баланса API. Владельцу проекта нужно проверить баланс и настройки оплаты OpenAI API.",
  },
  ai_quota_exceeded: {
    status: 503,
    en: "AI analysis is unavailable: OpenAI API reports an API credit or usage limit. The project owner should check the API balance, billing, and project or organization spending and usage limits.",
    ru: "ИИ-анализ недоступен: OpenAI API сообщает об ограничении по кредитам или использованию API. Владельцу проекта нужно проверить баланс API, оплату и лимиты расходов и использования проекта или организации.",
  },
  ai_rate_limited: {
    status: 503,
    en: "AI analysis is temporarily rate limited by OpenAI API. Wait a little and try again.",
    ru: "OpenAI API временно ограничил частоту запросов ИИ-анализа. Немного подождите и повторите попытку.",
  },
  ai_authentication_failed: {
    status: 502,
    en: "AI analysis is unavailable because OpenAI API did not accept the server's API credentials. The project owner should check the configured API key.",
    ru: "ИИ-анализ недоступен: OpenAI API не принял учётные данные сервера. Владельцу проекта нужно проверить настроенный ключ API.",
  },
  ai_model_unavailable: {
    status: 502,
    en: "The configured AI model was not found or is not available to this API project. The project owner should check the model setting and access.",
    ru: "Настроенная модель ИИ не найдена или недоступна этому API-проекту. Владельцу проекта нужно проверить название модели и доступ к ней.",
  },
  ai_access_denied: {
    status: 502,
    en: "OpenAI API denied access for this request. The project owner should check the API project's permissions and access settings.",
    ru: "OpenAI API отказал в доступе для этого запроса. Владельцу проекта нужно проверить разрешения и настройки доступа API-проекта.",
  },
  ai_request_rejected: {
    status: 502,
    en: "OpenAI API did not accept the analysis request. The project owner should check the server's model and request configuration.",
    ru: "OpenAI API не принял запрос анализа. Владельцу проекта нужно проверить настройки модели и запроса на сервере.",
  },
  ai_provider_unavailable: {
    status: 503,
    en: "The AI service is temporarily unavailable or could not be reached. Please try again shortly.",
    ru: "Сервис ИИ временно недоступен или соединение с ним не установлено. Повторите попытку немного позже.",
  },
  analysis_unverified: {
    status: 502,
    en: "The analysis could not be completed or its evidence could not be verified. Please retry. If this continues, the project owner should check the server's AI configuration.",
    ru: "Не удалось завершить анализ или проверить его подтверждения. Повторите попытку. Если ошибка сохраняется, владельцу проекта нужно проверить настройки ИИ на сервере.",
  },
} as const;

type FailureCode = keyof typeof FAILURES;
export interface AnalysisFailure {
  message: string;
  code: FailureCode;
  status: number;
}

const QUOTA_CODES = new Set([
  "insufficient_quota",
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
]);
const CONNECTION_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);
const CONNECTION_CLASSES = new Set(["APIConnectionError", "APIConnectionTimeoutError", "ModelTimeoutError"]);

/** Read data properties only: do not evaluate error getters or serialize errors. */
function dataProperty(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function className(value: object): unknown {
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!prototype || typeof prototype !== "object") return undefined;
    const constructor = dataProperty(prototype, "constructor");
    return typeof constructor === "function" ? dataProperty(constructor, "name") : undefined;
  } catch {
    return undefined;
  }
}

/** SDK errors wrap causes in cause, originalError, or error. Never visit payload/state. */
function errorChain(cause: unknown): object[] {
  const found: object[] = [];
  const queue: { value: unknown; depth: number }[] = [{ value: cause, depth: 0 }];
  const seen = new WeakSet<object>();
  for (let index = 0; index < queue.length && found.length < 12; index += 1) {
    const { value, depth } = queue[index];
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    found.push(value);
    if (depth < 4) {
      for (const key of ["cause", "originalError", "error"]) {
        queue.push({ value: dataProperty(value, key), depth: depth + 1 });
      }
    }
  }
  return found;
}

const ANALYSIS_STAGES = new Set<AnalysisStage>(["profile_pending", "profile_read", "dates_checked", "alerts_created", "final_received"]);
const CHECK_REASONS = new Map([
  ["Invalid tender source reference", "source_reference_invalid"],
  ["Too many unresolved deadline findings", "unresolved_deadline_limit"],
  ["Ungrounded deadline evidence", "deadline_quote_mismatch"],
  ["Deadline date is not grounded in its evidence", "deadline_date_mismatch"],
  ["Deadline evidence must contain exactly one explicit instant", "deadline_source_ambiguous"],
  ["Duplicate deadline", "duplicate_deadline"],
  ["Ungrounded requirement evidence", "requirement_quote_mismatch"],
  ["Ungrounded company evidence", "company_evidence_mismatch"],
  ["Unsupported missing-document claim", "unsupported_missing_claim"],
  ["Unsupported document-compliance claim", "unsupported_met_claim"],
  ["Unsupported document risk", "unsupported_risk_claim"],
  ["Company profile must be read first", "profile_tool_out_of_order"],
  ["Document dates must be checked for these deadlines before drafting alerts", "calendar_tool_out_of_order"],
  ["Required company profile tool was not used", "profile_tool_missing"],
  ["Required date tool was not used for final deadlines", "final_calendar_mismatch"],
  ["Required alert tool was not used for final deadlines", "final_alert_mismatch"],
  ["Ungrounded finding evidence", "finding_quote_mismatch"],
  ["Unresolved deadline contains a unique explicit instant", "unresolved_deadline_is_explicit"],
  ["Unresolved deadline reason is inconsistent with its evidence", "unresolved_deadline_reason_mismatch"],
  ["Unexpected conflicting evidence", "unexpected_conflict_evidence"],
  ["Conflicting finding needs a second source quote", "conflict_quote_missing"],
  ["Conflicting finding needs distinct source quotes", "conflict_quotes_identical"],
  ["Invalid conflicting requirement evidence", "conflict_evidence_invalid"],
]);
const SDK_REASONS = new Map([
  ["MaxTurnsExceededError", "model_turn_limit"],
  ["MaxTurnsExceeded", "model_turn_limit"],
  ["ModelBehaviorError", "invalid_model_output_or_tool_input"],
  ["UserError", "sdk_configuration_error"],
  ["ZodError", "invalid_structured_data"],
  ["ToolCallError", "tool_execution_failed"],
]);

/** Server diagnostics contain only allowlisted labels, never error text or payloads. */
export function getAnalysisDiagnostics(cause: unknown): { stage: AnalysisStage | "unknown"; reason: string } {
  const chain = errorChain(cause);
  const stage = chain.map(value => dataProperty(value, "stage")).find(value => ANALYSIS_STAGES.has(value as AnalysisStage)) as AnalysisStage | undefined;
  for (const value of chain) {
    const message = dataProperty(value, "message");
    if (typeof message === "string" && CHECK_REASONS.has(message)) return { stage: stage ?? "unknown", reason: CHECK_REASONS.get(message)! };
  }
  // Prefer the deepest known exception to an outer SDK tool wrapper.
  for (const value of [...chain].reverse()) {
    const name = dataProperty(value, "name") ?? className(value);
    if (typeof name === "string" && SDK_REASONS.has(name)) return { stage: stage ?? "unknown", reason: SDK_REASONS.get(name)! };
  }
  return { stage: stage ?? "unknown", reason: "unclassified" };
}

/** Return only allowlisted public categories and text, never provider error content. */
export function getAnalysisFailure(cause: unknown, locale: Locale): AnalysisFailure {
  const errors = errorChain(cause).map((value) => ({
    status: dataProperty(value, "status"),
    code: dataProperty(value, "code"),
    type: dataProperty(value, "type"),
    name: className(value),
  }));
  const hasCode = (code: string) => errors.some((value) => value.code === code);
  const hasStatus = (status: number) => errors.some((value) => value.status === status);
  let code: FailureCode = "analysis_unverified";

  // Specific provider facts take priority over generic wrapper errors.
  if (hasCode("credit_balance_exhausted")) code = "ai_credit_balance_exhausted";
  else if (errors.some((value) => (typeof value.code === "string" && QUOTA_CODES.has(value.code)) || value.type === "insufficient_quota")) code = "ai_quota_exceeded";
  else if (hasStatus(401) || hasCode("invalid_api_key")) code = "ai_authentication_failed";
  else if (hasCode("model_not_found")) code = "ai_model_unavailable";
  else if (hasStatus(403)) code = "ai_access_denied";
  else if (hasStatus(429) || hasCode("rate_limit_exceeded") || hasCode("slow_down")) code = "ai_rate_limited";
  else if (hasStatus(400) || hasStatus(404) || hasStatus(422)) code = "ai_request_rejected";
  else if (errors.some((value) => (
    typeof value.status === "number" && value.status >= 500 && value.status <= 599
  ) || (
    typeof value.code === "string" && CONNECTION_CODES.has(value.code)
  ) || (
    typeof value.name === "string" && CONNECTION_CLASSES.has(value.name)
  ))) code = "ai_provider_unavailable";

  const failure = FAILURES[code];
  return { message: locale === "ru" ? failure.ru : failure.en, code, status: failure.status };
}
