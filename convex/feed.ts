import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { edgesFor, normalizeTag, profileValidator, profileView, requireUser, scopeFor, topicsFor, validateWindow, windowFields } from "./model";

function inWindow(topic: Doc<"topics">, args: {weekStart: string; weekEnd: string}) {
  return topic.date !== null ? topic.date >= args.weekStart && topic.date <= args.weekEnd : topic.weekStart <= args.weekEnd && topic.weekEnd >= args.weekStart;
}

async function visibleCards(ctx: QueryCtx, viewer: Id<"users">, args: {weekStart: string; weekEnd: string}) {
  const scope = await scopeFor(ctx, viewer);
  const edges = (await edgesFor(ctx, viewer, scope)).filter(e => e.status === "accepted");
  const groups = await Promise.all(edges.map(async edge => {
    const userId = edge.from === viewer ? edge.to : edge.from;
    const profile = await profileView(ctx, userId, scope);
    if (profile.sharingPaused) return [];
    const topics = await topicsFor(ctx, userId, scope);
    return topics.filter(t => t.audience === "friends" && inWindow(t, args)).map(topic => ({topic, profile}));
  }));
  return groups.flat().sort((a, b) => b.topic.updatedAt - a.topic.updatedAt || b.topic._creationTime - a.topic._creationTime);
}

export const list = query({
  args: windowFields, returns: v.array(v.object({topic: schema.doc("topics"), profile: profileValidator})),
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    validateWindow(args);
    return (await visibleCards(ctx, viewer, args)).slice(0, 100);
  },
});

export const matches = query({
  args: windowFields, returns: v.array(v.object({friend: profileValidator, mine: schema.doc("topics"), theirs: schema.doc("topics"), sharedTags: v.array(v.string()), score: v.number()})),
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    validateWindow(args);
    if ((await profileView(ctx, viewer, await scopeFor(ctx, viewer))).sharingPaused) return [];
    const mine = (await topicsFor(ctx, viewer, await scopeFor(ctx, viewer))).filter(t => t.audience === "friends" && inWindow(t, args));
    const cards = await visibleCards(ctx, viewer, args);
    type Match = {friend: Awaited<ReturnType<typeof profileView>>; mine: Doc<"topics">; theirs: Doc<"topics">; sharedTags: string[]; score: number};
    const results: Match[] = [];
    const compare = (a: Match, b: Match) => b.score - a.score || Math.max(b.mine.updatedAt, b.theirs.updatedAt) - Math.max(a.mine.updatedAt, a.theirs.updatedAt) || b.theirs._creationTime - a.theirs._creationTime;
    const ownTags = mine.map(own => new Set(own.tags.map(normalizeTag)));
    for (const {topic, profile} of cards) {
      const tags = [...new Set(topic.tags.map(normalizeTag))];
      for (let i = 0; i < mine.length; i++) {
        const sharedTags = tags.filter(t => ownTags[i].has(t)).sort();
        if (!sharedTags.length) continue;
        const match = {friend: profile, mine: mine[i], theirs: topic, sharedTags, score: sharedTags.length};
        if (results.length === 100 && compare(match, results[99]) >= 0) continue;
        results.push(match);
        results.sort(compare);
        if (results.length > 100) results.pop();
      }
    }
    return results;
  },
});
