import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema, { topicFields } from "./schema";

export const listMine = query({
  args: {},
  returns: v.array(schema.doc("topics")),
  handler: async (ctx) => {
    const owner = await getAuthUserId(ctx);
    if (!owner) throw new Error("Sign in to see your topics.");
    return await ctx.db.query("topics").withIndex("by_owner", q => q.eq("owner", owner)).order("desc").take(100);
  },
});

const { owner: _owner, updatedAt: _updatedAt, ...addFields } = topicFields;

export const add = mutation({
  args: addFields,
  returns: v.id("topics"),
  handler: async (ctx, args) => {
    const owner = await getAuthUserId(ctx);
    if (!owner) throw new Error("Sign in to save a topic.");
    if (!args.title.trim() || args.title.length > 100 || !args.summary.trim() || args.summary.length > 500 || args.tags.length < 1 || args.tags.length > 3 || args.tags.some(tag => !tag.trim() || tag.length > 40)) throw new Error("Add a short title, sentence, and one to three tags.");
    if (!args.date && (!args.weekStart || !args.weekEnd)) throw new Error("Confirm the topic's week.");
    const existing = await ctx.db.query("topics").withIndex("by_owner_and_importKey", q => q.eq("owner", owner).eq("importKey", args.importKey)).unique();
    if (existing) return existing._id;
    return await ctx.db.insert("topics", { ...args, title: args.title.trim(), summary: args.summary.trim(), owner, updatedAt: Date.now() });
  },
});
