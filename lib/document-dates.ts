import type { CompanyProfile, Deadline } from "./types";

/** Calendar comparison only. It cannot establish scope, authenticity or legal sufficiency. */
export function compareDocumentDates(profile: CompanyProfile, deadlines: Deadline[]) {
  const calendar = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" });
  return deadlines.flatMap(deadline => {
    const date = new Date(deadline.date);
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid comparison deadline");
    const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
    const localDay = `${parts.year}-${parts.month}-${parts.day}`;
    return profile.documents.map(document => ({
      documentId: document.id,
      recordedStatus: document.status,
      expiresAt: document.expiresAt,
      deadline: deadline.date,
      deadlineDayInAlmaty: localDay,
      dateRelation: document.status !== "active" || !document.expiresAt
        ? "unknown" as const
        : document.expiresAt < localDay ? "expires_before" as const : "covers_deadline_day" as const,
    }));
  });
}
