import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

type ReadCtx = Pick<QueryCtx, "db" | "auth" | "storage">;
export const profileValidator = v.object({
  userId: v.id("users"), name: v.string(), photoUrl: v.union(v.string(), v.null()),
  sharingPaused: v.boolean(), synthetic: v.boolean(), sampleActive: v.boolean(),
});
export const windowFields = { weekStart: v.string(), weekEnd: v.string() };

export async function requireUser(ctx: Pick<QueryCtx, "auth" | "db">) {
  const userId = await getAuthUserId(ctx);
  if (!userId || !(await ctx.db.get("users", userId))) throw new Error("Sign in to continue.");
  return userId;
}

export function isoDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a YYYY-MM-DD date.");
  const time = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error("Use a real calendar date.");
  return time;
}

export function validateWindow(args: {weekStart: string; weekEnd: string}) {
  if (isoDay(args.weekEnd) - isoDay(args.weekStart) !== 6 * 86400000) throw new Error("Confirm seven inclusive calendar days.");
}

export function normalizeTag(value: string) {
  const tag = value.normalize("NFKC").toLowerCase().trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  return ({ "wheel throwing": "pottery", "wheel thrown": "pottery", "ceramics": "pottery", "ceramic": "pottery" } as Record<string, string>)[tag] ?? tag;
}

export function validateTopic(topic: Pick<Doc<"topics">, "title" | "summary" | "tags" | "date" | "weekStart" | "weekEnd" | "importKey">) {
  if (!topic.title.trim() || topic.title.length > 100 || !topic.summary.trim() || topic.summary.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(topic.title + topic.summary)) throw new Error("Add a short title and one specific sentence.");
  if (topic.tags.length < 1 || topic.tags.length > 3 || topic.tags.some(t => !normalizeTag(t) || t.length > 40)) throw new Error("Choose one to three short everyday tags.");
  if (!topic.importKey.trim() || topic.importKey.length > 200) throw new Error("A stable save key is required.");
  validateWindow(topic);
  if (topic.date !== null && (isoDay(topic.date) < isoDay(topic.weekStart) || isoDay(topic.date) > isoDay(topic.weekEnd))) throw new Error("The topic date must belong to the confirmed week.");
}

export async function storedProfile(ctx: Pick<QueryCtx, "db">, userId: Id<"users">) {
  return await ctx.db.query("profiles").withIndex("by_userId", q => q.eq("userId", userId)).unique();
}

export async function ensureProfile(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await storedProfile(ctx, userId);
  if (existing) return existing;
  const id = await ctx.db.insert("profiles", {userId, name: "You", sharingPaused: false, sampleActive: false});
  return (await ctx.db.get("profiles", id))!;
}

export async function sharingPaused(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, scope?: Id<"users">) {
  const profile = await storedProfile(ctx, userId);
  return scope === userId ? profile?.sampleSharingPaused ?? false : profile?.sharingPaused ?? false;
}

export async function profileView(ctx: ReadCtx, userId: Id<"users">, scope?: Id<"users">) {
  const profile = await storedProfile(ctx, userId);
  return {
    userId, name: profile?.name ?? "You", photoUrl: profile?.photoId ? await ctx.storage.getUrl(profile.photoId) : null,
    sharingPaused: scope === userId ? profile?.sampleSharingPaused ?? false : profile?.sharingPaused ?? false, synthetic: !!profile?.sampleOwner, sampleActive: profile?.sampleActive ?? false,
  };
}

export async function scopeFor(ctx: Pick<QueryCtx, "db">, userId: Id<"users">) {
  const profile = await storedProfile(ctx, userId);
  return profile?.sampleActive ? userId : undefined;
}

export async function edgesFor(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, scope: Id<"users"> | undefined) {
  const [outgoing, incoming] = await Promise.all([
    ctx.db.query("friendships").withIndex("by_from_and_sampleOwner", q => q.eq("from", userId).eq("sampleOwner", scope)).take(51),
    ctx.db.query("friendships").withIndex("by_to_and_sampleOwner", q => q.eq("to", userId).eq("sampleOwner", scope)).take(51),
  ]);
  return [...outgoing, ...incoming];
}

