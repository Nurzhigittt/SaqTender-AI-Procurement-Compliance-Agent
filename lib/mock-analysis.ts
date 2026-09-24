import { createDraftAlerts } from "./alerts";
import { COMPANY_EVIDENCE, DISCLAIMER, SAMPLE_REQUIREMENTS, SAMPLE_TENDER, UNKNOWN_COMPANY_EVIDENCE } from "./demo-data";
import { explicitDatesInEvidence, validateGroundedAssessment } from "./grounding";
import type { Action, Assessment, Deadline, Requirement } from "./types";

function textLines(text: string): string[] {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

/** Conservative, repeatable local demonstration; it never calls an AI model. */
export function analyzeDemoTender(tenderText: string): Assessment {
  const lines = textLines(tenderText);
  const deadlines: Deadline[] = [];
  for (const line of lines) {
    if (!/\bdeadline\b/i.test(line) || line.length > 2000) continue;
    const dates = explicitDatesInEvidence(line);
    if (dates.length !== 1) continue;
    const title = /^\s*([^:\n]{1,190})\s*:/.exec(line)?.[1] ?? "Tender deadline";
    if (deadlines.some((item) => item.title === title && item.date === dates[0])) continue;
    deadlines.push({ title, date: dates[0], tenderEvidence: line });
    if (deadlines.length === 30) break;
  }

  const exactSample = tenderText.trim() === SAMPLE_TENDER.trim();
  const requirements: Requirement[] = [];
  const supported = [
    { text: SAMPLE_REQUIREMENTS.license, title: "Active construction license", documentId: "construction-license", status: "met", explanation: "The demo profile records an active construction license expiring on 10 May 2027, after the stated application deadline. Its scope and authenticity still require official verification." },
    { text: SAMPLE_REQUIREMENTS.expert, title: "Valid expert opinion", documentId: "expert-opinion", status: "met", explanation: "The recorded expert opinion expires on 5 October 2026, after submission closes on 29 September 2026. The short remaining validity is a renewal consideration, not a detected failure of the stated submission requirement." },
    { text: SAMPLE_REQUIREMENTS.experience, title: "Confirmed relevant work experience", documentId: "work-experience", status: "missing", explanation: "Work Experience Confirmation is marked Missing in the fictional company profile. The tender requires this evidence, so preparation and verification are needed before submission." },
    { text: SAMPLE_REQUIREMENTS.financial, title: "Current financial documentation", documentId: "financial-report", status: "unknown", explanation: "A financial report is recorded as active and updated on 1 September 2026. The supplied data does not establish whether its accounting period, format, or completeness meets the buyer's definition of current documentation." },
  ] as const;

  // Only the unchanged fixture gets fixture-specific conclusions. Edited tender
  // language may change the meaning of otherwise identical clauses elsewhere.
  if (exactSample) {
    for (const item of supported) requirements.push({
      title: item.title, status: item.status, tenderEvidence: item.text,
      companyEvidence: COMPANY_EVIDENCE[item.documentId], explanation: item.explanation,
    });
  } else {
    for (const line of lines) {
      if (line.length > 2000 || !/\b(must|shall|mandatory|required|requirement|license|financial documentation|expert opinion|work experience)\b/i.test(line)) continue;
      if (line.length < 20 || /^(mandatory qualification documents|requirements?)\s*:?[\s]*$/i.test(line)) continue;
      requirements.push({
        title: `Requirement candidate ${requirements.length + 1}`,
        status: "unknown",
        tenderEvidence: line,
        companyEvidence: UNKNOWN_COMPANY_EVIDENCE,
        explanation: "This line may contain a requirement. Demo Mode does not interpret edited wording, negation, exceptions, or document sufficiency. Verify this candidate manually or run a live AI analysis.",
      });
      if (requirements.length === 60) break;
    }
  }

  const actions: Action[] = exactSample ? [
    { priority: "critical", title: "Prepare work experience confirmation", description: "The profile marks the required evidence as missing. Gather relevant completion certificates or other evidence accepted by the buyer and verify it against the full tender." },
    { priority: "high", title: "Confirm bid security before the deadline", description: "The tender states 26 September 2026 at 18:00 Asia/Almaty. Confirm the required amount, method, and receipt criteria in the official documentation; these details are absent from the sample." },
    { priority: "high", title: "Verify the financial report requirements", description: "Check the required accounting period, format, and completeness. A report date alone does not prove the requirement is met." },
    { priority: "medium", title: "Plan expert opinion renewal", description: "The recorded expiry is 5 October 2026, six calendar days after submission closes. Renewal planning is a recommendation; the sample only requires validity during submission." },
  ] : [
    { priority: "high", title: "Manually verify the edited tender", description: "Demo Mode returns conservative candidates for edited text. It does not establish that all requirements or deadlines were found. Check every candidate, exception, document, and date against the full notice." },
    { priority: "medium", title: "Use live analysis for a new tender", description: "A server-configured OpenAI API key enables the compliance agent. Its output still requires review against original documents and official sources." },
  ];

  if (!deadlines.length) actions.push({ priority: "high", title: "Verify submission deadlines", description: "No supported deadline with an explicit full date, time, and timezone was detected. Check the notice manually; missing extraction does not mean there is no deadline." });

  return validateGroundedAssessment({
    summary: exactSample
      ? "Manual verification required. The fictional company is missing the work experience confirmation required by this sample tender. Its expert opinion remains valid through submission, while financial-document sufficiency needs review. Two tender deadlines produce six draft reminders."
      : "Manual verification required. This is a deterministic demonstration for edited text, not an AI interpretation. Candidate requirements remain unknown; only supported explicit deadline formats are extracted. No official eligibility conclusion can be drawn.",
    overallRisk: exactSample ? "high" : "unknown",
    officialEligibilityVerified: false,
    requirements,
    deadlines,
    actions,
    alerts: createDraftAlerts(deadlines),
    disclaimer: DISCLAIMER,
  }, tenderText);
}
