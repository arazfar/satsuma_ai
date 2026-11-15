import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import { acceptedFriend, ensureProfile, profileValidator, profileView, requireUser, scopeFor, topicsFor } from "./model";

export const mine = query({
  args: {}, returns: profileValidator,
  handler: async ctx => {
    const viewer = await requireUser(ctx);
    return await profileView(ctx, viewer, await scopeFor(ctx, viewer));
  },
});

export const get = query({
  args: {userId: v.id("users")},
  returns: v.union(v.object({profile: profileValidator, topics: v.array(schema.doc("topics")), topicCount: v.number()}), v.null()),
  handler: async (ctx, {userId}) => {
    const viewer = await requireUser(ctx);
    if (viewer !== userId && !await acceptedFriend(ctx, viewer, userId)) return null;
    const profile = await profileView(ctx, userId, await scopeFor(ctx, viewer));
    const topics = (await topicsFor(ctx, userId, await scopeFor(ctx, viewer))).filter(t => viewer === userId || (!profile.sharingPaused && t.audience === "friends"));
    return {profile, topics, topicCount: topics.length};
  },
});

export const update = mutation({
  args: {name: v.optional(v.string()), sharingPaused: v.optional(v.boolean()), photoId: v.optional(v.null())}, returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    if (args.name !== undefined && (!args.name.trim() || args.name.length > 60 || /[\u0000-\u001f]/.test(args.name))) throw new Error("Choose a name up to 60 characters.");
    const profile = await ensureProfile(ctx, owner);
    const scope = await scopeFor(ctx, owner);
    if (args.photoId === null && profile.photoId) await ctx.storage.delete(profile.photoId);
    await ctx.db.patch("profiles", profile._id, {
      ...(args.name !== undefined ? {name: args.name.trim()} : {}),
      ...(args.sharingPaused !== undefined ? (scope ? {sampleSharingPaused: args.sharingPaused} : {sharingPaused: args.sharingPaused}) : {}),
      ...(args.photoId === null ? {photoId: undefined} : {}),
    });
    return null;
  },
});

export const savePhoto = internalMutation({
  args: {owner: v.id("users"), photoId: v.id("_storage")}, returns: v.null(),
  handler: async (ctx, {owner, photoId}) => {
    if (!(await ctx.db.get("users", owner))) throw new Error("Account not found.");
    const profile = await ensureProfile(ctx, owner);
    if (profile.photoId) await ctx.storage.delete(profile.photoId);
    await ctx.db.patch("profiles", profile._id, {photoId});
    return null;
  },
});

export const setPhoto = action({
  args: {base64: v.string(), mimeType: v.union(v.literal("image/jpeg"), v.literal("image/png"), v.literal("image/webp"))}, returns: v.null(),
  handler: async (ctx, {base64, mimeType}) => {
    const owner = await getAuthUserId(ctx);
    if (!owner) throw new Error("Sign in to set your photo.");
    if (base64.length > 2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("Choose an image smaller than 2 MB.");
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) throw new Error("Choose an image smaller than 2 MB.");
    const valid = mimeType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mimeType === "image/png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) throw new Error("Choose a JPEG, PNG or WebP image.");
    const photoId = await ctx.storage.store(new Blob([bytes], {type: mimeType}));
    try {
      await ctx.runMutation(internal.profiles.savePhoto, {owner, photoId});
    } catch (error) {
      await ctx.storage.delete(photoId);
      throw error;
    }
    return null;
  },
});
