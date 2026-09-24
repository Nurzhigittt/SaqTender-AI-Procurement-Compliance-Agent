import { NextRequest, NextResponse } from "next/server";
import { analyzeLiveTender } from "@/lib/agent";
import { analyzeDemoTender } from "@/lib/mock-analysis";
import { getAnalysisMode } from "@/lib/server-config";
import type { Locale } from "@/lib/i18n";
import { AnalyzeRequestSchema, type AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128000;
const RESPONSE_HEADERS = { "Cache-Control": "no-store" };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: RESPONSE_HEADERS });
}

async function readBoundedBody(request: NextRequest): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("Request too large");
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  let locale: Locale = /^ru(?:-|,|;|$)/i.test(request.headers.get("accept-language") || "") ? "ru" : "en";
  const tr = (english: string, russian: string) => locale === "ru" ? russian : english;
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return error(tr("Send tender text as a JSON request.", "Отправьте текст тендера в запросе формата JSON."), 415);
  }
  if (Number(request.headers.get("content-length") || "0") > MAX_BODY_BYTES) {
    return error(tr("This request is too large. Use 20,000 characters or fewer.", "Запрос слишком большой. Используйте не более 20 000 символов."), 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBoundedBody(request));
  } catch (cause) {
    return cause instanceof RangeError
      ? error(tr("This request is too large. Use 20,000 characters or fewer.", "Запрос слишком большой. Используйте не более 20 000 символов."), 413)
      : error(tr("The request could not be read. Please try again.", "Не удалось прочитать запрос. Повторите попытку."), 400);
  }
  if (body && typeof body === "object" && "locale" in body && (body.locale === "ru" || body.locale === "en")) locale = body.locale;
  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) return error(tr("Enter tender text between 20 and 20,000 characters.", "Введите текст тендера длиной от 20 до 20 000 символов и выберите поддерживаемый язык."), 400);
  locale = parsed.data.locale;

  const mode = getAnalysisMode();
  const controller = new AbortController();
  const onDisconnect = () => controller.abort();
  request.signal.addEventListener("abort", onDisconnect, { once: true });
  if (request.signal.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45000);

  try {
    const assessment = mode === "demo"
      ? analyzeDemoTender(parsed.data.tenderText, locale)
      : await analyzeLiveTender(parsed.data.tenderText, controller.signal, locale);
    const response: AnalyzeResponse = { assessment, mode, analyzedAt: new Date().toISOString() };
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch {
    if (timedOut || controller.signal.aborted) return error(tr("The analysis timed out or was interrupted. Please retry.", "Анализ прерван или превысил время ожидания. Повторите попытку."), 504);
    return error(tr("The analysis could not be completed or its evidence could not be verified. Please retry. If this continues, check the server's AI configuration.", "Не удалось завершить анализ или проверить его подтверждения. Повторите попытку. Если ошибка сохраняется, проверьте настройки ИИ на сервере."), 502);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", onDisconnect);
  }
}
