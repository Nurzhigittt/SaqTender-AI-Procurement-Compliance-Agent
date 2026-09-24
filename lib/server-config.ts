import "server-only";
import type { AnalysisMode } from "./types";

export function getAnalysisMode(): AnalysisMode {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true" || !process.env.OPENAI_API_KEY?.trim()
    ? "demo"
    : "live";
}
