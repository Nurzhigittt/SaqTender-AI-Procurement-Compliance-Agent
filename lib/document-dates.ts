import type { CompanyProfile, Deadline } from "./types";

/** Calendar comparison only. It cannot establish scope, authenticity or legal sufficiency. */
export function compareDocumentDates(profile: CompanyProfile, deadlines: Deadline[]) {
  const calendar = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" });
  return deadlines.flatMap(deadline => {
    const date = new Date(deadline.date);
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid comparison deadline");
    const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
    const localDay = `${parts.year}-${parts.month}-${parts.day}`;
    return profile.documents.map(document => {
      const dateRelation = document.status !== "active" || !document.expiresAt
        ? "unknown" as const
        : document.expiresAt < localDay ? "expires_before" as const : "covers_deadline_day" as const;
      return {
        documentId: document.id,
        recordedStatus: document.status,
        recordPresence: document.status === "active" ? "recorded_present" as const
          : document.status === "missing" ? "recorded_missing" as const : "unverified" as const,
        expiresAt: document.expiresAt,
        deadline: deadline.date,
        deadlineDayInAlmaty: localDay,
        dateRelation,
        // Apply only to a tender condition explicitly requiring validity at this deadline.
        // Covering the date alone cannot establish the document's scope or authenticity.
        statusForValidityRequirement: document.status === "missing" ? "missing" as const
          : dateRelation === "expires_before" ? "at_risk" as const : "unknown" as const,
      };
    });
  });
}
