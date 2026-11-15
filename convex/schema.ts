import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const topicFields = {
  owner: v.id("users"),
  title: v.string(),
  summary: v.string(),
  tags: v.array(v.string()),
  source: v.union(v.literal("manual"), v.literal("chatgpt"), v.literal("claude"), v.literal("sample")),
  date: v.union(v.string(), v.null()),
  weekStart: v.string(),
  weekEnd: v.string(),
  audience: v.union(v.literal("private"), v.literal("friends")),
  importKey: v.string(),
  updatedAt: v.number(),
};

export default defineSchema({
  ...authTables,
  topics: defineTable(topicFields)
    .index("by_owner", ["owner"])
    .index("by_owner_and_importKey", ["owner", "importKey"]),
});
