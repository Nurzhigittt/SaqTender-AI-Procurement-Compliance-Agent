import assert from "node:assert/strict";
import test from "node:test";
import { resolveFindingQuote } from "../lib/source-evidence";

// Hand-authored string-grounding regressions, not saved model responses or
// evidence of extraction accuracy. Only whitespace can differ from the source.
test("an already exact quote is preserved even when the source repeats it", () => {
  const quote = "Опыт\nНЕ требуется.";
  assert.equal(resolveFindingQuote(quote, `${quote}\nДругой раздел.\n${quote}`), quote);
});

test("Russian line breaks are restored while preserving the explicit negation", () => {
  const original = "Квалификационное требование в части наличия опыта работы\nНЕ\nпредъявляется.";
  const quote = "Квалификационное требование в части наличия опыта работы НЕ предъявляется.";
  assert.equal(resolveFindingQuote(quote, original), original);
  assert.ok(resolveFindingQuote(quote, original).includes("НЕ\nпредъявляется"));
});

test("tabs, repeated spaces, CRLF and nonbreaking spaces restore the original characters", () => {
  const original = "Срок:\t120\u00a0календарных  дней\r\nсо дня подписания договора.";
  const quote = "Срок: 120 календарных дней со дня подписания договора.";
  assert.equal(resolveFindingQuote(quote, original), original);
});

test("whitespace differences in the supplied quote can also collapse to source spaces", () => {
  const original = "Гарантия не менее 18 месяцев со дня приемки.";
  const quote = "Гарантия\nне менее\t18\u00a0месяцев\nсо дня приемки.";
  assert.equal(resolveFindingQuote(quote, original), original);
});

test("a unique normalized match returns only the exact original source span", () => {
  const original = "Уборка\nстроительного мусора в течение\t5 дней.";
  const source = `📄 Начало раздела.\n\n${original}\n\nСледующий раздел.`;
  const restored = resolveFindingQuote("Уборка строительного мусора в течение 5 дней.", source);
  assert.equal(restored, original);
  assert.ok(source.includes(restored));
});

test("multiple normalized matches reject ambiguous recovery", () => {
  const source = "Опыт\tне требуется.\nДругой раздел.\nОпыт\nне требуется.";
  assert.throws(() => resolveFindingQuote("Опыт не требуется.", source), /Ungrounded finding evidence/);
  assert.throws(() => resolveFindingQuote("A\nA", "A A A"), /Ungrounded finding evidence/, "Overlapping normalized matches are also ambiguous");
});

test("recovery never changes negation, numbers, punctuation, case or letters", () => {
  const source = "Опыт\nНЕ требуется; срок — 120 дней.";
  for (const quote of [
    "Опыт требуется; срок — 120 дней.",
    "Опыт НЕ требуется; срок — 90 дней.",
    "Опыт НЕ требуется, срок — 120 дней.",
    "Опыт не требуется; срок — 120 дней.",
    "Oпыт НЕ требуется; срок — 120 дней.", // Latin O is not Cyrillic О.
  ]) {
    assert.throws(() => resolveFindingQuote(quote, source), /Ungrounded finding evidence/);
  }
});

test("empty, whitespace-only and absent quotes remain invalid", () => {
  for (const quote of ["", " \n\t\u00a0", "Не существующее в источнике требование."]) {
    assert.throws(() => resolveFindingQuote(quote, "Условие\nтендера."), /Ungrounded finding evidence/);
  }
});

test("recovery does not remove word boundaries or join split digits", () => {
  for (const [quote, source] of [
    ["Требование предъявляется.", "Требование предъ\nявляется."],
    ["Срок 120 дней.", "Срок 12\n0 дней."],
  ]) {
    assert.throws(() => resolveFindingQuote(quote, source), /Ungrounded finding evidence/);
  }
});

test("restoration exceeding 2000 characters rejects even when the supplied quote is short", () => {
  const source = `Срок${" ".repeat(2000)}120 дней.`;
  assert.ok(source.length > 2000);
  assert.throws(() => resolveFindingQuote("Срок 120 дней.", source), /Ungrounded finding evidence/);
});

test("a uniquely restored quote at the 2000-character boundary remains valid", () => {
  const suffix = "120 дней.";
  const original = `Срок${" ".repeat(2000 - "Срок".length - suffix.length)}${suffix}`;
  assert.equal(original.length, 2000);
  assert.equal(resolveFindingQuote("Срок 120 дней.", original), original);
});
