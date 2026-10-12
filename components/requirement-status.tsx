import type { Requirement } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { countsTowardQualification, getRequirementStatusLabel } from "@/lib/requirement-kind";
import { Badge, StatusBadge } from "./ui";

/** Contract conditions, scoring criteria and exemptions are not qualification gaps. */
export function RequirementStatusBadge({ requirement, locale }: { requirement: Requirement; locale: Locale }) {
  return countsTowardQualification(requirement)
    ? <StatusBadge status={requirement.status} locale={locale} />
    : <Badge tone="neutral">{getRequirementStatusLabel(requirement, locale)}</Badge>;
}
