import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAnalysisFailure } from "../lib/analysis-error";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { DATASET_VERSION, EVALUATION_CASES } from "./cases";
import { gradeAssessment, summarizeGrades, validateEvaluationCase, type CaseGrade } from "./grade";
import { EvaluationOptionsError, parseEvaluationOptions } from "./options";
import { createRemoteAnalyzer, normalizeEvaluationOrigin, RemoteEvaluationError } from "./remote-client";
import type { Assessment } from "../lib/types";

async function main() {
  const { mode, url, selectedIds } = parseEvaluationOptions(process.argv.slice(2), EVALUATION_CASES.map(item => item.id));
  const cases = selectedIds.map(id => EVALUATION_CASES.find(item => item.id === id)!);
  if (!cases.length) throw new Error("No cases selected.");
  if (new Set(EVALUATION_CASES.map(item => item.id)).size !== EVALUATION_CASES.length) throw new Error("Duplicate dataset IDs");
  EVALUATION_CASES.forEach(validateEvaluationCase);
  if (mode === "--check") {
    console.log(`Validated ${EVALUATION_CASES.length} synthetic cases (${DATASET_VERSION}). No model requests; no AI accuracy measured.`);
    return;
  }
  if (mode === "--live" && !process.env.OPENAI_API_KEY?.trim()) throw new EvaluationOptionsError("OPENAI_API_KEY is missing. Set it on the server or in .env.local; do not put it in a CLI argument.");
  const endpoint = mode === "--remote" ? normalizeEvaluationOrigin(url!) : null;
  const remote = endpoint ? createRemoteAnalyzer(endpoint) : null;
  if (remote) await remote.preflight();
  const analyzeLive = mode === "--live" ? (await import("../lib/agent")).analyzeLiveTender : null;
  const paid = Boolean(analyzeLive || remote);
  const grades: CaseGrade[] = [];
  let stoppedBy: string | null = null;
  const startedAt = new Date().toISOString();
  const elapsed: Record<string, number> = {};
  const failures: { id: string; code: string }[] = [];
  const assessments: Record<string, Assessment> = {};
  console.log(`${paid ? "LIVE MODEL" : "DETERMINISTIC DEMO BASELINE"}: ${cases.length} synthetic cases, sequential execution. ${paid ? "This makes paid API requests." : "This does not measure AI accuracy."}`);
  for (const item of cases) {
    const start = Date.now();
    try {
      const assessment = remote ? await remote.analyze(item) : analyzeLive
        ? await analyzeLive(item.tenderText, AbortSignal.timeout(45000), item.locale, item.companyProfile)
        : analyzeDemoTender(item.tenderText, item.locale, item.companyProfile);
      // Only built-in fictional cases are accepted. Retain their answers for human review.
      if (remote) assessments[item.id] = assessment;
      const grade = gradeAssessment(item, assessment);
      grades.push(grade);
      console.log(`${grade.passed ? "PASS" : "FAIL"} ${item.id}${grade.issues.length ? `: ${grade.issues.join("; ")}` : ""}`);
    } catch (cause) {
      const code = cause instanceof RemoteEvaluationError ? cause.code : getAnalysisFailure(cause, "en").code;
      failures.push({ id: item.id, code });
      grades.push({ id: item.id, passed: false, issues: [`Execution failed: ${code}`], requirements: { matched: 0, expected: item.expected.requirements.length, actual: 0 }, deadlines: { matched: 0, expected: item.expected.deadlines.length, actual: 0 } });
      console.log(`ERROR ${item.id}: ${code}`);
      // Stop on any execution failure; don't burn credits retrying a broken run.
      stoppedBy = code;
    }
    elapsed[item.id] = Date.now() - start;
    if (stoppedBy) break;
  }
  const report = {
    datasetVersion: DATASET_VERSION, mode: remote ? "remote-live" : mode.slice(2), model: analyzeLive ? process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini" : null, endpoint,
    startedAt, finishedAt: new Date().toISOString(), planned: cases.length, completed: grades.length,
    unrunCaseIds: cases.slice(grades.length).map(item => item.id), stoppedBy, failures,
    limitation: "Authored synthetic dataset; not expert-approved, not real-world accuracy. Automated source-overlap and status checks require human review. Missing model results are failures; unrun cases are listed separately.",
    summary: summarizeGrades(grades), grades, elapsedMs: elapsed, ...(remote ? { assessments } : {}),
  };
  const directory = path.join(process.cwd(), "evals", "runs");
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${startedAt.replace(/[:.]/g, "-")}-${mode.slice(2)}.json`);
  await writeFile(destination, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary));
  console.log(`Report: ${destination}`);
  if (grades.some(item => !item.passed) || stoppedBy) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof RemoteEvaluationError ? `Evaluation stopped before analysis: ${error.code}` : error instanceof EvaluationOptionsError ? error.message : "Evaluation could not start. Check arguments, dataset and server configuration.");
  process.exitCode = 1;
});
