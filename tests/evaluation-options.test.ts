import assert from "node:assert/strict";
import test from "node:test";
import { parseEvaluationOptions } from "../evals/options";

const ids = ["one", "two", "three", "four"];
test("remote evaluations require explicit selection and cannot exceed three paid requests", () => {
  assert.throws(() => parseEvaluationOptions(["--remote", "https://example.test"], ids), /Explicitly select/);
  assert.throws(() => parseEvaluationOptions(["--remote", "https://example.test", "--limit", "4"], ids), /three cases/);
  assert.throws(() => parseEvaluationOptions(["--remote", "https://example.test", ...ids.flatMap(id => ["--case", id])], ids), /three cases/);
  assert.deepEqual(parseEvaluationOptions(["--remote", "https://example.test", "--case", "three", "--case", "one"], ids).selectedIds, ["three", "one"]);
});

test("selection rejects duplicate or ambiguous options while preserving offline default", () => {
  for (const options of [["--case", "one", "--case", "one"], ["--case", "one", "--limit", "2"], ["--limit", "2", "--limit", "3"], ["--case", "missing"], ["--limit"], ["--limit", "0"]]) {
    assert.throws(() => parseEvaluationOptions(["--remote", "https://example.test", ...options], ids));
  }
  assert.deepEqual(parseEvaluationOptions([], ids), { mode: "--check", url: undefined, selectedIds: ids });
  assert.deepEqual(parseEvaluationOptions(["--live", "--limit", "2"], ids).selectedIds, ["one", "two"]);
});
