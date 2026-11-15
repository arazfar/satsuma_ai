import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reviewedTopicFields } from "./reviewedTopic.ts";
import {
  parseWeeklyImport,
  checkImportSize,
  MAX_IMPORT_BYTES,
} from "./weeklyImport.ts";

const window = { start: "2026-11-09", end: "2026-11-15", label: "Nov 9 – 15" };
const fixture =
  '{"topics":[{"title":"Wheel-thrown mugs","summary":"I want to make my own coffee mug on the wheel.","tags":["wheel throwing"],"date"}]}';

test("the real save payload refuses the exact fixture until explicit week confirmation", () => {
  const parsed = parseWeeklyImport(fixture, window);
  assert.equal(parsed.kind, "recap");
  if (parsed.kind !== "recap") throw new Error("Expected recap");
  const topic = parsed.topics[0];
  assert.throws(() => reviewedTopicFields(topic, window, "friends"), /Confirm/);
  assert.throws(() => reviewedTopicFields(topic, window, "private"), /Confirm/);
  const fields = reviewedTopicFields(
    { ...topic, confirmedThisWeek: true },
    window,
    "friends",
  );
  assert.deepEqual(fields, {
    title: topic.title,
    summary: topic.summary,
    tags: ["wheel throwing"],
    date: null,
    weekStart: window.start,
    weekEnd: window.end,
    audience: "friends",
  });
  assert.equal("confirmedThisWeek" in fields, false);
  assert.equal("owner" in fields, false);
});

test("reviewed fields preserve privacy choice and reject malformed edits", () => {
  const topic = {
    title: "  New mugs ",
    summary: " I want to make a mug. ",
    tags: [" ceramics "],
    date: null,
    confirmedThisWeek: true,
  };
  assert.equal(
    reviewedTopicFields(topic, window, "private").audience,
    "private",
  );
  assert.deepEqual(reviewedTopicFields(topic, window, "private").tags, [
    "ceramics",
  ]);
  for (const changed of [
    { title: "" },
    { summary: "x".repeat(501) },
    { tags: [] },
    { tags: ["a", "b", "c", "d"] },
    { tags: [""] },
  ])
    assert.throws(() =>
      reviewedTopicFields({ ...topic, ...changed }, window, "private"),
    );
});

test("clipboard reads occur only in the explicit paste handler, never on mount or review", () => {
  const source = readFileSync(
    new URL("../components/WeeklyImport.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/Clipboard\.getStringAsync\(/g) ?? []).length, 1);
  const paste = source.slice(
    source.indexOf("async function paste()"),
    source.indexOf("async function chooseFile()"),
  );
  assert.match(paste, /await Clipboard\.getStringAsync\(\)/);
  assert.match(paste, /checkImportSize\(text\)/);
  assert.match(source, /onPress=\{\(\) => void paste\(\)\}/);
  assert.doesNotMatch(
    source,
    /useEffect|useLayoutEffect|AppState|Clipboard\.getImage/,
  );
  assert.doesNotMatch(
    readFileSync(new URL("./weeklyImport.ts", import.meta.url), "utf8"),
    /console\.|fetch\(|analytics|convex|Clipboard/,
  );
});

test("native file size is checked before decoding and raw source is discarded after review", () => {
  const source = readFileSync(
    new URL("../components/WeeklyImport.tsx", import.meta.url),
    "utf8",
  );
  const chooseFile = source.slice(
    source.indexOf("async function chooseFile()"),
    source.indexOf("function change("),
  );
  assert.ok(
    chooseFile.indexOf("size > MAX_IMPORT_BYTES") <
      chooseFile.indexOf("file.text()"),
  );
  assert.match(chooseFile, /file\?\.delete\(\)/);
  assert.match(source, /setExcerpts\(\[\]\)/);
  assert.match(source, /setInput\(""\)/);
  assert.match(source, /share: false/);
  assert.throws(
    () => checkImportSize("x".repeat(MAX_IMPORT_BYTES + 1)),
    /too large/,
  );
  assert.throws(
    () => checkImportSize("🧡".repeat(MAX_IMPORT_BYTES / 4 + 1)),
    /too large/,
  );
});
