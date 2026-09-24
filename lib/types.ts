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

export const AnalyzeRequestSchema = z.object({
  tenderText: z.string().trim().min(20, "Enter at least 20 characters of tender text.").max(20000, "Tender text must be 20,000 characters or fewer."),
  locale: z.enum(["ru", "en"]).default("en"),
}).strict();

export type Requirement = z.infer<typeof RequirementSchema>;
export type Deadline = z.infer<typeof DeadlineSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type AnalysisMode = "demo" | "live";

export interface CompanyDocument {
  id: string;
  title: string;
  status: "active" | "missing" | "not_verified";
  expiresAt: string | null;
  updatedAt: string | null;
}

export interface CompanyProfile {
  name: string;
  industry: string;
  isDemo: true;
  documents: CompanyDocument[];
}

export interface AnalyzeResponse {
  assessment: Assessment;
  mode: AnalysisMode;
  analyzedAt: string;
}
