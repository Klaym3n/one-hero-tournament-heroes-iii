import { describe, expect, it } from "vitest";
import { codeToIndex, indexToCode, indexToMwd, mwdToIndex, parseMwdCode } from "./mwd";

describe("MWD", () => {
  it.each([
    [111, 1],
    [117, 7],
    [121, 8],
    [127, 14],
    [147, 28],
    [211, 29],
    [342, 79],
  ])("kod %i ↔ indeks %i", (code, index) => {
    expect(codeToIndex(code)).toBe(index);
    expect(indexToCode(index)).toBe(code);
  });

  it.each([118, 151, 101, 110, 50, 0, 1011.5])("odrzuca kod %s", (code) => {
    expect(parseMwdCode(code)).toBeNull();
  });

  it("obsługuje miesiące dwucyfrowe", () => {
    expect(mwdToIndex({ month: 10, week: 1, day: 1 })).toBe(9 * 28 + 1);
    expect(indexToMwd(9 * 28 + 1)).toEqual({ month: 10, week: 1, day: 1 });
  });

  it("round-trip dla wszystkich dni do 12 miesiąca", () => {
    for (let i = 1; i <= 12 * 28; i++) expect(mwdToIndex(indexToMwd(i))).toBe(i);
  });
});
