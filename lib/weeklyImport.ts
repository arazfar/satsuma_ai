export type WeeklyWindow = { start: string; end: string; label: string };
export type DraftTopic = {
  title: string;
  summary: string;
  tags: string[];
  date: string | null;
  confirmedThisWeek: boolean;
};
export type ContextExcerpt = { id: string; text: string; date: string | null };
export type WeeklyImportResult =
  | { kind: "recap"; topics: DraftTopic[] }
  | {
      kind: "context";
      source: "chatgpt" | "claude" | "memory" | "text";
      excerpts: ContextExcerpt[];
      requiresSelection: true;
    }
  | { kind: "empty"; reason: string };

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_JSON_DEPTH = 24;
export const MAX_ARRAY_ITEMS = 10_000;
export const MAX_TEXT_CHARS = 100_000;
export const MAX_TOPICS = 5;
export const MAX_EXCERPTS = 20;
export const MAX_EXCERPT_CHARS = 1_200;
export const MAX_EXCERPT_TOTAL_CHARS = 12_000;

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function localDate(value: Date): string {
  return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return year >= 1 && localDate(date) === value;
}

function checkWindow(window: WeeklyWindow): void {
  if (
    !isCalendarDate(window.start) ||
    !isCalendarDate(window.end) ||
    window.start > window.end
  ) {
    throw new Error("Choose a valid weekly date window.");
  }
  const end = new Date(`${window.end}T12:00:00`);
  end.setDate(end.getDate() - 6);
  if (localDate(end) !== window.start)
    throw new Error("Choose a seven-day date window.");
}

export function getWeeklyWindow(now: Date = new Date()): WeeklyWindow {
  if (
    !Number.isFinite(now.getTime()) ||
    now.getFullYear() < 1 ||
    now.getFullYear() > 9999
  ) {
    throw new Error("Choose a valid current date.");
  }
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const format = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return {
    start: localDate(start),
    end: localDate(end),
    label: `${format(start)} – ${format(end)}`,
  };
}

export function buildWeeklyPrompt(
  service: "chatgpt" | "claude",
  window: WeeklyWindow,
): string {
  checkWindow(window);
  const prefix =
    service === "chatgpt"
      ? "Use the saved memories and recent chat context you can access in ChatGPT."
      : "Use the memory and conversations you can access in Claude, including this project if relevant.";
  return `${prefix}\n\nBetween ${window.start} and ${window.end}, what did I say I was doing, making, wondering about or hoping to try? Draft up to five topics I might enjoy sharing with friends. Distinguish curiosity, a plan and something I actually did. Give each a short title, one specific first-person sentence and one to three everyday tags. Paraphrase. Omit sensitive details, confidential work, precise locations and identifying information about others. Use only context you can access. Return a JSON object shaped like {"topics":[{"title":"…","summary":"…","tags":["…"],"date":null}]}. Use YYYY-MM-DD for a known date and null when uncertain. If nothing qualifies, return {"topics":[]}.`;
}

export function checkImportSize(text: string): void {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
    if (bytes > MAX_IMPORT_BYTES)
      throw new Error("This import is too large. Choose a file under 1 MB.");
  }
}

function scanJson(text: string): number[] {
  const stack: Array<{ open: string; commas: number }> = [];
  const repairs: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const start = i;
      let closed = false;
      while (++i < text.length) {
        if (i - start > MAX_TEXT_CHARS)
          throw new Error("An import text field is too long.");
        if (text[i] === "\\") i++;
        else if (text[i] === '"') {
          closed = true;
          break;
        }
      }
      if (!closed)
        throw new Error("The JSON is malformed. Paste a complete reply.");
      if (text.slice(start, i + 1) === '"date"') {
        let before = start - 1;
        let after = i + 1;
        while (before >= 0 && /\s/.test(text[before])) before--;
        while (after < text.length && /\s/.test(text[after])) after++;
        if (text[before] === "," && text[after] === "}") repairs.push(i + 1);
      }
    } else if (char === "{" || char === "[") {
      stack.push({ open: char, commas: 0 });
      if (stack.length > MAX_JSON_DEPTH)
        throw new Error("This JSON is nested too deeply.");
    } else if (char === "}" || char === "]") {
      const item = stack.pop();
      if (!item || item.open !== (char === "}" ? "{" : "["))
        throw new Error("The JSON is malformed. Paste a complete reply.");
    } else if (char === "," && stack.at(-1)?.open === "[") {
      const item = stack[stack.length - 1];
      if (++item.commas >= MAX_ARRAY_ITEMS)
        throw new Error("This JSON contains too many array entries.");
    }
  }
  if (stack.length)
    throw new Error("The JSON is malformed. Paste a complete reply.");
  return repairs;
}

