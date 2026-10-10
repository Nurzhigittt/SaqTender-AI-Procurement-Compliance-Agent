import assert from "node:assert/strict";
import test from "node:test";
import { resolveGroundedDeadlines, validateGroundedDeadlines } from "../lib/grounding";

test("deadline resolution calculates Almaty time on the server and preserves the exact quote", () => {
  const tenderEvidence = "Подача: 2026-09-29 10:00 Asia/Almaty.";
  const deadlines = resolveGroundedDeadlines([{ title: "Подача", tenderEvidence }], tenderEvidence);
  assert.deepEqual(deadlines, [{ title: "Подача", tenderEvidence, date: "2026-09-29T05:00:00.000Z" }]);
  assert.throws(() => validateGroundedDeadlines([{ ...deadlines[0], date: "2026-09-29T10:00:00+06:00" }], tenderEvidence), /not grounded/);
  const offsetQuote = "Закрытие: 2026-11-01 01:00 +05:00";
  assert.equal(resolveGroundedDeadlines([{ title: "Закрытие", tenderEvidence: offsetQuote }], offsetQuote)[0].date, "2026-10-31T20:00:00.000Z");
});

test("deadline resolution cannot guess missing, invalid or conflicting source times", () => {
  for (const tenderEvidence of [
    "Подача: 2026-09-29 10:00 без часового пояса.",
    "Подача: 2026-02-30 10:00 Asia/Almaty.",
    "Срок: 2026-09-29 10:00 Asia/Almaty или 2026-09-30 10:00 Asia/Almaty.",
  ]) {
    assert.throws(() => resolveGroundedDeadlines([{ title: "Срок", tenderEvidence }], tenderEvidence), /exactly one explicit instant/);
  }
  assert.deepEqual(resolveGroundedDeadlines([], "Срок уточняется."), []);
});

test("deadline resolution rejects fabricated evidence and duplicated deadlines", () => {
  const candidate = { title: "Подача", tenderEvidence: "Срок: 2026-09-29 10:00 Asia/Almaty." };
  assert.throws(() => resolveGroundedDeadlines([candidate], "Такой цитаты нет."), /Ungrounded deadline evidence/);
  assert.throws(() => resolveGroundedDeadlines([candidate, candidate], candidate.tenderEvidence), /Duplicate deadline/);
});
