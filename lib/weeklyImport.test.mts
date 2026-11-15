import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildWeeklyPrompt,
  getWeeklyWindow,
  importKey,
  MAX_ARRAY_ITEMS,
  MAX_EXCERPT_CHARS,
  MAX_EXCERPT_TOTAL_CHARS,
  MAX_EXCERPTS,
  MAX_IMPORT_BYTES,
  MAX_JSON_DEPTH,
  MAX_TEXT_CHARS,
  parseWeeklyImport,
} from "./weeklyImport.ts";
import type { DraftTopic, WeeklyImportResult } from "./weeklyImport.ts";

const window = {
  start: "2026-11-09",
  end: "2026-11-15",
  label: "Nov 9, 2026 – Nov 15, 2026",
};
const topic = {
  title: "Wheel-thrown mugs",
  summary: "I want to make my own coffee mug on the wheel.",
  tags: ["wheel throwing"],
  date: null,
};
const fixture =
  '{"topics":[{"title":"Wheel-thrown mugs","summary":"I want to make my own coffee mug on the wheel.","tags":["wheel throwing"],"date"}]}';
function recap(text: string) {
  const result = parseWeeklyImport(text, window);
  assert.equal(result.kind, "recap");
  if (result.kind !== "recap") throw new Error("Expected recap");
  return result.topics;
}
function context(result: WeeklyImportResult) {
  assert.equal(result.kind, "context");
  if (result.kind !== "context") throw new Error("Expected context");
  return result;
}

test("the exact synthetic fixture is repaired, but never preconfirmed", () => {
  assert.deepEqual(recap(fixture), [{ ...topic, confirmedThisWeek: false }]);
  assert.deepEqual(recap(`\`\`\`json\n${fixture}\n\`\`\``), [
    { ...topic, confirmedThisWeek: false },
  ]);
});

test("prompt prefixes and complete body match the request with a valid null example", () => {
  const body =
    'Between 2026-11-09 and 2026-11-15, what did I say I was doing, making, wondering about or hoping to try? Draft up to five topics I might enjoy sharing with friends. Distinguish curiosity, a plan and something I actually did. Give each a short title, one specific first-person sentence and one to three everyday tags. Paraphrase. Omit sensitive details, confidential work, precise locations and identifying information about others. Use only context you can access. Return a JSON object shaped like {"topics":[{"title":"…","summary":"…","tags":["…"],"date":null}]}. Use YYYY-MM-DD for a known date and null when uncertain. If nothing qualifies, return {"topics":[]}.';
  assert.equal(
    buildWeeklyPrompt("chatgpt", window),
    `Use the saved memories and recent chat context you can access in ChatGPT.\n\n${body}`,
  );
  assert.equal(
    buildWeeklyPrompt("claude", window),
    `Use the memory and conversations you can access in Claude, including this project if relevant.\n\n${body}`,
  );
});

test("JSON and fenced JSON accept only in-week valid local calendar dates", () => {
  const values = ["2026-11-08", "2026-11-09", "2026-11-15", "2026-11-16", null];
  const input = JSON.stringify({
    topics: values.map((date) => ({ ...topic, date, confirmedThisWeek: true })),
  });
  const parsed = recap(`Here is your recap:\n\`\`\`json\n${input}\n\`\`\``);
  assert.deepEqual(
    parsed.map((item) => [item.date, item.confirmedThisWeek]),
    [
      ["2026-11-09", true],
      ["2026-11-15", true],
      [null, false],
    ],
  );
  assert.equal(
    recap(JSON.stringify({ topics: [{ ...topic, date: undefined }] }))[0]
      .confirmedThisWeek,
    false,
  );
  for (const date of [
    "2026-02-30",
    "2026-2-05",
    "2026-11-09T00:00:00Z",
    "0000-01-01",
    123,
    false,
  ]) {
    assert.throws(
      () => recap(JSON.stringify({ topics: [{ ...topic, date }] })),
      /Topic dates/,
    );
  }
  assert.equal(parseWeeklyImport('{"topics":[]}', window).kind, "empty");
  assert.equal(
    parseWeeklyImport(
      JSON.stringify({ topics: [{ ...topic, date: "2025-11-09" }] }),
      window,
    ).kind,
    "empty",
  );
});