function parseJson(text: string): unknown {
  const repairs = scanJson(text);
  try {
    return JSON.parse(text);
  } catch {
    if (repairs.length) {
      let fixed = text;
      for (const position of repairs.reverse())
        fixed = `${fixed.slice(0, position)}:null${fixed.slice(position)}`;
      try {
        const value: unknown = JSON.parse(fixed);
        if (
          record(value) &&
          Object.keys(value).length === 1 &&
          Array.isArray(value.topics) &&
          value.topics.length > 0 &&
          value.topics.every(
            (topic: unknown) =>
              record(topic) &&
              Object.keys(topic).length === 4 &&
              ["title", "summary", "tags", "date"].every((key) =>
                Object.hasOwn(topic, key),
              ),
          )
        )
          return value;
      } catch {}
    }
    throw new Error("The JSON is malformed. Paste a complete reply.");
  }
}

function boundedField(value: unknown, limit: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > limit
  ) {
    throw new Error(
      "A topic has a missing or oversized title, summary, or tag.",
    );
  }
  return value.trim();
}

function readTopics(value: unknown[], window: WeeklyWindow): DraftTopic[] {
  if (value.length > MAX_TOPICS)
    throw new Error("Import at most five topics at a time.");
  return value.flatMap((item): DraftTopic[] => {
    if (!record(item))
      throw new Error(
        "Each topic must contain a title, summary, tags, and date.",
      );
    const title = boundedField(item.title, 80);
    const summary = boundedField(item.summary, 500);
    if (
      !Array.isArray(item.tags) ||
      item.tags.length < 1 ||
      item.tags.length > 3
    )
      throw new Error("Each topic needs one to three tags.");
    const tags = [
      ...new Set(item.tags.map((tag: unknown) => boundedField(tag, 40))),
    ];
    const date =
      item.date === undefined || item.date === null ? null : item.date;
    if (date !== null && !isCalendarDate(date))
      throw new Error("Topic dates must be YYYY-MM-DD or null.");
    if (date !== null && (date < window.start || date > window.end)) return [];
    return [{ title, summary, tags, date, confirmedThisWeek: date !== null }];
  });
}

function excerptDate(value: unknown): string | null {
  if (isCalendarDate(value)) return value;
  let date: Date;
  if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(Math.abs(value) < 1e12 ? value * 1000 : value);
  } else if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) &&
    isCalendarDate(value.slice(0, 10))
  ) {
    date = new Date(value);
  } else return null;
  return Number.isFinite(date.getTime()) &&
    date.getFullYear() >= 1 &&
    date.getFullYear() <= 9999
    ? localDate(date)
    : null;
}

function contentText(message: RecordValue): string {
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  const content = message.content;
  const parts = record(content) ? content.parts : content;
  if (!Array.isArray(parts)) return "";
  return parts
    .flatMap((part: unknown) =>
      typeof part === "string"
        ? [part]
        : record(part) && part.type === "text" && typeof part.text === "string"
          ? [part.text]
          : [],
    )
    .join("\n");
}

