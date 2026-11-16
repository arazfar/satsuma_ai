import { describe, expect, it } from "vitest";
import { validateImportUtf8 } from "./importEncoding";

describe("selected-file UTF-8 validation", () => {
  it("accepts real Unicode, including a literal replacement character, like pasted input", () => {
    for (const text of [
      '{"title":"A mug � 🧡"}',
      "café",
      "日本語",
      "\uFEFF# A recap",
    ])
      expect(() =>
        validateImportUtf8(new TextEncoder().encode(text)),
      ).not.toThrow();
  });

  it.each([
    [0],
    [0xff],
    [0xc0, 0x80],
    [0xc2],
    [0xe0, 0x80, 0x80],
    [0xed, 0xa0, 0x80],
    [0xf0, 0x80, 0x80, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xf5, 0x80, 0x80, 0x80],
    [0xe2, 0x28, 0xa1],
  ])("refuses malformed or binary bytes %j", (...bytes) => {
    expect(() => validateImportUtf8(new Uint8Array(bytes))).toThrow("UTF-8");
  });
});