test("the repair is limited to recap date properties, not general JSON recovery", () => {
  for (const text of [
    '{"date"}',
    '{"other":{"date"}}',
    '{"topics":[{"title"}]}',
    '{"topics":[{"title":"Mugs","summary":"I try pottery","tags":["pottery"],"date",}]}',
    fixture.replace('"topics":', '"other":'),
    fixture.replace('"date"}', '"date","extra":1}'),
    fixture.replace('"tags":["wheel throwing"]', '"tags":["wheel throwing",]'),
    fixture.replace('"date"}', '"date"}').replace("]}", '],"extra":true}'),
    '{"topics":[]',
    '{"topics":NaN}',
    "{bad json}",
    "[}",
  ])
    assert.throws(() => parseWeeklyImport(text, window), /JSON/);
  const quoted = {
    ...topic,
    summary: 'I wrote the words "date" without changing the JSON.',
  };
  assert.equal(
    recap(JSON.stringify({ topics: [quoted] }))[0].summary,
    quoted.summary,
  );
});

test("topic fields and counts are bounded and untrusted confirmations are ignored", () => {
  for (const invalid of [
    { ...topic, title: "x".repeat(81) },
    { ...topic, summary: "x".repeat(501) },
    { ...topic, tags: [] },
    { ...topic, tags: ["x".repeat(41)] },
    { ...topic, tags: ["a", "b", "c", "d"] },
    { ...topic, title: " " },
    { ...topic, summary: {} },
    { ...topic, tags: [null] },
  ])
    assert.throws(() => recap(JSON.stringify({ topics: [invalid] })));
  assert.throws(
    () =>
      recap(JSON.stringify({ topics: Array.from({ length: 6 }, () => topic) })),
    /five/,
  );
  assert.throws(() => recap('{"topics":{}}'), /topics array/);
  assert.equal(
    recap(
      JSON.stringify({ topics: [{ ...topic, confirmedThisWeek: true }] }),
    )[0].confirmedThisWeek,
    false,
  );
});

test("byte, depth, array and text limits fail safely without source text in errors", () => {
  assert.throws(
    () => parseWeeklyImport("x".repeat(MAX_IMPORT_BYTES + 1), window),
    /too large/,
  );
  assert.throws(
    () => parseWeeklyImport("🍊".repeat(MAX_IMPORT_BYTES / 4 + 1), window),
    /too large/,
  );
  assert.throws(
    () => parseWeeklyImport("é".repeat(MAX_IMPORT_BYTES / 2 + 1), window),
    /too large/,
  );
  const nested =
    "[".repeat(MAX_JSON_DEPTH + 1) + "0" + "]".repeat(MAX_JSON_DEPTH + 1);
  assert.throws(() => parseWeeklyImport(nested, window), /deeply/);
  assert.throws(
    () =>
      parseWeeklyImport(
        JSON.stringify(Array(MAX_ARRAY_ITEMS + 1).fill(0)),
        window,
      ),
    /array entries/,
  );
  assert.throws(
    () =>
      parseWeeklyImport(
        JSON.stringify({ memories: ["x".repeat(MAX_TEXT_CHARS + 1)] }),
        window,
      ),
    /too long/,
  );
  assert.throws(
    () => parseWeeklyImport("x".repeat(MAX_TEXT_CHARS + 1), window),
    /too long/,
  );
  assert.throws(
    () => parseWeeklyImport('{"private-secret":', window),
    (error: unknown) =>
      error instanceof Error && !error.message.includes("private-secret"),
  );
});

