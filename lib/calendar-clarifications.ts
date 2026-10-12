import type { LiveFindings } from "./live-findings";

type Clarification = LiveFindings["unresolvedDeadlines"][number];

/** Keep every distinct selected passage; no fuzzy, prefix or overlap deduplication. */
export function mergeCalendarClarifications(...groups: readonly (readonly Clarification[])[]): Clarification[] {
  const byQuote = new Map<string, Clarification>();
  for (const group of groups) {
    for (const item of group) {
      if (!byQuote.has(item.tenderEvidence)) byQuote.set(item.tenderEvidence, { ...item });
      if (byQuote.size > 30) throw new Error("Too many unresolved deadline findings");
    }
  }
  return [...byQuote.values()];
}
