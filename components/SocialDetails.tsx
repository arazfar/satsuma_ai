import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { ReactNode, useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import type { Id } from "../convex/_generated/dataModel";
import { Friendship, Match, Profile, socialApi, Topic } from "../lib/socialApi";
import {
  Action,
  Body,
  colors,
  ErrorNote,
  Field,
  Heading,
  Label,
  Paper,
  Portrait,
  s,
} from "./paper";

export function Tags({ tags }: { tags: string[] }) {
  return (
    <View style={s.tags}>
      {tags.map((tag, index) => (
        <Text style={s.tag} key={`${tag}-${index}`}>
          {tag}
        </Text>
      ))}
    </View>
  );
}

export function OverlapDetails({
  match,
  me,
  onProfile,
}: {
  match: Match | undefined;
  me: Profile;
  onProfile: (profile: Profile) => void;
}) {
  const [opener, setOpener] = useState(() =>
    match?.sharedTags.includes("pottery")
      ? "Want to try a class together?"
      : `I saw you’re into ${match?.sharedTags[0] ?? "this"} too. Want to compare notes?`,
  );
  const [error, setError] = useState("");
  if (!match)
    return (
      <>
        <Heading>This connection has changed.</Heading>
        <Body>
          A topic may have been made private, deleted, or sharing paused. Return
          to Friends for what’s shared now.
        </Body>
      </>
    );
  const { friend, mine, theirs } = match;
  async function share() {
    setError("");
    try {
      const result = await Share.share({
        message: `${opener.trim()}\n\n${me.name} — ${mine.title}\n${mine.summary}\n\n${friend.name} — ${theirs.title}\n${theirs.summary}`,
      });
      if (result.action === Share.sharedAction)
        void Haptics.selectionAsync().catch(() => {});
    } catch {
      setError(
        "Couldn’t open the share sheet. Your opener is still here; try again.",
      );
    }
  }
  return (
    <View style={{ gap: 18 }}>
      {friend.synthetic ? <Label>Fictional sample circle</Label> : null}
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 28,
          lineHeight: 34,
          color: colors.ink,
          fontWeight: "600",
          letterSpacing: -0.8,
        }}
      >
        {match.sharedTags.join(" + ")} with {friend.name}.
      </Text>
      <Paper color={colors.apricot} style={{ padding: 18, gap: 10 }}>
        <View style={s.row}>
          <Portrait name={me.name} uri={me.photoUrl} size={44} />
          <Label>
            {me.name}
            {me.name === "You" ? "" : " · You"}
          </Label>
        </View>
        <Text
          accessibilityRole="header"
          style={s.title}
          testID="overlap-your-title"
        >
          {mine.title}
        </Text>
        <Body>{mine.summary}</Body>
        <Tags tags={mine.tags} />
      </Paper>
      <Paper color={colors.lilac} style={{ padding: 18, gap: 10 }}>
        <View style={s.row}>
          <Portrait
            name={friend.name}
            uri={friend.photoUrl}
            onPress={() => onProfile(friend)}
            fictional={friend.synthetic}
            size={44}
          />
          <Label>
            {friend.name}
            {friend.synthetic ? " · Fictional friend" : ""}
          </Label>
        </View>
        <Text
          accessibilityRole="header"
          style={s.title}
          testID="overlap-friend-title"
        >
          {theirs.title}
        </Text>
        <Body>{theirs.summary}</Body>
        <Tags tags={theirs.tags} />
      </Paper>
      <Field
        label="Your message"
        multiline
        value={opener}
        onChangeText={setOpener}
        maxLength={600}
        testID="conversation-opener"
      />
      <Action
        disabled={!opener.trim()}
        onPress={() => void share()}
        testID="share-conversation"
      >
        Share message ↗
      </Action>
      <Body muted>You choose who gets the message in the share sheet.</Body>
      <ErrorNote text={error} />
    </View>
  );
}