function fingerprint(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ value.charCodeAt(i), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

export function importKey(
  topic: DraftTopic,
  window: WeeklyWindow,
  source: string,
): string {
  checkWindow(window);
  const normalize = (text: string) =>
    text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const canonical = JSON.stringify([
    source,
    window.start,
    window.end,
    normalize(topic.title),
    normalize(topic.summary),
    [...new Set(topic.tags.map(normalize))].sort(),
    topic.date,
  ]);
  return `weekly-v1-${fingerprint(canonical)}`;
}

function textTopics(text: string, window: WeeklyWindow): DraftTopic[] | null {
  const lines = text.split(/\r?\n/);
  const topics: RecordValue[] = [];
  let current: RecordValue | null = null;
  let summary: string[] = [];
  const finish = () => {
    if (!current || (!summary.length && !(current.tags as string[]).length))
      return;
    current.summary = summary.join(" ").trim();
    topics.push(current);
  };
  for (const line of lines) {
    const heading = line.match(
      /^\s*(?:#{1,6}\s+|\d+[.)]\s+(?:\*\*)?|[-*]\s+\*\*|title\s*:\s*)(.+?)(?:\*\*)?\s*$/i,
    );
    if (heading) {
      finish();
      current = {
        title: heading[1].replace(/\*\*$/, "").trim(),
        tags: [],
        date: null,
      };
      summary = [];
    } else if (current) {
      const field = line
        .trim()
        .replace(/^[-*]\s+/, "")
        .replace(/\*\*/g, "");
      const tags = field.match(/^tags?\s*:\s*(.+)$/i);
      const date = field.match(/^date\s*:\s*(.+)$/i);
      if (tags)
        current.tags = tags[1]
          .split(/[,#]/)
          .map((tag) => tag.trim())
          .filter(Boolean);
      else if (date)
        current.date = /^(null|unknown|uncertain|undated)$/i.test(date[1])
          ? null
          : date[1];
      else if (field) summary.push(field.replace(/^summary\s*:\s*/i, ""));
    }
  }
  finish();
  if (
    !topics.length ||
    topics.some((topic) => !(topic.tags as string[]).length || !topic.summary)
  )
    return null;
  return readTopics(topics, window);
}

export function parseWeeklyImport(
  text: string,
  window: WeeklyWindow,
  filename?: string,
): WeeklyImportResult {
  checkImportSize(text);
  checkWindow(window);
  if (/\.zip$/i.test(filename ?? "") || text.startsWith("PK\u0003\u0004")) {
    return {
      kind: "empty",
      reason:
        "Extract the ZIP in Files, then choose conversations.json or memories.json.",
    };
  }
  const input = text.trim().replace(/^\uFEFF/, "");
  if (!input)
    return {
      kind: "empty",
      reason:
        "Paste a reply or choose one relevant chat for the weekly prompt.",
    };
  const fences = [
    ...input.matchAll(/```(?:json|text|markdown)?\s*\n?([\s\S]*?)```/gi),
  ];
  if (fences.length > 1)
    throw new Error("Import one reply or JSON block at a time.");
  const body = (fences[0]?.[1] ?? input).trim();
  const looksJson =
    /^[{[\"]/.test(body) ||
    /\.json$/i.test(filename ?? "") ||
    /^```json\b/i.test(input);
  const excerpts: ContextExcerpt[] = [];
  let total = 0;
  const add = (raw: string, date: string | null, allowUndated = false) => {
    if (
      (!date && !allowUndated) ||
      (date && (date < window.start || date > window.end))
    )
      return;
    const available = Math.min(
      MAX_EXCERPT_CHARS,
      MAX_EXCERPT_TOTAL_CHARS - total,
    );
    if (excerpts.length >= MAX_EXCERPTS || available <= 0) return;
    let snippet = raw.trim().slice(0, available);
    if (/[\ud800-\udbff]$/.test(snippet)) snippet = snippet.slice(0, -1);
    if (!snippet) return;
    const id = `excerpt-${fingerprint(JSON.stringify([date, snippet]))}`;
    if (excerpts.some((excerpt) => excerpt.id === id)) return;
    excerpts.push({ id, text: snippet, date });
    total += snippet.length;
  };
  if (!looksJson) {
    if (body.length > MAX_TEXT_CHARS)
      throw new Error("This text is too long. Choose a shorter excerpt.");
    const topics = textTopics(body, window);
    if (topics)
      return topics.length
        ? { kind: "recap", topics }
        : {
            kind: "empty",
            reason:
              "No topics fall within these seven days. Try the weekly prompt in one relevant chat.",
          };
    add(body, null, true);
    return {
      kind: "context",
      source: "text",
      excerpts,
      requiresSelection: true,
    };
  }
  const value = parseJson(body);
  if (record(value) && Object.hasOwn(value, "topics")) {
    if (!Array.isArray(value.topics))
      throw new Error("The recap needs a topics array.");
    const topics = readTopics(value.topics, window);
    return topics.length
      ? { kind: "recap", topics }
      : {
          kind: "empty",
          reason:
            "No topics fall within these seven days. Try the weekly prompt in one relevant chat.",
        };
  }
  let source: "chatgpt" | "claude" | "memory" | null = null;
  const memory = (item: unknown): void => {
    if (typeof item === "string") {
      add(item, null, true);
      return;
    }
    if (Array.isArray(item)) {
      for (const entry of item) memory(entry);
      return;
    }
    if (!record(item)) return;
    if (typeof item.role === "string" && !["user", "human"].includes(item.role))
      return;
    const date = excerptDate(item.created_at ?? item.date);
    for (const key of ["text", "content", "memory", "conversations_memory"]) {
      if (typeof item[key] === "string") add(item[key], date, true);
    }
    for (const key of ["memories", "memory_files", "project_memories"]) {
      if (Array.isArray(item[key])) memory(item[key]);
    }
    if (record(item.project_memories)) {
      for (const value of Object.values(item.project_memories)) memory(value);
    }
  };
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      for (const entry of item) visit(entry);
      return;
    }
    if (!record(item)) return;
    if (record(item.mapping)) {
      source ??= "chatgpt";
      for (const node of Object.values(item.mapping)) {
        if (!record(node) || !record(node.message)) continue;
        const message = node.message;
        if (record(message.author) && message.author.role === "user")
          add(contentText(message), excerptDate(message.create_time));
      }
      return;
    }
    if (Array.isArray(item.chat_messages)) {
      source ??= "claude";
      for (const message of item.chat_messages) {
        if (record(message) && message.sender === "human")
          add(contentText(message), excerptDate(message.created_at));
      }
      return;
    }
    if (
      [
        "memories",
        "memory",
        "conversations_memory",
        "project_memories",
        "memory_files",
      ].some((key) => Object.hasOwn(item, key))
    ) {
      source ??= "memory";
      memory(item);
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      if (key === "memories.json") {
        source ??= "memory";
        memory(child);
      } else if (
        key === "conversations.json" ||
        key === "conversations" ||
        key === "data"
      )
        visit(child);
    }
  };
  if (
    /(?:^|[/\\])memories\.json$/i.test(filename ?? "") &&
    Array.isArray(value)
  ) {
    source = "memory";
    memory(value);
  } else visit(value);
  if (!excerpts.length)
    return {
      kind: "empty",
      reason:
        "No usable context in these seven days. Use the weekly prompt in one relevant chat.",
    };
  return {
    kind: "context",
    source: source ?? "text",
    excerpts,
    requiresSelection: true,
  };
}
