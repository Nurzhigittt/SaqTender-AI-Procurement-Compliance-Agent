import { z } from "zod";

export const RequirementSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(["met", "missing", "at_risk", "unknown"]),
  tenderEvidence: z.string().min(1).max(2000),
  companyEvidence: z.string().min(1).max(1000),
  explanation: z.string().min(1).max(2000),
}).strict();

export const DeadlineSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().datetime({ offset: true }),
  tenderEvidence: z.string().min(1).max(2000),
}).strict();

export const ActionSchema = z.object({
  priority: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
}).strict();

export const AlertSchema = z.object({
  title: z.string().min(1).max(300),
  scheduledAt: z.string().datetime({ offset: true }),
  status: z.literal("draft"),
}).strict();

export const AssessmentSchema = z.object({
  summary: z.string().min(1).max(3000),
  overallRisk: z.enum(["low", "medium", "high", "unknown"]),
  officialEligibilityVerified: z.literal(false),
  requirements: z.array(RequirementSchema).max(60),
  deadlines: z.array(DeadlineSchema).max(30),
  actions: z.array(ActionSchema).max(40),
  alerts: z.array(AlertSchema).max(90),
  disclaimer: z.string().min(1).max(1500),
}).strict();

export const COMPANY_DOCUMENT_IDS = ["construction-license", "expert-opinion", "financial-report", "work-experience", "manufacturer-registry"] as const;
const CalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "2200-12-31";
});
export const CompanyDocumentSchema = z.object({
  id: z.enum(COMPANY_DOCUMENT_IDS),
  title: z.string().trim().min(1).max(100),
  status: z.enum(["active", "missing", "not_verified"]),
  expiresAt: CalendarDateSchema.nullable(),
  updatedAt: CalendarDateSchema.nullable(),
}).strict();
export const CompanyProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().min(2).max(120),
  isDemo: z.boolean(),
  documents: z.array(CompanyDocumentSchema).length(COMPANY_DOCUMENT_IDS.length)
    .refine(documents => new Set(documents.map(document => document.id)).size === COMPANY_DOCUMENT_IDS.length),
}).strict();

export const AnalyzeRequestSchema = z.object({
  tenderText: z.string().trim().min(20, "Enter at least 20 characters of tender text.").max(20000, "Tender text must be 20,000 characters or fewer."),
  locale: z.enum(["ru", "en"]).default("en"),
  companyProfile: CompanyProfileSchema.optional(),
}).strict();

export type Requirement = z.infer<typeof RequirementSchema>;
export type Deadline = z.infer<typeof DeadlineSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type AnalysisMode = "demo" | "live";

export type CompanyDocument = z.infer<typeof CompanyDocumentSchema>;
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

export interface AnalyzeResponse {
  assessment: Assessment;
  mode: AnalysisMode;
  analyzedAt: string;
}
