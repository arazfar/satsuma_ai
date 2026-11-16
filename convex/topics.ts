import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema, { topicFields } from "./schema";
import { canReadTopic, insertTopic, requireUser, requireWriteScope, retryKey, scopeFor, topicsFor, validateTopic } from "./model";

export const listMine = query({
  args: {}, returns: v.array(schema.doc("topics")),
  handler: async ctx => {
    const owner = await requireUser(ctx);
    return await topicsFor(ctx, owner, await scopeFor(ctx, owner));
  },
});

const {owner: _owner, updatedAt: _updatedAt, sampleOwner: _sampleOwner, ...addFields} = topicFields;

export const add = mutation({
  args: {...addFields, scope: v.union(v.string(), v.null())}, returns: v.id("topics"),
  handler: async (ctx, {scope: expectedScope, ...args}) => {
    const owner = await requireUser(ctx);
    const scope = await requireWriteScope(ctx, owner, expectedScope);
    return (await insertTopic(ctx, owner, {...args, ...(scope ? {sampleOwner: scope} : {})})).id;
  },
});

export const saveImport = mutation({
  args: {scope: v.union(v.string(), v.null()), topics: v.array(v.object(addFields))},
  returns: v.object({created: v.number(), unchanged: v.number(), deleted: v.number()}),
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const scope = await requireWriteScope(ctx, owner, args.scope);
    if (!args.topics.length || args.topics.length > 5) throw new Error("Save one to five reviewed topics at a time.");
    const counts = {created: 0, unchanged: 0, deleted: 0};
    for (const topic of args.topics) {
      const result = await insertTopic(ctx, owner, {...topic, ...(scope ? {sampleOwner: scope} : {})});
      counts[result.status]++;
    }
    return counts;
  },
});

export const get = query({
  args: {id: v.id("topics")}, returns: v.union(schema.doc("topics"), v.null()),
  handler: async (ctx, {id}) => {
    const viewer = await requireUser(ctx);
    const topic = await ctx.db.get("topics", id);
    return topic && await canReadTopic(ctx, viewer, topic) ? topic : null;
  },
});

export const update = mutation({
  args: {id: v.id("topics"), title: v.optional(v.string()), summary: v.optional(v.string()), tags: v.optional(v.array(v.string())), date: v.optional(v.union(v.string(), v.null())), weekStart: v.optional(v.string()), weekEnd: v.optional(v.string()), audience: v.optional(topicFields.audience)},
  returns: v.null(),
  handler: async (ctx, {id, ...changes}) => {
    const owner = await requireUser(ctx);
    const topic = await ctx.db.get("topics", id);
    if (!topic || topic.owner !== owner || topic.sampleOwner !== await scopeFor(ctx, owner)) throw new Error("Topic not found.");
    const next = {...topic, ...changes};
    validateTopic(next);
    await ctx.db.patch("topics", id, {...changes, ...(changes.title !== undefined ? {title: next.title.trim()} : {}), ...(changes.summary !== undefined ? {summary: next.summary.trim()} : {}), updatedAt: Date.now()});
    return null;
  },
});

export const remove = mutation({
  args: {id: v.id("topics")}, returns: v.null(),
  handler: async (ctx, {id}) => {
    const owner = await requireUser(ctx);
    const topic = await ctx.db.get("topics", id);
    if (!topic) return null;
    if (topic.owner !== owner || topic.sampleOwner !== await scopeFor(ctx, owner)) throw new Error("Topic not found.");
    const importKey = await retryKey(ctx, owner, topic.importKey, topic.sampleOwner);
    const retry = await ctx.db.query("topicImports").withIndex("by_owner_and_importKey", q => q.eq("owner", owner).eq("importKey", importKey)).unique();
    if (!retry) await ctx.db.insert("topicImports", {owner, importKey, topicId: id});
    await ctx.db.delete("topics", id);
    return null;
  },
});