export async function acceptedFriend(ctx: Pick<QueryCtx, "db">, viewer: Id<"users">, other: Id<"users">) {
  const scope = await scopeFor(ctx, viewer);
  const otherProfile = await storedProfile(ctx, other);
  if (scope ? otherProfile?.sampleOwner !== viewer : !!otherProfile?.sampleOwner) return false;
  return (await edgesFor(ctx, viewer, scope)).some(e => e.status === "accepted" && (e.from === other || e.to === other));
}

export async function topicsFor(ctx: Pick<QueryCtx, "db">, owner: Id<"users">, scope: Id<"users"> | undefined) {
  return await ctx.db.query("topics").withIndex("by_owner_and_sampleOwner", q => q.eq("owner", owner).eq("sampleOwner", scope)).order("desc").take(100);
}

export async function canReadTopic(ctx: Pick<QueryCtx, "db">, viewer: Id<"users">, topic: Doc<"topics">) {
  if (topic.sampleOwner !== await scopeFor(ctx, viewer)) return false;
  if (topic.owner === viewer) return true;
  return topic.audience === "friends" && !await sharingPaused(ctx, topic.owner, topic.sampleOwner) && await acceptedFriend(ctx, viewer, topic.owner);
}

export async function insertTopic(ctx: MutationCtx, owner: Id<"users">, args: Omit<Doc<"topics">, "_id" | "_creationTime" | "owner" | "updatedAt">) {
  validateTopic(args);
  const importKey = await retryKey(ctx, owner, args.importKey, args.sampleOwner);
  const retry = await ctx.db.query("topicImports").withIndex("by_owner_and_importKey", q => q.eq("owner", owner).eq("importKey", importKey)).unique();
  if (retry) return retry.topicId;
  const existing = await ctx.db.query("topics").withIndex("by_owner_and_sampleOwner_and_importKey", q => q.eq("owner", owner).eq("sampleOwner", args.sampleOwner).eq("importKey", args.importKey)).unique();
  if (existing) return existing._id;
  if ((await topicsFor(ctx, owner, args.sampleOwner)).length >= 100) throw new Error("Keep up to 100 topics; remove an older topic first.");
  const id = await ctx.db.insert("topics", {...args, owner, title: args.title.trim(), summary: args.summary.trim(), tags: [...new Set(args.tags.map(t => t.trim()))], updatedAt: Date.now()});
  await ctx.db.insert("topicImports", {owner, importKey, topicId: id});
  return id;
}

export async function retryKey(ctx: Pick<QueryCtx, "db">, owner: Id<"users">, key: string, scope?: Id<"users">) {
  return JSON.stringify([scope ? (await storedProfile(ctx, owner))?.sampleRunId : "real", key]);
}

export async function requestFriend(ctx: MutationCtx, from: Id<"users">, to: Id<"users">, scope?: Id<"users">) {
  if (from === to) throw new Error("Use a friend's invite code.");
  const [fromEdges, toEdges] = await Promise.all([edgesFor(ctx, from, scope), edgesFor(ctx, to, scope)]);
  const existing = fromEdges.find(e => e.from === to || e.to === to);
  if (existing) return existing._id;
  if (fromEdges.length >= 50 || toEdges.length >= 50) throw new Error("This circle is full.");
  return await ctx.db.insert("friendships", {from, to, status: "pending", ...(scope ? {sampleOwner: scope} : {})});
}

export async function acceptFriend(ctx: MutationCtx, recipient: Id<"users">, id: Id<"friendships">) {
  const edge = await ctx.db.get("friendships", id);
  if (!edge || edge.to !== recipient) throw new Error("Only the invited friend can accept.");
  await ctx.db.patch("friendships", id, {status: "accepted"});
}
