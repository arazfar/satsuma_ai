import type { DraftTopic, WeeklyWindow } from "./weeklyImport";

export function reviewedTopicFields(
  topic: DraftTopic,
  window: WeeklyWindow,
  audience: "private" | "friends",
) {
  if (!topic.date && !topic.confirmedThisWeek)
    throw new Error(
      "Confirm that every undated topic belongs to this week before saving.",
    );
  const title = topic.title.trim();
  const summary = topic.summary.trim();
  const tags = topic.tags.map((tag) => tag.trim());
  if (
    !title ||
    title.length > 100 ||
    !summary ||
    summary.length > 500 ||
    tags.length < 1 ||
    tags.length > 3 ||
    tags.some((tag) => !tag || tag.length > 40)
  )
    throw new Error(
      "Each topic needs a title (100 characters), a sentence (500), and one to three short tags (40 each).",
    );
  return {
    title,
    summary,
    tags,
    date: topic.date,
    weekStart: window.start,
    weekEnd: window.end,
    audience,
  };
}
