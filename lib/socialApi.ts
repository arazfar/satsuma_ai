import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import type { Doc, Id } from "../convex/_generated/dataModel";

export type Profile = {
  userId: Id<"users">;
  name: string;
  photoUrl: string | null;
  sharingPaused: boolean;
  synthetic: boolean;
  sampleActive: boolean;
};
export type Topic = Doc<"topics">;
export type FriendshipId = GenericId<"friendships">;
export type Friendship = {
  id: FriendshipId;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
  profile: Profile;
};
export type FeedItem = { topic: Topic; profile: Profile };
export type Match = {
  friend: Profile;
  mine: Topic;
  theirs: Topic;
  sharedTags: string[];
  score: number;
};
type WindowArgs = { weekStart: string; weekEnd: string };
type TopicChanges = Partial<
  Pick<
    Topic,
    "title" | "summary" | "tags" | "date" | "weekStart" | "weekEnd" | "audience"
  >
>;

export const socialApi = {
  profiles: {
    mine: makeFunctionReference<"query", Record<string, never>, Profile>(
      "profiles:mine",
    ),
    get: makeFunctionReference<
      "query",
      { userId: Id<"users"> },
      { profile: Profile; topics: Topic[]; topicCount: number } | null
    >("profiles:get"),
    update: makeFunctionReference<
      "mutation",
      { name?: string; sharingPaused?: boolean; photoId?: null },
      null
    >("profiles:update"),
    setPhoto: makeFunctionReference<
      "action",
      { base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" },
      null
    >("profiles:setPhoto"),
  },
  topics: {
    get: makeFunctionReference<"query", { id: Id<"topics"> }, Topic | null>(
      "topics:get",
    ),
    update: makeFunctionReference<
      "mutation",
      { id: Id<"topics"> } & TopicChanges,
      null
    >("topics:update"),
    remove: makeFunctionReference<"mutation", { id: Id<"topics"> }, null>(
      "topics:remove",
    ),
  },
  friendships: {
    list: makeFunctionReference<"query", Record<string, never>, Friendship[]>(
      "friendships:list",
    ),
    createInvite: makeFunctionReference<
      "mutation",
      Record<string, never>,
      { code: string }
    >("friendships:createInvite"),
    request: makeFunctionReference<"mutation", { code: string }, FriendshipId>(
      "friendships:request",
    ),
    accept: makeFunctionReference<"mutation", { id: FriendshipId }, null>(
      "friendships:accept",
    ),
    remove: makeFunctionReference<"mutation", { id: FriendshipId }, null>(
      "friendships:remove",
    ),
  },
  feed: {
    list: makeFunctionReference<"query", WindowArgs, FeedItem[]>("feed:list"),
    matches: makeFunctionReference<"query", WindowArgs, Match[]>(
      "feed:matches",
    ),
  },
  sample: {
    start: makeFunctionReference<
      "mutation",
      WindowArgs & { reset?: boolean },
      { mayaId: Id<"users"> }
    >("sample:start"),
    stop: makeFunctionReference<"mutation", Record<string, never>, null>(
      "sample:stop",
    ),
  },
};
