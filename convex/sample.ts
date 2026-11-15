import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { acceptFriend, edgesFor, ensureProfile, insertTopic, requestFriend, requireUser, storedProfile, topicsFor, validateWindow, windowFields } from "./model";

export const start = mutation({
  args: {...windowFields, reset: v.optional(v.boolean())}, returns: v.object({mayaId: v.id("users")}),
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    validateWindow(args);
    const profile = await ensureProfile(ctx, viewer);
    const previous = await ctx.db.query("profiles").withIndex("by_sampleOwner", q => q.eq("sampleOwner", viewer)).take(3);
    if (!args.reset && previous.length) {
      for (const owner of [viewer, ...previous.map(p => p.userId)]) {
        for (const topic of await topicsFor(ctx, owner, viewer)) {
          if (topic.source === "sample" && (topic.weekStart !== args.weekStart || topic.weekEnd !== args.weekEnd)) {
            await ctx.db.patch("topics", topic._id, {weekStart: args.weekStart, weekEnd: args.weekEnd, updatedAt: Date.now()});
          }
        }
      }
      await ctx.db.patch("profiles", profile._id, {sampleActive: true});
      return {mayaId: previous[0].userId};
    }
    const oldTopics = [...await topicsFor(ctx, viewer, viewer)];
    for (const synthetic of previous) oldTopics.push(...await topicsFor(ctx, synthetic.userId, viewer));
    for (const topic of oldTopics) await ctx.db.delete("topics", topic._id);
    for (const edge of await edgesFor(ctx, viewer, viewer)) await ctx.db.delete("friendships", edge._id);
    for (const synthetic of previous) {
      await ctx.db.delete("profiles", synthetic._id);
      await ctx.db.delete("users", synthetic.userId);
    }
    await ctx.db.patch("profiles", profile._id, {sampleActive: true, sampleSharingPaused: false});
    const mayaId = await ctx.db.insert("users", {name: "Maya (sample)"});
    const leoId = await ctx.db.insert("users", {name: "Leo (sample)"});
    for (const [userId, name] of [[mayaId, "Maya"], [leoId, "Leo"]] as const) {
      await ctx.db.insert("profiles", {userId, name, sharingPaused: false, sampleActive: false, sampleOwner: viewer, sampleRunId: mayaId});
      const edge = await requestFriend(ctx, userId, viewer, viewer);
      await acceptFriend(ctx, viewer, edge);
    }
    await ctx.db.patch("profiles", profile._id, {sampleRunId: mayaId});
    const suffix = `${mayaId}`;
    const base = {source: "sample" as const, date: null, weekStart: args.weekStart, weekEnd: args.weekEnd, audience: "friends" as const, sampleOwner: viewer};
    await insertTopic(ctx, mayaId, {...base, title: "Saturday ceramics", summary: "I'm looking for a Saturday ceramics class.", tags: ["ceramics"], importKey: `sample-maya-${suffix}`});
    await insertTopic(ctx, leoId, {...base, title: "Balcony herbs", summary: "I'm growing basil and mint on my balcony.", tags: ["gardening"], importKey: `sample-leo-${suffix}`});
    await insertTopic(ctx, viewer, {...base, title: "A little herb garden", summary: "I want to grow fresh herbs for dinner.", tags: ["gardening"], importKey: `sample-viewer-${suffix}`});
    return {mayaId};
  },
});

export const stop = mutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    const viewer = await requireUser(ctx);
    const profile = await storedProfile(ctx, viewer);
    if (profile) await ctx.db.patch("profiles", profile._id, {sampleActive: false});
    return null;
  },
});
