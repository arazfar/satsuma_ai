export function validateImportUtf8(bytes: Uint8Array) {
  for (let i = 0; i < bytes.length; i++) {
    const first = bytes[i];
    if (first === 0)
      throw new Error("Choose a UTF-8 text file, not a binary file.");
    if (first < 0x80) continue;
    const extra =
      first >= 0xc2 && first <= 0xdf
        ? 1
        : first >= 0xe0 && first <= 0xef
          ? 2
          : first >= 0xf0 && first <= 0xf4
            ? 3
            : -1;
    if (extra < 0 || i + extra >= bytes.length)
      throw new Error("Choose a valid UTF-8 JSON, text or Markdown file.");
    const second = bytes[i + 1];
    if (
      (first === 0xe0 && second < 0xa0) ||
      (first === 0xed && second > 0x9f) ||
      (first === 0xf0 && second < 0x90) ||
      (first === 0xf4 && second > 0x8f)
    )
      throw new Error("Choose a valid UTF-8 JSON, text or Markdown file.");
    for (let offset = 1; offset <= extra; offset++) {
      const next = bytes[i + offset];
      if (next < 0x80 || next > 0xbf)
        throw new Error("Choose a valid UTF-8 JSON, text or Markdown file.");
    }
    i += extra;
  }
}
