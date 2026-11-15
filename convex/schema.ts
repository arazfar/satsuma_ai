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
  sampleOwner: v.optional(v.id("users")),
};

export default defineSchema({
  ...authTables,
  topics: defineTable(topicFields)
    .index("by_owner", ["owner"])
    .index("by_owner_and_sampleOwner", ["owner", "sampleOwner"])
    .index("by_owner_and_sampleOwner_and_importKey", ["owner", "sampleOwner", "importKey"])
    .index("by_owner_and_importKey", ["owner", "importKey"]),
  topicImports: defineTable({ owner: v.id("users"), importKey: v.string(), topicId: v.id("topics") })
    .index("by_owner_and_importKey", ["owner", "importKey"]),
  profiles: defineTable({
    userId: v.id("users"), name: v.string(), photoId: v.optional(v.id("_storage")),
    sharingPaused: v.boolean(), sampleSharingPaused: v.optional(v.boolean()), sampleActive: v.boolean(), sampleOwner: v.optional(v.id("users")), sampleRunId: v.optional(v.string()),
  }).index("by_userId", ["userId"]).index("by_sampleOwner", ["sampleOwner"]),
  friendships: defineTable({
    from: v.id("users"), to: v.id("users"), status: v.union(v.literal("pending"), v.literal("accepted")),
    sampleOwner: v.optional(v.id("users")),
  }).index("by_from_and_sampleOwner", ["from", "sampleOwner"])
    .index("by_to_and_sampleOwner", ["to", "sampleOwner"]),
  invites: defineTable({ owner: v.id("users"), code: v.string() })
    .index("by_owner", ["owner"]).index("by_code", ["code"]),
});