test("Markdown and plain structured recaps preserve first-person text and tags", () => {
  const markdown =
    "# Weekly recap\n## Wheel-thrown mugs\nI want to make my own coffee mug on the wheel.\n**Tags:** wheel throwing\n**Date:** unknown";
  assert.deepEqual(recap(markdown), [{ ...topic, confirmedThisWeek: false }]);
  const plain =
    "Title: Wheel-thrown mugs\nSummary: I want to make my own coffee mug on the wheel.\nTags: wheel throwing\nDate: null";
  assert.deepEqual(recap(plain), [{ ...topic, confirmedThisWeek: false }]);
  assert.deepEqual(
    recap(`1. **Wheel-thrown mugs**\n${topic.summary}\nTags: wheel throwing`),
    [{ ...topic, confirmedThisWeek: false }],
  );
  const prose = context(
    parseWeeklyImport(
      "I want to make a mug, and I am curious about ceramics.",
      window,
    ),
  );
  assert.equal(prose.source, "text");
  assert.equal(prose.requiresSelection, true);
  assert.equal(prose.excerpts[0].date, null);
  assert.equal(
    context(parseWeeklyImport("# A relevant chat\nI made a mug.", window))
      .source,
    "text",
  );
});

function chatgpt() {
  const message = (role: string, create_time: unknown, text: string) => ({
    message: {
      author: { role },
      create_time,
      content: { content_type: "text", parts: [text] },
    },
  });
  return {
    title: "A conversation title is not user context",
    mapping: {
      root: { message: null },
      user: message(
        "user",
        "2026-11-10T12:00:00-08:00",
        "I want to make a mug.",
      ),
      assistant: message(
        "assistant",
        "2026-11-10T12:00:01-08:00",
        "Private assistant text must not appear.",
      ),
      system: message(
        "system",
        "2026-11-10T12:00:00-08:00",
        "System text must not appear.",
      ),
      old: message(
        "user",
        "2026-10-10T12:00:00-07:00",
        "Old user text must not appear.",
      ),
      undated: message("user", null, "Undated chat must not appear."),
      invalid: message(
        "user",
        "2026-02-30T12:00:00Z",
        "Invalid date must not appear.",
      ),
    },
  };
}

test("full ChatGPT mappings extract only dated user content, by structure", () => {
  for (const value of [
    chatgpt(),
    [chatgpt()],
    { conversations: [chatgpt()] },
    { "conversations.json": [chatgpt()] },
    { data: [chatgpt()] },
  ]) {
    const parsed = context(
      parseWeeklyImport(JSON.stringify(value), window, "conversations.json"),
    );
    assert.equal(parsed.source, "chatgpt");
    assert.equal(parsed.requiresSelection, true);
    assert.deepEqual(
      parsed.excerpts.map(({ text, date }) => ({ text, date })),
      [{ text: "I want to make a mug.", date: "2026-11-10" }],
    );
  }
});

test("full Claude chat_messages extract human text and text blocks only", () => {
  const value = [
    {
      uuid: "conversation",
      chat_messages: [
        {
          sender: "human",
          created_at: "2026-11-11T12:00:00-08:00",
          text: "I am looking for a pottery class.",
        },
        {
          sender: "human",
          created_at: "2026-11-12",
          content: [
            { type: "text", text: "I made a cup." },
            { type: "image", text: "not text" },
          ],
        },
        {
          sender: "assistant",
          created_at: "2026-11-12",
          text: "Assistant context",
        },
        { sender: "human", text: "Undated context" },
        { sender: "human", created_at: "2026-11-08", text: "Old context" },
      ],
    },
  ];
  const parsed = context(parseWeeklyImport(JSON.stringify(value), window));
  assert.equal(parsed.source, "claude");
  assert.deepEqual(
    parsed.excerpts.map((item) => item.text),
    ["I am looking for a pottery class.", "I made a cup."],
  );
  assert.equal(parsed.requiresSelection, true);
});