export function TopicDetails({
  id,
  ownerName,
  onEdit,
  mine,
}: {
  id: Id<"topics">;
  ownerName: string;
  onEdit: (topic: Topic) => void;
  mine: boolean;
}) {
  const topic = useQuery(socialApi.topics.get, { id });
  if (topic === undefined) return <Body>Opening this topic…</Body>;
  if (!topic)
    return (
      <>
        <Heading>This topic isn’t shared now.</Heading>
        <Body>Its owner may have made it private or paused sharing.</Body>
      </>
    );
  return (
    <View style={{ gap: 22 }}>
      <Label>
        {ownerName}
        {mine ? " · You" : " shared this"}
      </Label>
      <Heading>{topic.title}</Heading>
      <Paper color={colors.mint}>
        <Body>{topic.summary}</Body>
        <Tags tags={topic.tags} />
      </Paper>
      <Body muted>
        {topic.date ?? `${topic.weekStart} – ${topic.weekEnd} · week confirmed`}
        {mine
          ? ` · ${topic.audience === "friends" ? "Shared with friends" : "Only you"}`
          : ""}
      </Body>
      {mine ? (
        <Action onPress={() => onEdit(topic)}>Edit, unshare or delete</Action>
      ) : null}
    </View>
  );
}

export function FriendProfile({
  userId,
  friendship,
  onTopic,
  onRemoved,
}: {
  userId: Id<"users">;
  friendship?: Friendship;
  onTopic: (topic: Topic, name: string) => void;
  onRemoved: () => void;
}) {
  const data = useQuery(socialApi.profiles.get, { userId });
  const remove = useMutation(socialApi.friendships.remove);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (data === undefined) return <Body>Opening their profile…</Body>;
  if (!data)
    return (
      <>
        <Heading>This profile is private.</Heading>
        <Body>
          Only accepted friends can see shared profiles. You can trade invite
          codes in Your circle.
        </Body>
      </>
    );
  return (
    <View style={{ gap: 22 }}>
      <View style={{ alignItems: "center", gap: 15 }}>
        <Portrait
          name={data.profile.name}
          uri={data.profile.photoUrl}
          fictional={data.profile.synthetic}
          size={112}
        />
        <Heading>{data.profile.name}</Heading>
        <Label>
          {data.profile.synthetic
            ? "Fictional sample friend"
            : "In your circle"}
        </Label>
      </View>
      <Body>
        {data.topicCount} {data.topicCount === 1 ? "topic" : "topics"} shared
        with you
      </Body>
      {data.topics.length ? (
        data.topics.map((topic, index) => (
          <TopicTile
            key={topic._id}
            topic={topic}
            color={index % 2 ? colors.lilac : colors.mint}
            onPress={() => onTopic(topic, data.profile.name)}
          />
        ))
      ) : (
        <Paper>
          <Body>No topics shared right now. A quiet week is welcome too.</Body>
        </Paper>
      )}
      <ErrorNote text={error} />
      {friendship ? (
        <Action
          secondary
          disabled={busy}
          onPress={() =>
            Alert.alert(
              `Remove ${data.profile.name}?`,
              "Your shared topics and connections will no longer be visible to each other.",
              [
                { text: "Keep friend", style: "cancel" },
                {
                  text: "Remove friend",
                  style: "destructive",
                  onPress: () => {
                    setBusy(true);
                    void remove({ id: friendship.id })
                      .then(onRemoved)
                      .catch(() =>
                        setError("Couldn’t remove this friend. Try again."),
                      )
                      .finally(() => setBusy(false));
                  },
                },
              ],
            )
          }
        >
          Remove friend
        </Action>
      ) : null}
    </View>
  );
}

export function TopicTile({
  topic,
  color,
  onPress,
}: {
  topic: Topic;
  color: string;
  onPress: () => void;
}) {
  return (
    <ActionTile label={`Open topic: ${topic.title}`} onPress={onPress}>
      <Paper color={color} ticket>
        <Text style={s.title}>{topic.title}</Text>
        <Body>{topic.summary}</Body>
        <Tags tags={topic.tags} />
        <Label>
          {topic.audience === "private" ? "Only you" : "Shared with friends"}
        </Label>
      </Paper>
    </ActionTile>
  );
}

export function ActionTile({
  children,
  label,
  onPress,
  testID,
}: {
  children: ReactNode;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? 0.8 : 1 })}
    >
      {children}
    </Pressable>
  );
}
