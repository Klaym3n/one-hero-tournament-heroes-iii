import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it.each([
    ["/konto/zapis", "/konto/zapis"],
    ["/mecze/abc?x=1#y", "/mecze/abc?x=1#y"],
    ["/a/../konto", "/konto"],
  ])("przepuszcza ścieżkę %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "", null, undefined, "javascript:alert(1)"])(
    "odrzuca %s",
    (input) => {
      expect(safeNext(input as string)).toBe("/konto");
    },
  );
});
