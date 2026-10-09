import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAnalysisFailure } from "../lib/analysis-error";
import { analyzeDemoTender } from "../lib/mock-analysis";
import { DATASET_VERSION, EVALUATION_CASES } from "./cases";
import { gradeAssessment, summarizeGrades, validateEvaluationCase, type CaseGrade } from "./grade";

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] ?? "--check";
  if (!["--check", "--demo", "--live"].includes(mode)) throw new Error("Use --check, --demo or --live, optionally --limit N or --case ID.");
  let cases = EVALUATION_CASES;
  for (let i = 1; i < args.length; i += 2) {
    const value = args[i + 1];
    if (args[i] === "--limit" && /^\d+$/.test(value ?? "") && Number(value) >= 1 && Number(value) <= EVALUATION_CASES.length) cases = cases.slice(0, Number(value));
    else if (args[i] === "--case" && EVALUATION_CASES.some(item => item.id === value)) cases = cases.filter(item => item.id === value);
    else throw new Error("Invalid evaluation option. Use --limit 1..20 or an existing --case ID.");
  }
  if (!cases.length) throw new Error("No cases selected.");
  if (new Set(EVALUATION_CASES.map(item => item.id)).size !== EVALUATION_CASES.length) throw new Error("Duplicate dataset IDs");
  EVALUATION_CASES.forEach(validateEvaluationCase);
  if (mode === "--check") {
    console.log(`Validated ${EVALUATION_CASES.length} synthetic cases (${DATASET_VERSION}). No model requests; no AI accuracy measured.`);
    return;
  }
  if (mode === "--live" && !process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is missing. Set it on the server or in .env.local; do not put it in a CLI argument.");
  const analyzeLive = mode === "--live" ? (await import("../lib/agent")).analyzeLiveTender : null;
  const grades: CaseGrade[] = [];
  let stoppedBy: string | null = null;
  const startedAt = new Date().toISOString();
  const elapsed: Record<string, number> = {};
  const failures: { id: string; code: string }[] = [];
  console.log(`${mode === "--live" ? "LIVE MODEL" : "DETERMINISTIC DEMO BASELINE"}: ${cases.length} synthetic cases, sequential execution. ${mode === "--live" ? "This makes paid API requests." : "This does not measure AI accuracy."}`);
  for (const item of cases) {
    const start = Date.now();
    try {
      const assessment = analyzeLive
        ? await analyzeLive(item.tenderText, AbortSignal.timeout(45000), item.locale, item.companyProfile)
        : analyzeDemoTender(item.tenderText, item.locale, item.companyProfile);
      const grade = gradeAssessment(item, assessment);
      grades.push(grade);
      console.log(`${grade.passed ? "PASS" : "FAIL"} ${item.id}${grade.issues.length ? `: ${grade.issues.join("; ")}` : ""}`);
    } catch (cause) {
      const code = getAnalysisFailure(cause, "en").code;
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
    datasetVersion: DATASET_VERSION, mode: mode.slice(2), model: analyzeLive ? process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini" : null,
    startedAt, finishedAt: new Date().toISOString(), planned: cases.length, completed: grades.length,
    unrunCaseIds: cases.slice(grades.length).map(item => item.id), stoppedBy, failures,
    limitation: "Authored synthetic dataset; not expert-approved, not real-world accuracy. Automated source-overlap and status checks require human review. Missing model results are failures; unrun cases are listed separately.",
    summary: summarizeGrades(grades), grades, elapsedMs: elapsed,
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
  // Configuration errors are ours; provider failures are handled without raw payloads above.
  console.error(error instanceof Error && !process.env.OPENAI_API_KEY?.trim() ? error.message : "Evaluation could not start. Check arguments, dataset and server configuration.");
  process.exitCode = 1;
});
