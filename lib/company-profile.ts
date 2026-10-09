import { COMPANY_DOCUMENT_IDS, CompanyProfileSchema, type CompanyProfile } from "./types";

export const PROFILE_STORAGE_KEY = "saqtender.company-profile.v1";
export const DOCUMENT_TITLES = {
  "construction-license": "Construction License",
  "expert-opinion": "Expert Opinion",
  "financial-report": "Financial Report",
  "work-experience": "Work Experience Confirmation",
  "manufacturer-registry": "Manufacturer Registry",
} as const;

/** Canonical order/titles make evidence stable. User content never becomes instructions. */
export function normalizeCompanyProfile(value: unknown): CompanyProfile {
  const parsed = CompanyProfileSchema.parse(value);
  return {
    ...parsed,
    documents: COMPANY_DOCUMENT_IDS.map(id => ({ ...parsed.documents.find(document => document.id === id)!, title: DOCUMENT_TITLES[id] })),
  };
}

export function getCompanyEvidence(profile: CompanyProfile): Record<string, string> {
  return Object.fromEntries(profile.documents.map(document => [document.id,
    `${DOCUMENT_TITLES[document.id]}: ${document.status === "active" ? "Active" : document.status === "missing" ? "Missing" : "Not Verified"}${document.expiresAt ? `; expires ${document.expiresAt}` : ""}${document.updatedAt ? `; updated ${document.updatedAt}` : ""}.`,
  ]));
}

export function profileFingerprint(profile: CompanyProfile): string {
  return JSON.stringify(normalizeCompanyProfile(profile));
}
