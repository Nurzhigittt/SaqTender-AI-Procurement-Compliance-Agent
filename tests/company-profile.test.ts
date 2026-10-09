import assert from "node:assert/strict";
import test from "node:test";
import { getCompanyEvidence, normalizeCompanyProfile } from "../lib/company-profile";
import { DEMO_COMPANY, resolveCompanyProfile, SAMPLE_TENDER_RU } from "../lib/demo-data";
import { validateGroundedAssessment } from "../lib/grounding";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { createReportHtml } from "../lib/report-export";
import { AnalyzeRequestSchema, CompanyProfileSchema } from "../lib/types";

const customProfile = () => resolveCompanyProfile({ ...structuredClone(DEMO_COMPANY), name: "QA Engineering LLP" });

test("profile input rejects duplicate records, impossible dates and unexpected fields", () => {
  const profile = customProfile();
  profile.documents[1] = profile.documents[0];
  assert.equal(CompanyProfileSchema.safeParse(profile).success, false);
  for (const date of ["2026-02-30", "2026-13-01", "1899-12-31", "2201-01-01", "today"]) {
    const invalid = customProfile(); invalid.documents[0].expiresAt = date;
    assert.equal(AnalyzeRequestSchema.safeParse({ tenderText: SAMPLE_TENDER_RU, companyProfile: invalid }).success, false);
  }
  assert.equal(CompanyProfileSchema.safeParse({ ...customProfile(), apiKey: "not-a-profile-field" }).success, false);
  assert.equal(CompanyProfileSchema.safeParse({ ...customProfile(), name: " " }).success, false);
});

test("profile normalization restores known titles and order and cannot spoof the fixture label", () => {
  const profile = customProfile();
  profile.isDemo = true;
  profile.documents.reverse(); profile.documents[0].title = "Injected title";
  const normalized = resolveCompanyProfile(profile);
  assert.equal(normalized.isDemo, false);
  assert.deepEqual(normalized.documents.map(item => item.id), DEMO_COMPANY.documents.map(item => item.id));
  assert.equal(JSON.stringify(normalized).includes("Injected title"), false);
  assert.deepEqual(normalizeCompanyProfile(DEMO_COMPANY), DEMO_COMPANY);
  assert.equal(resolveCompanyProfile().isDemo, true);
});

test("changing a missing document to available removes that missing claim without asserting compliance", () => {
  const profile = customProfile();
  profile.documents.find(item => item.id === "work-experience")!.status = "active";
  const result = analyzeDemoTender(SAMPLE_TENDER_RU, "ru", profile);
  assert.equal(result.requirements.find(item => item.title.includes("опыт"))!.status, "unknown");
  assert.equal(result.requirements.some(item => item.status === "missing"), false);
  assert.equal(result.overallRisk, "unknown");
  assert.equal(result.summary.includes("У вымышленной компании отсутствует"), false);
  assert.equal(result.actions.some(item => item.description.includes("отсутствующ")), false);
  assert.equal(result.disclaimer.includes("профилем вымышленной компании"), false);
  assert.equal(result.officialEligibilityVerified, false);
});

test("custom profile expiry and missing status affect the exact sample independently", () => {
  const profile = customProfile();
  profile.documents[0].expiresAt = "2026-09-28";
  profile.documents[1].status = "missing";
  const result = analyzeDemoTender(SAMPLE_TENDER_RU, "ru", profile);
  assert.deepEqual(result.requirements.map(item => item.status), ["at_risk", "missing", "missing", "unknown"]);
  assert.equal(result.overallRisk, "high");
  assert.ok(result.requirements[0].companyEvidence.includes("2026-09-28"));
  assert.deepEqual([result.deadlines.length, result.alerts.length], [2, 6]);
});

test("evidence from another company profile cannot be accepted for changed records", () => {
  const profile = customProfile(); profile.documents[0].status = "missing";
  const staleReport = analyzeDemoTender(SAMPLE_TENDER_RU, "ru");
  assert.throws(() => validateGroundedAssessment(staleReport, SAMPLE_TENDER_RU, profile));
  const current = analyzeDemoTender(SAMPLE_TENDER_RU, "ru", profile);
  assert.doesNotThrow(() => validateGroundedAssessment(current, SAMPLE_TENDER_RU, profile));
  assert.equal(current.requirements[0].companyEvidence, getCompanyEvidence(profile)["construction-license"]);
});

test("custom records cannot make altered tender clauses acquire fixture conclusions", () => {
  const result = analyzeDemoTender(SAMPLE_TENDER_RU.replace("2026-09-29", "2026-11-01"), "ru", customProfile());
  assert.ok(result.requirements.every(item => item.status === "unknown"));
  assert.equal(result.overallRisk, "unknown");
});

test("export names the analyzed company, translates its evidence and escapes company text", () => {
  const profile = customProfile(); profile.name = 'QA <img src=x onerror="alert(1)">';
  profile.documents[0].expiresAt = "2028-07-10";
  const report = createReportHtml({ assessment: analyzeDemoTender(SAMPLE_TENDER_RU, "ru", profile), companyProfile: profile, locale: "ru", mode: "demo", analyzedAt: "2026-10-09T07:00:00Z" });
  assert.match(report, /QA &lt;img/);
  assert.doesNotMatch(report, /<img|OrdaBuild|Вымышленная компания/);
  assert.match(report, /Профиль пользователя · Не проверен/);
  assert.match(report, /срок действия до 10\.07\.2028/);
});
