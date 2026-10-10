export class EvaluationOptionsError extends Error {}

export function parseEvaluationOptions(args: string[], knownIds: string[]) {
  const mode = args[0] ?? "--check";
  if (!["--check", "--demo", "--live", "--remote"].includes(mode)) {
    throw new EvaluationOptionsError("Use --check, --demo, --live or --remote URL with --case ID or --limit N.");
  }
  const remote = mode === "--remote";
  const url = remote ? args[1] : undefined;
  if (remote && (!url || url.startsWith("--"))) throw new EvaluationOptionsError("Remote evaluation requires a deployment URL.");
  const ids: string[] = [];
  let limit: number | undefined;
  for (let i = remote ? 2 : 1; i < args.length; i += 2) {
    const value = args[i + 1];
    if (args[i] === "--case" && knownIds.includes(value) && !ids.includes(value)) ids.push(value);
    else if (args[i] === "--limit" && limit === undefined && /^\d+$/.test(value ?? "") && Number(value) >= 1 && Number(value) <= knownIds.length) limit = Number(value);
    else throw new EvaluationOptionsError("Invalid, missing or duplicate evaluation option. Use known --case IDs or one --limit.");
  }
  if (ids.length && limit !== undefined) throw new EvaluationOptionsError("Use --case or --limit, not both.");
  if (remote && !ids.length && limit === undefined) throw new EvaluationOptionsError("Remote calls cost API credits. Explicitly select 1–3 cases with --case or --limit.");
  const selectedIds = ids.length ? ids : knownIds.slice(0, limit ?? knownIds.length);
  if (remote && selectedIds.length > 3) throw new EvaluationOptionsError("Remote evaluation is limited to three cases per run.");
  return { mode, url, selectedIds };
}
