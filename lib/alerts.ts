import type { Alert, Deadline } from "./types";
import type { Locale } from "./i18n";

const REMINDERS = [
  { label: "7 days before", labelRu: "за 7 дней", hours: 168 },
  { label: "3 days before", labelRu: "за 3 дня", hours: 72 },
  { label: "24 hours before", labelRu: "за 24 часа", hours: 24 },
] as const;

/** Pure draft creation. There is deliberately no scheduler, storage, or delivery. */
export function createDraftAlerts(deadlines: Deadline[], locale: Locale = "en"): Alert[] {
  return deadlines.flatMap((deadline) => {
    const timestamp = Date.parse(deadline.date);
    if (!Number.isFinite(timestamp)) throw new Error("Invalid deadline date");
    return REMINDERS.map(({ label, labelRu, hours }) => ({
      title: `${deadline.title} — ${locale === "ru" ? labelRu : label}`,
      scheduledAt: new Date(timestamp - hours * 60 * 60 * 1000).toISOString(),
      status: "draft" as const,
    }));
  });
}
