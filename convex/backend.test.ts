/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { normalizeTag } from "./model";

const modules = import.meta.glob("./**/*.ts");
const week = {weekStart: "2026-11-09", weekEnd: "2026-11-15"};
const topic = {title: "Wheel-thrown mugs", summary: "I want to make my own coffee mug on the wheel.", tags: ["wheel throwing"], source: "manual" as const, date: null, ...week, audience: "friends" as const, importKey: "mug-1"};

async function setup() {
  const t = convexTest(schema, modules);
  const [alice, maya, stranger] = await t.run(async ctx => {
    const ids = [];
    for (const name of ["Alice", "Maya", "Stranger"]) {
      const userId = await ctx.db.insert("users", {name, isAnonymous: true});
      const sessionId = await ctx.db.insert("authSessions", {userId, expirationTime: Date.now() + 86400000});
      ids.push({userId, sessionId});
    }
    return ids;
  });
  const as = (u: typeof alice) => t.withIdentity({subject: `${u.userId}|${u.sessionId}`, issuer: "https://auth.example", tokenIdentifier: `https://auth.example|${u.userId}|${u.sessionId}`});
  const a = as(alice), m = as(maya), s = as(stranger);
  await a.mutation(api.profiles.update, {name: "Alice"});
  await m.mutation(api.profiles.update, {name: "Maya"});
  const connect = async () => {
    const {code} = await m.mutation(api.friendships.createInvite, {});
    const id = await a.mutation(api.friendships.request, {code});
    await m.mutation(api.friendships.accept, {id});
    return id;
  };
  return {t, alice, maya, stranger, a, m, s, connect};
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-15T18:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("server privacy", () => {
  it("requires auth for every public read and write", async () => {
    const {t, alice} = await setup();
    await expect(t.query(api.topics.listMine, {})).rejects.toThrow("Sign in");
    await expect(t.query(api.profiles.mine, {})).rejects.toThrow("Sign in");
    await expect(t.query(api.profiles.get, {userId: alice.userId})).rejects.toThrow("Sign in");
    await expect(t.query(api.friendships.list, {})).rejects.toThrow("Sign in");
    await expect(t.query(api.feed.list, week)).rejects.toThrow("Sign in");
    await expect(t.query(api.feed.matches, week)).rejects.toThrow("Sign in");
    await expect(t.mutation(api.topics.add, topic)).rejects.toThrow("Sign in");
    await expect(t.mutation(api.sample.start, week)).rejects.toThrow("Sign in");
    await expect(t.action(api.profiles.setPhoto, {base64: "YWJj", mimeType: "image/png"})).rejects.toThrow("Sign in");
  });

  it("proves friend shared-card access, stranger denial on detail/profile/feed/match/count, and owner-only private reads", async () => {
    const {a, m, s, maya, connect} = await setup();
    await connect();
    await a.mutation(api.topics.add, topic);
    const shared = await m.mutation(api.topics.add, {...topic, title: "Saturday ceramics", tags: ["ceramics"]});
    const privateId = await m.mutation(api.topics.add, {...topic, importKey: "private", audience: "private"});
    expect((await a.query(api.topics.get, {id: shared}))?.title).toBe("Saturday ceramics");
    expect(await a.query(api.topics.get, {id: privateId})).toBeNull();
    expect((await m.query(api.topics.get, {id: privateId}))?.audience).toBe("private");
    expect((await a.query(api.profiles.get, {userId: maya.userId}))?.topicCount).toBe(1);
    expect(await s.query(api.topics.get, {id: shared})).toBeNull();
    expect(await s.query(api.profiles.get, {userId: maya.userId})).toBeNull();
    expect(await s.query(api.feed.list, week)).toEqual([]);
    expect(await s.query(api.feed.matches, week)).toEqual([]);
    expect(await s.query(api.topics.listMine, {})).toEqual([]);
    await expect(s.mutation(api.topics.update, {id: shared, audience: "friends"})).rejects.toThrow("not found");
    await expect(s.mutation(api.topics.remove, {id: shared})).rejects.toThrow("not found");
  });

  it("requires the invite recipient's explicit acceptance, without exposing pending topics", async () => {
    const {a, m, s, maya} = await setup();
    const {code} = await m.mutation(api.friendships.createInvite, {});
    expect((await m.mutation(api.friendships.createInvite, {})).code).toBe(code);
    const edge = await a.mutation(api.friendships.request, {code});
    expect(await a.mutation(api.friendships.request, {code})).toBe(edge);
    const reverseCode = (await a.mutation(api.friendships.createInvite, {})).code;
    expect(await m.mutation(api.friendships.request, {code: reverseCode})).toBe(edge);
    const shared = await m.mutation(api.topics.add, topic);
    expect(await a.query(api.topics.get, {id: shared})).toBeNull();
    expect(await a.query(api.profiles.get, {userId: maya.userId})).toBeNull();
    await expect(a.mutation(api.friendships.accept, {id: edge})).rejects.toThrow("Only the invited");
    await expect(s.mutation(api.friendships.accept, {id: edge})).rejects.toThrow("Only the invited");
    expect((await m.query(api.friendships.list, {}))[0].direction).toBe("incoming");
    await m.mutation(api.friendships.accept, {id: edge});
    expect((await a.query(api.topics.get, {id: shared}))?._id).toBe(shared);
  });

  it("unsharing removes detail, feed, count and matches in the next reactive read", async () => {
    const {a, m, maya, connect} = await setup();
    await connect();
    await a.mutation(api.topics.add, topic);
    const id = await m.mutation(api.topics.add, {...topic, tags: ["ceramics"]});
    expect(await a.query(api.feed.matches, week)).toHaveLength(1);
    await m.mutation(api.topics.update, {id, audience: "private"});
    expect(await a.query(api.topics.get, {id})).toBeNull();
    expect(await a.query(api.feed.matches, week)).toEqual([]);
    expect(await a.query(api.feed.list, week)).toEqual([]);
    expect((await a.query(api.profiles.get, {userId: maya.userId}))?.topicCount).toBe(0);
  });

  it("edits, deletes, pauses and friend removal invalidate all relevant paths", async () => {
    const {a, m, maya, s, connect} = await setup();
    const edge = await connect();
    await a.mutation(api.topics.add, topic);
    const id = await m.mutation(api.topics.add, {...topic, tags: ["ceramics"]});
    await m.mutation(api.topics.update, {id, tags: ["gardening"]});
    expect(await a.query(api.feed.matches, week)).toEqual([]);
    await m.mutation(api.topics.update, {id, tags: ["ceramics"]});
    await m.mutation(api.profiles.update, {sharingPaused: true});
    expect(await a.query(api.topics.get, {id})).toBeNull();
    expect(await a.query(api.feed.matches, week)).toEqual([]);
    expect(await a.query(api.feed.list, week)).toEqual([]);
    expect((await a.query(api.profiles.get, {userId: maya.userId}))?.topicCount).toBe(0);
    await m.mutation(api.profiles.update, {sharingPaused: false});
    await a.mutation(api.profiles.update, {sharingPaused: true});
    expect(await a.query(api.feed.matches, week)).toEqual([]);
    await a.mutation(api.profiles.update, {sharingPaused: false});
    expect(await a.query(api.feed.matches, week)).toHaveLength(1);
    await expect(s.mutation(api.friendships.remove, {id: edge})).rejects.toThrow("not found");
    await a.mutation(api.friendships.remove, {id: edge});
    expect(await a.query(api.topics.get, {id})).toBeNull();
    expect(await a.query(api.profiles.get, {userId: maya.userId})).toBeNull();
    expect(await a.query(api.feed.matches, week)).toEqual([]);
    await connect();
    await m.mutation(api.topics.remove, {id});
    expect(await a.query(api.topics.get, {id})).toBeNull();
    expect(await a.query(api.feed.matches, week)).toEqual([]);
  });
});

describe("matching and save contract", () => {
  it("normalizes synonyms and Unicode everyday tags", () => {
    expect(normalizeTag("  WHEEL-throwing ")).toBe("pottery");
    expect(normalizeTag("ＣＥＲＡＭＩＣＳ")).toBe("pottery");
    expect(normalizeTag("  Fresh   Herbs ")).toBe("fresh herbs");
  });

  it("matches only shared current-week topics, ranks overlap count then recency, and keeps unmatched feed cards", async () => {
    const {a, m, connect} = await setup();
    await connect();
    await a.mutation(api.topics.add, {...topic, tags: ["wheel throwing", "coffee"]});
    const first = await m.mutation(api.topics.add, {...topic, importKey: "two", tags: ["ceramics", "coffee"]});
    vi.advanceTimersByTime(1000);
    const second = await m.mutation(api.topics.add, {...topic, importKey: "recent", tags: ["ceramics", "coffee"]});
    vi.advanceTimersByTime(1000);
    await m.mutation(api.topics.add, {...topic, importKey: "one-newer", tags: ["ceramics"]});
    await m.mutation(api.topics.add, {...topic, importKey: "no-overlap", tags: ["gardening"]});
    await m.mutation(api.topics.add, {...topic, importKey: "old", weekStart: "2026-11-02", weekEnd: "2026-11-08"});
    await m.mutation(api.topics.add, {...topic, importKey: "old-dated", date: "2026-11-08", weekStart: "2026-11-02", weekEnd: "2026-11-08"});
    const matches = await a.query(api.feed.matches, week);
    expect(matches.map(x => x.score)).toEqual([2, 2, 1]);
    expect(matches[0].theirs._id).toBe(second);
    expect(matches[1].theirs._id).toBe(first);
    expect(matches[0].sharedTags).toEqual(["coffee", "pottery"]);
    expect(await a.query(api.feed.list, week)).toHaveLength(4);
    const ownId = (await a.query(api.topics.listMine, {}))[0]._id;
    await a.mutation(api.topics.update, {id: ownId, audience: "private"});
    expect(await a.query(api.feed.matches, week)).toEqual([]);
  });

  it("retries/imports are scoped to owner and remain idempotent after edit, unshare and deletion", async () => {
    const {a, m} = await setup();
    const id = await a.mutation(api.topics.add, topic);
    expect(await a.mutation(api.topics.add, topic)).toBe(id);
    expect(await m.mutation(api.topics.add, topic)).not.toBe(id);
    await a.mutation(api.topics.update, {id, title: "Edited title", audience: "private"});
    expect(await a.mutation(api.topics.add, topic)).toBe(id);
    expect((await a.query(api.topics.get, {id}))?.title).toBe("Edited title");
    expect((await a.query(api.topics.get, {id}))?.audience).toBe("private");
    await a.mutation(api.topics.remove, {id});
    expect(await a.mutation(api.topics.add, topic)).toBe(id);
    expect(await a.query(api.topics.listMine, {})).toEqual([]);
  });

  it("uses inclusive overlap for undated confirmed weeks and exact dates for dated topics", async () => {
    const {a, m, connect} = await setup();
    await connect();
    await a.mutation(api.topics.add, topic);
    const before = await m.mutation(api.topics.add, {...topic, importKey: "before", weekStart: "2026-11-03", weekEnd: "2026-11-09"});
    const after = await m.mutation(api.topics.add, {...topic, importKey: "after", weekStart: "2026-11-15", weekEnd: "2026-11-21"});
    await m.mutation(api.topics.add, {...topic, importKey: "outside", weekStart: "2026-11-16", weekEnd: "2026-11-22"});
    await m.mutation(api.topics.add, {...topic, importKey: "known-outside", date: "2026-11-16", weekStart: "2026-11-10", weekEnd: "2026-11-16"});
    expect(new Set((await a.query(api.feed.list, week)).map(x => x.topic._id))).toEqual(new Set([before, after]));
    expect(await a.query(api.feed.matches, week)).toHaveLength(2);
  });

  it.each([
    {title: " "}, {title: "x".repeat(101)}, {summary: " "}, {summary: "x".repeat(501)},
    {tags: []}, {tags: ["x", "y", "z", "w"]}, {tags: [" "]}, {tags: ["x".repeat(41)]},
    {date: "2026-11-99"}, {date: "2026-11-08"}, {date: "2026-02-30"},
    {weekStart: "2026-11-10"}, {weekEnd: "not-a-date"}, {importKey: ""}, {importKey: "x".repeat(201)},
  ])("rejects malformed topic %j without a write", async changes => {
    const {a} = await setup();
    await expect(a.mutation(api.topics.add, {...topic, ...changes})).rejects.toThrow();
    expect(await a.query(api.topics.listMine, {})).toEqual([]);
  });

  it("validates edit windows, names, invites and unknown owner arguments", async () => {
    const {a, maya} = await setup();
    const id = await a.mutation(api.topics.add, {...topic, date: "2026-11-15"});
    await expect(a.mutation(api.topics.update, {id, date: "2026-11-16"})).rejects.toThrow("confirmed week");
    await expect(a.mutation(api.profiles.update, {name: " "})).rejects.toThrow("name");
    await expect(a.mutation(api.friendships.request, {code: "bad"})).rejects.toThrow("code");
    await expect(a.query(api.feed.matches, {...week, weekEnd: "2026-11-14"})).rejects.toThrow("seven");
    await expect(a.mutation(api.topics.add, {...topic, owner: maya.userId} as typeof topic)).rejects.toThrow();
    await expect(a.mutation(api.topics.update, {id, importKey: "changed"} as {id: typeof id})).rejects.toThrow();
  });
});

describe("fictional circle isolation and photos", () => {
  it("keeps real sharing paused through sample entry/reset/exit and scopes sample pause separately", async () => {
    const {a, m, connect} = await setup();
    await connect();
    const id = await a.mutation(api.topics.add, topic);
    await a.mutation(api.profiles.update, {sharingPaused: true});
    await a.mutation(api.sample.start, {...week, reset: true});
    expect((await a.query(api.profiles.mine, {})).sharingPaused).toBe(false);
    expect(await a.query(api.feed.matches, week)).toHaveLength(1);
    expect(await m.query(api.topics.get, {id})).toBeNull();
    expect(await m.query(api.feed.list, week)).toEqual([]);
    await a.mutation(api.profiles.update, {sharingPaused: true});
    expect(await a.query(api.feed.matches, week)).toEqual([]);
    await a.mutation(api.sample.start, {...week, reset: true});
    expect((await a.query(api.profiles.mine, {})).sharingPaused).toBe(false);
    expect(await m.query(api.topics.get, {id})).toBeNull();
    await a.mutation(api.sample.stop, {});
    expect((await a.query(api.profiles.mine, {})).sharingPaused).toBe(true);
    expect(await m.query(api.topics.get, {id})).toBeNull();
  });

  it("uses persisted real records and shared policy, resets without viewer pottery, and never exposes another sample", async () => {
    const {a, m, s} = await setup();
    const realId = await a.mutation(api.topics.add, topic);
    const {mayaId} = await a.mutation(api.sample.start, {...week, reset: true});
    expect(await a.mutation(api.sample.start, week)).toEqual({mayaId});
    const feed = await a.query(api.feed.list, week);
    const mayaTopic = feed.find(x => x.profile.userId === mayaId)!.topic;
    expect(mayaTopic.title).toBe("Saturday ceramics");
    expect(mayaTopic.tags).toEqual(["ceramics"]);
    expect(feed.every(x => x.profile.synthetic)).toBe(true);
    expect((await a.query(api.topics.listMine, {})).some(x => x.tags.map(normalizeTag).includes("pottery"))).toBe(false);
    expect(await a.query(api.topics.get, {id: realId})).toBeNull();
    expect(await s.query(api.topics.get, {id: mayaTopic._id})).toBeNull();
    expect(await s.query(api.profiles.get, {userId: mayaId})).toBeNull();
    await m.mutation(api.sample.start, week);
    expect(await m.query(api.topics.get, {id: mayaTopic._id})).toBeNull();
    const sampleId = await a.mutation(api.topics.add, topic);
    expect(sampleId).not.toBe(realId);
    expect((await a.query(api.feed.matches, week)).some(x => x.theirs.title === "Saturday ceramics" && x.mine.title === "Wheel-thrown mugs")).toBe(true);
    await a.mutation(api.sample.start, {...week, reset: true});
    expect((await a.query(api.topics.listMine, {})).some(x => x.tags.map(normalizeTag).includes("pottery"))).toBe(false);
    const retriedFresh = await a.mutation(api.topics.add, topic);
    expect(retriedFresh).not.toBe(sampleId);
    expect(await a.mutation(api.topics.add, topic)).toBe(retriedFresh);
    await a.mutation(api.sample.stop, {});
    expect((await a.query(api.topics.listMine, {})).map(x => x._id)).toEqual([realId]);
    expect(await a.query(api.topics.get, {id: retriedFresh})).toBeNull();
  });

  it("authenticates photo uploads, serves storage URLs, refuses borrowed storage IDs and removes photos", async () => {
    const {a, m} = await setup();
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZaMAAAAASUVORK5CYII=";
    await a.action(api.profiles.setPhoto, {base64: png, mimeType: "image/png"});
    expect((await a.query(api.profiles.mine, {})).photoUrl).toMatch(/^https?:/);
    expect((await m.query(api.profiles.mine, {})).photoUrl).toBeNull();
    await expect(a.action(api.profiles.setPhoto, {base64: "YWJj", mimeType: "image/png"})).rejects.toThrow("JPEG, PNG");
    await expect(a.action(api.profiles.setPhoto, {base64: "x".repeat(2800001), mimeType: "image/png"})).rejects.toThrow("2 MB");
    await expect(m.mutation(api.profiles.update, {photoId: "borrowed"} as unknown as {photoId: null})).rejects.toThrow();
    await a.mutation(api.profiles.update, {photoId: null});
    expect((await a.query(api.profiles.mine, {})).photoUrl).toBeNull();
  });
});
