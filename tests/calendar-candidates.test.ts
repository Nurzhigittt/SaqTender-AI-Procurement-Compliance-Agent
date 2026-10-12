import assert from "node:assert/strict";
import test from "node:test";
import { resolveCalendarCandidates } from "../lib/calendar-candidates";
import { createTenderFragments, type SourceReference } from "../lib/tender-fragments";

function fixture(passages: string[]) {
  const source = passages.join("\n");
  const fragments = createTenderFragments(source);
  const reference = (passage: string): SourceReference => {
    const start = source.indexOf(passage);
    assert.ok(start >= 0);
    const end = start + passage.length;
    const covered = fragments.filter(fragment => fragment.start < end && fragment.end > start);
    assert.ok(covered.length);
    return { startFragment: covered[0].id, endFragment: covered.at(-1)!.id };
  };
  const candidate = (index: number, title = `Срок ${index + 1}`) => ({ title, sourceReference: reference(passages[index]) });
  return { source, fragments, candidate, reference };
}

test("incomplete calendar candidates preserve original passages without guessing instants", () => {
  const passages = [
    "Работы — 120 календарных дней с даты\nподписания договора.",
    "Уборка в течение 5 дней после завершения работ.",
    "Гарантийный срок — 18 месяцев.",
    "Срок поставки: январь 2026 года.",
    "Заявки до 2026-11-01 10:00.",
    "Поставка до 2026-11-02.",
    "Заявки до 2026-02-30 10:00 Z.",
    "Заявки до 2026-11-01 25:00 +05:00.",
    "Заявки до 2026-11-01 10:00 +15:00.",
    "120 дней после подписания договора 2026-01-01.",
  ];
  const { source, fragments, candidate } = fixture(passages);
  const candidates = passages.map((_, index) => candidate(index));
  const result = resolveCalendarCandidates(candidates, fragments, source);
  assert.deepEqual(result.deadlines, []);
  assert.deepEqual(result.unresolvedDeadlines, passages.map((tenderEvidence, index) => ({
    tenderEvidence, reason: "ambiguous", sourceReference: candidates[index].sourceReference,
  })));
});

test("mixed exact and relative candidates retain input order and matching references in both categories", () => {
  const passages = [
    "Срок выполнения — 120 дней с даты договора.",
    "Заявка до 2026-11-01 10:00 +05:00.",
    "Гарантия — 18 месяцев с даты приёмки.",
    "Оплата до 2026-11-02 12:30 Z.",
  ];
  const { source, fragments, candidate } = fixture(passages);
  const candidates = [candidate(3), candidate(2), candidate(1), candidate(0)];
  const result = resolveCalendarCandidates(candidates, fragments, source);
  assert.deepEqual(result.deadlines, [
    { ...candidate(3), tenderEvidence: passages[3], date: "2026-11-02T12:30:00.000Z" },
    { ...candidate(1), tenderEvidence: passages[1], date: "2026-11-01T05:00:00.000Z" },
  ]);
  assert.deepEqual(result.unresolvedDeadlines, [2, 0].map(index => ({
    tenderEvidence: passages[index], reason: "ambiguous", sourceReference: candidate(index).sourceReference,
  })));
});

test("a repeated representation of the same instant is unambiguous", () => {
  const passage = "Подача до 2026-11-01 10:00 +05:00, то есть 2026-11-01 05:00 Z.";
  const { source, fragments, candidate } = fixture([passage]);
  const result = resolveCalendarCandidates([candidate(0)], fragments, source);
  assert.equal(result.deadlines[0].date, "2026-11-01T05:00:00.000Z");
  assert.equal(result.deadlines[0].tenderEvidence, passage);
  assert.deepEqual(result.unresolvedDeadlines, []);
});

test("a reference spanning multiple distinct instants still requires bounded calendar recovery", () => {
  const { source, fragments, candidate } = fixture([
    "Подача до 2026-11-01 10:00 +05:00; оплата до 2026-11-02 12:30 Z.",
  ]);
  assert.throws(() => resolveCalendarCandidates([candidate(0)], fragments, source),
    { message: "Deadline evidence must contain exactly one explicit instant" });
});

test("every source reference is validated before any calendar ambiguity can trigger recovery", () => {
  const { source, fragments, candidate } = fixture([
    "Подача до 2026-11-01 10:00 +05:00; оплата до 2026-11-02 12:30 Z.",
    "Работы выполняются в течение 120 дней.",
  ]);
  const unknownReference = { title: "Срок", sourceReference: { startFragment: 999, endFragment: 999 } };
  for (const first of [candidate(0), candidate(1)]) {
    assert.throws(() => resolveCalendarCandidates([first, unknownReference], fragments, source),
      { message: "Invalid tender source reference" });
  }
});

test("invalid references, model-authored quotes and extra calculated dates remain rejected", () => {
  const { source, fragments, candidate } = fixture(["Работы — 120 дней с даты\nдоговора."]);
  for (const sourceReference of [
    { startFragment: 0, endFragment: 1 },
    { startFragment: 1.5, endFragment: 2 },
    { startFragment: 2, endFragment: 1 },
    { startFragment: 1, endFragment: 999 },
    { startFragment: "1", endFragment: 2 },
    { startFragment: 1, endFragment: 2, tenderEvidence: "выдуманная цитата" },
  ]) assert.throws(() => resolveCalendarCandidates([{ title: "Срок", sourceReference }], fragments, source));
  for (const extra of [{ tenderEvidence: source }, { date: "2026-11-01T05:00:00Z" }]) {
    assert.throws(() => resolveCalendarCandidates([{ ...candidate(0), ...extra }], fragments, source));
  }
  assert.throws(() => resolveCalendarCandidates([candidate(0)], fragments, "Подменённый документ."), /Invalid tender source reference/);
});

test("candidate and source-span limits are retained including the permitted boundaries", () => {
  const { source, fragments, candidate } = fixture(["Работы — 120 дней."]);
  assert.equal(resolveCalendarCandidates(Array.from({ length: 30 }, () => candidate(0)), fragments, source).unresolvedDeadlines.length, 30);
  assert.throws(() => resolveCalendarCandidates(Array.from({ length: 31 }, () => candidate(0)), fragments, source));
  assert.deepEqual(resolveCalendarCandidates([], fragments, source), { deadlines: [], unresolvedDeadlines: [] });
  for (const size of [2000, 2001]) {
    const long = "а".repeat(size);
    const longFixture = fixture([long]);
    const run = () => resolveCalendarCandidates([longFixture.candidate(0)], longFixture.fragments, long);
    if (size === 2000) assert.equal(run().unresolvedDeadlines[0].tenderEvidence, long);
    else assert.throws(run, /Invalid tender source reference/);
  }
});

test("duplicate validation still spans the complete exact set with relative candidates between", () => {
  const { source, fragments, candidate } = fixture([
    "Подача до 2026-11-01 10:00 +05:00.",
    "Работы — 120 дней после подписания договора.",
    "Подача до 2026-11-01 05:00 Z.",
  ]);
  assert.throws(() => resolveCalendarCandidates([
    candidate(0, "ЗАЯВКА"), candidate(1), candidate(2, "заявка"),
  ], fragments, source), /Duplicate deadline/);
  const result = resolveCalendarCandidates([
    candidate(0, "Заявка"), candidate(1), candidate(2, "Другой срок"),
  ], fragments, source);
  assert.equal(result.deadlines.length, 2);
  assert.equal(result.unresolvedDeadlines.length, 1);
});