test("Claude memory structures, project memories and memories.json need explicit selection", () => {
  for (const value of [
    {
      conversations_memory: "I enjoy pottery.",
      project_memories: [{ memory: "I am making a mug." }],
    },
    [
      {
        account_uuid: "not imported",
        conversations_memory: "I enjoy pottery.",
        project_memories: { "project-uuid": "I am making a mug." },
      },
    ],
    {
      memories: [
        { text: "I enjoy pottery." },
        { content: "I am making a mug." },
      ],
    },
    {
      memory_files: [
        { path: "not imported", content: "I enjoy pottery." },
        { content: "I am making a mug." },
      ],
    },
    { "memories.json": ["I enjoy pottery.", { memory: "I am making a mug." }] },
  ]) {
    const parsed = context(parseWeeklyImport(JSON.stringify(value), window));
    assert.equal(parsed.source, "memory");
    assert.equal(parsed.requiresSelection, true);
    assert.deepEqual(
      parsed.excerpts.map(({ text, date }) => ({ text, date })),
      [
        { text: "I enjoy pottery.", date: null },
        { text: "I am making a mug.", date: null },
      ],
    );
  }
  assert.equal(
    context(parseWeeklyImport('["I enjoy pottery."]', window, "memories.json"))
      .source,
    "memory",
  );
  const dated = context(
    parseWeeklyImport(
      JSON.stringify({
        memories: [
          { text: "Current", date: "2026-11-15" },
          { text: "Old", date: "2026-11-08" },
          { text: "Assistant", role: "assistant" },
          { text: "Undated" },
        ],
      }),
      window,
    ),
  );
  assert.deepEqual(
    dated.excerpts.map((item) => item.text),
    ["Current", "Undated"],
  );
});

test("context is bounded and duplicate excerpts are not repeated", () => {
  const memories = Array.from(
    { length: 100 },
    (_, i) => `${i} ${"x".repeat(2_000)}`,
  );
  const parsed = context(
    parseWeeklyImport(JSON.stringify({ memories }), window),
  );
  assert.ok(parsed.excerpts.length <= MAX_EXCERPTS);
  assert.ok(
    parsed.excerpts.every((item) => item.text.length <= MAX_EXCERPT_CHARS),
  );
  assert.ok(
    parsed.excerpts.reduce((sum, item) => sum + item.text.length, 0) <=
      MAX_EXCERPT_TOTAL_CHARS,
  );
  assert.equal(
    context(parseWeeklyImport('{"memories":["Same","Same"]}', window)).excerpts
      .length,
    1,
  );
  const many = context(
    parseWeeklyImport(
      JSON.stringify({
        memories: Array.from({ length: 100 }, (_, i) => String(i)),
      }),
      window,
    ),
  );
  assert.equal(many.excerpts.length, MAX_EXCERPTS);
});

test("empty, unknown, old-only and ZIP sources provide a one-chat or Files fallback", () => {
  for (const text of [
    "",
    " ",
    "{}",
    "[]",
    '{"mapping":{}}',
    '{"chat_messages":[]}',
    '{"memories":[]}',
  ]) {
    assert.equal(parseWeeklyImport(text, window).kind, "empty");
  }
  const zip = parseWeeklyImport("PK\u0003\u0004", window, "export.zip");
  assert.equal(zip.kind, "empty");
  if (zip.kind === "empty") assert.match(zip.reason, /Extract.*Files/);
  assert.throws(
    () => parseWeeklyImport("not JSON", window, "conversations.json"),
    /JSON/,
  );
});

