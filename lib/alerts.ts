import type { Alert, Deadline } from "./types";

const REMINDERS = [
  { label: "7 days before", hours: 168 },
  { label: "3 days before", hours: 72 },
  { label: "24 hours before", hours: 24 },
] as const;

/** Pure draft creation. There is deliberately no scheduler, storage, or delivery. */
export function createDraftAlerts(deadlines: Deadline[]): Alert[] {
  return deadlines.flatMap((deadline) => {
    const timestamp = Date.parse(deadline.date);
    if (!Number.isFinite(timestamp)) throw new Error("Invalid deadline date");
    return REMINDERS.map(({ label, hours }) => ({
      title: `${deadline.title} — ${label}`,
      scheduledAt: new Date(timestamp - hours * 60 * 60 * 1000).toISOString(),
      status: "draft" as const,
    }));
  });
}
