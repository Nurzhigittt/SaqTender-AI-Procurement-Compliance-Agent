import { COMPANY_EVIDENCE, DEMO_COMPANY, UNKNOWN_COMPANY_EVIDENCE } from "./demo-data";
import { AssessmentSchema, type Assessment, type Deadline } from "./types";

/** Only explicit full dates with a time and timezone can become a deadline. */
export function explicitDatesInEvidence(text: string): string[] {
  const dates: string[] = [];
  const pattern = /\b(\d{4}-\d{2}-\d{2})[T\s]+(\d{2}):(\d{2})(?::(\d{2}))?\s*(Asia\/Almaty|Z|(?:UTC\s*)?[+-]\d{2}:\d{2})(?![\w/])/g;
  for (const match of text.matchAll(pattern)) {
    const [, day, hour, minute, second = "00", zone] = match;
    const [year, month, date] = day.split("-").map(Number);
    if (+hour > 23 || +minute > 59 || +second > 59 || year < 1900 || year > 2200) continue;
    const nominal = Date.UTC(year, month - 1, date, +hour, +minute, +second);
    if (new Date(nominal).toISOString().slice(0, 10) !== day) continue;

    let timestamp: number;
    if (zone === "Asia/Almaty") {
      // Use the runtime's IANA timezone database rather than the host timezone.
      const format = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      });
      timestamp = nominal;
      for (let pass = 0; pass < 2; pass += 1) {
        const parts = Object.fromEntries(format.formatToParts(timestamp).map((part) => [part.type, part.value]));
        const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
        timestamp += nominal - represented;
      }
    } else {
      const offset = zone.replace(/UTC\s*/, "");
      if (offset !== "Z" && (+offset.slice(1, 3) > 14 || +offset.slice(4, 6) > 59 || (+offset.slice(1, 3) === 14 && +offset.slice(4, 6) > 0))) continue;
      timestamp = Date.parse(`${day}T${hour}:${minute}:${second}${offset}`);
    }
    if (Number.isFinite(timestamp)) dates.push(new Date(timestamp).toISOString());
  }
  return dates;
}

export function validateGroundedDeadlines(deadlines: Deadline[], tenderText: string): void {
  const seen = new Set<string>();
  for (const deadline of deadlines) {
    if (!tenderText.includes(deadline.tenderEvidence)) throw new Error("Ungrounded deadline evidence");
    const timestamp = Date.parse(deadline.date);
    if (!explicitDatesInEvidence(deadline.tenderEvidence).some((date) => Date.parse(date) === timestamp)) {
      throw new Error("Deadline date is not grounded in its evidence");
    }
    const identity = `${deadline.title.toLowerCase()}|${timestamp}`;
    if (seen.has(identity)) throw new Error("Duplicate deadline");
    seen.add(identity);
  }
}

export function validateGroundedAssessment(value: unknown, tenderText: string): Assessment {
  const assessment = AssessmentSchema.parse(value);
  for (const requirement of assessment.requirements) {
    if (!tenderText.includes(requirement.tenderEvidence)) throw new Error("Ungrounded requirement evidence");
    const documentId = Object.keys(COMPANY_EVIDENCE).find((id) => COMPANY_EVIDENCE[id] === requirement.companyEvidence);
    if (!documentId && requirement.companyEvidence !== UNKNOWN_COMPANY_EVIDENCE) {
      throw new Error("Ungrounded company evidence");
    }
    const document = DEMO_COMPANY.documents.find((item) => item.id === documentId);
    if (requirement.status === "missing" && document?.status !== "missing") throw new Error("Unsupported missing-document claim");
    if (requirement.status === "met" && document?.status !== "active") throw new Error("Unsupported document-compliance claim");
    if (requirement.status === "at_risk" && !document) throw new Error("Unsupported document risk");
  }
  validateGroundedDeadlines(assessment.deadlines, tenderText);
  // A missing mandatory item or unresolved fact must not be labelled low risk.
  if (assessment.requirements.some((item) => item.status === "missing")) assessment.overallRisk = "high";
  else if (assessment.overallRisk === "low" && (!assessment.requirements.length || assessment.requirements.some((item) => item.status === "unknown"))) {
    assessment.overallRisk = "unknown";
  }
  return assessment;
}