test("stable import keys ignore confirmation, tag order and harmless spacing", () => {
  const draft: DraftTopic = { ...topic, confirmedThisWeek: false };
  const first = importKey(draft, window, "chatgpt");
  assert.equal(
    first,
    importKey(
      { ...draft },
      { ...window, label: "A different display label" },
      "chatgpt",
    ),
  );
  assert.equal(
    first,
    importKey({ ...draft, confirmedThisWeek: true }, window, "chatgpt"),
  );
  assert.equal(
    first,
    importKey({ ...draft, title: "  WHEEL-THROWN   MUGS " }, window, "chatgpt"),
  );
  assert.equal(
    importKey({ ...draft, tags: ["pottery", "mugs"] }, window, "chatgpt"),
    importKey(
      { ...draft, tags: ["mugs", "pottery", "pottery"] },
      window,
      "chatgpt",
    ),
  );
  assert.notEqual(first, importKey(draft, window, "claude"));
  assert.notEqual(
    first,
    importKey({ ...draft, summary: "I made a mug." }, window, "chatgpt"),
  );
  assert.notEqual(
    first,
    importKey({ ...draft, date: "2026-11-10" }, window, "chatgpt"),
  );
  assert.notEqual(
    first,
    importKey(
      draft,
      { ...window, start: "2026-11-10", end: "2026-11-16" },
      "chatgpt",
    ),
  );
  assert.equal(
    importKey(recap(fixture)[0], window, "chatgpt"),
    importKey(recap(fixture)[0], window, "chatgpt"),
  );
  assert.ok(!first.includes("mugs"));
});

test("local dates and seven-day arithmetic remain correct across Los Angeles DST", () => {
  const script = `
    import assert from 'node:assert/strict';
    import { getWeeklyWindow, parseWeeklyImport } from './lib/weeklyImport.ts';
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Los_Angeles');
    assert.deepEqual([getWeeklyWindow(new Date('2026-03-09T06:59:59Z')).start,getWeeklyWindow(new Date('2026-03-09T06:59:59Z')).end],['2026-03-02','2026-03-08']);
    assert.deepEqual([getWeeklyWindow(new Date('2026-11-02T07:59:59Z')).start,getWeeklyWindow(new Date('2026-11-02T07:59:59Z')).end],['2026-10-26','2026-11-01']);
    const window = getWeeklyWindow(new Date('2026-11-16T07:30:00Z'));
    assert.equal(window.end,'2026-11-15');
    const messages = ['2026-11-09T07:59:59Z','2026-11-09T08:00:00Z','2026-11-16T07:59:59Z','2026-11-16T08:00:00Z'].map((created_at,i)=>({sender:'human',created_at,text:String(i)}));
    const result=parseWeeklyImport(JSON.stringify({chat_messages:messages}),window);
    assert.equal(result.kind,'context');
    assert.deepEqual(result.excerpts.map(x=>[x.text,x.date]),[['1','2026-11-09'],['2','2026-11-15']]);
    const epoch = new Date('2026-11-09T08:00:00Z').getTime();
    const mapping = Object.fromEntries([epoch / 1000,epoch].map((create_time,i)=>[String(i),{message:{author:{role:'user'},create_time,content:{parts:[String(i)]}}}]));
    const chat = parseWeeklyImport(JSON.stringify({mapping}),window);
    assert.equal(chat.kind,'context');
    assert.deepEqual(chat.excerpts.map(x=>x.date),['2026-11-09','2026-11-09']);
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: process.cwd(),
      env: { ...process.env, TZ: "America/Los_Angeles" },
      encoding: "utf8",
    },
  );
  assert.equal(child.status, 0, child.stderr);
});

test("invalid date windows fail instead of silently changing scope", () => {
  assert.throws(
    () => getWeeklyWindow(new Date("invalid")),
    /valid current date/,
  );
  assert.throws(
    () => parseWeeklyImport(fixture, { ...window, start: "2026-11-08" }),
    /seven-day/,
  );
  assert.throws(
    () => buildWeeklyPrompt("chatgpt", { ...window, end: "2026-02-30" }),
    /valid weekly/,
  );
  const now = new Date();
  assert.equal(
    getWeeklyWindow(now).end,
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  );
});
