import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { acceptFriend, edgesFor, profileValidator, profileView, requestFriend, requireUser, scopeFor, storedProfile } from "./model";

export const list = query({
  args: {}, returns: v.array(v.object({id: v.id("friendships"), status: v.union(v.literal("pending"), v.literal("accepted")), direction: v.union(v.literal("incoming"), v.literal("outgoing")), profile: profileValidator})),
  handler: async ctx => {
    const viewer = await requireUser(ctx);
    const scope = await scopeFor(ctx, viewer);
    const edges = await edgesFor(ctx, viewer, scope);
    return await Promise.all(edges.map(async e => ({id: e._id, status: e.status, direction: e.to === viewer ? "incoming" as const : "outgoing" as const, profile: await profileView(ctx, e.from === viewer ? e.to : e.from, scope)})));
  },
});

export const createInvite = mutation({
  args: {}, returns: v.object({code: v.string()}),
  handler: async ctx => {
    const owner = await requireUser(ctx);
    if (await scopeFor(ctx, owner)) throw new Error("Leave the sample circle to invite real friends.");
    const existing = await ctx.db.query("invites").withIndex("by_owner", q => q.eq("owner", owner)).unique();
    if (existing) return {code: existing.code};
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
    await ctx.db.insert("invites", {owner, code});
    return {code};
  },
});

export const request = mutation({
  args: {code: v.string()}, returns: v.id("friendships"),
  handler: async (ctx, {code}) => {
    const viewer = await requireUser(ctx);
    if (await scopeFor(ctx, viewer)) throw new Error("Leave the sample circle to add real friends.");
    if (!/^[A-Z0-9]{16}$/.test(code.trim().toUpperCase())) throw new Error("Check the invite code.");
    const invite = await ctx.db.query("invites").withIndex("by_code", q => q.eq("code", code.trim().toUpperCase())).unique();
    if (!invite || (await storedProfile(ctx, invite.owner))?.sampleOwner) throw new Error("Invite not found.");
    return await requestFriend(ctx, viewer, invite.owner);
  },
});

export const accept = mutation({
  args: {id: v.id("friendships")}, returns: v.null(),
  handler: async (ctx, {id}) => {
    const viewer = await requireUser(ctx);
    const edge = await ctx.db.get("friendships", id);
    if (!edge || edge.sampleOwner !== await scopeFor(ctx, viewer)) throw new Error("Invitation not found.");
    await acceptFriend(ctx, viewer, id);
    return null;
  },
});

export const remove = mutation({
  args: {id: v.id("friendships")}, returns: v.null(),
  handler: async (ctx, {id}) => {
    const viewer = await requireUser(ctx);
    const edge = await ctx.db.get("friendships", id);
    if (!edge) return null;
    if ((edge.from !== viewer && edge.to !== viewer) || edge.sampleOwner !== await scopeFor(ctx, viewer)) throw new Error("Friendship not found.");
    await ctx.db.delete("friendships", id);
    return null;
  },
});
