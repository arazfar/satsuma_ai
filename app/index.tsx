import { useMutation, useQuery } from "convex/react";
import { ComponentRef, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle } from "../components/Circle";
import { ProfileEditor } from "../components/ProfileEditor";
import { Sheet } from "../components/Sheet";
import {
  ActionTile,
  FriendProfile,
  OverlapDetails,
  Tags,
  TopicDetails,
  TopicTile,
} from "../components/SocialDetails";
import { TopicEditor } from "../components/TopicEditor";
import { WeeklyImport } from "../components/WeeklyImport";
import {
  Action,
  Body,
  colors,
  ErrorNote,
  Heading,
  Label,
  Paper,
  Portrait,
  s,
} from "../components/paper";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Match, Profile, socialApi, Topic } from "../lib/socialApi";
import { useWeeklyWindow } from "../lib/useWeeklyWindow";

type SheetState =
  | { kind: "import" }
  | { kind: "manual"; topic?: Topic }
  | { kind: "profile" }
  | { kind: "circle" }
  | { kind: "friend"; userId: Id<"users"> }
  | { kind: "topic"; id: Id<"topics">; ownerName: string; mine: boolean }
  | { kind: "overlap"; mineId: Id<"topics">; theirsId: Id<"topics"> };

export default function SatsumaScreen() {
  const { window, refresh } = useWeeklyWindow();
  const args = { weekStart: window.start, weekEnd: window.end };
  const topics = useQuery(api.topics.listMine);
  const me = useQuery(socialApi.profiles.mine, {});
  const feed = useQuery(socialApi.feed.list, args);
  const matches = useQuery(socialApi.feed.matches, args);
  const friends = useQuery(socialApi.friendships.list, {});
  const startSample = useMutation(socialApi.sample.start);
  const stopSample = useMutation(socialApi.sample.stop);
  const [tab, setTab] = useState<"friends" | "you">("friends");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  function selectTab(next: "friends" | "you") {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function close() {
    if (!sheetBusy) setSheet(null);
  }
  function saved() {
    setSheet(null);
    selectTab("you");
    refresh();
  }
  function openFriend(profile: Profile) {
    if (profile.userId === me?.userId) {
      setSheet(null);
      selectTab("you");
    } else setSheet({ kind: "friend", userId: profile.userId });
  }
  function openMatch(match: Match) {
    setSheet({
      kind: "overlap",
      mineId: match.mine._id,
      theirsId: match.theirs._id,
    });
  }
  async function sample(reset = false) {
    setBusy(true);
    setError("");
    try {
      await startSample({ ...args, reset });
      selectTab("friends");
      setSheet(null);
    } catch {
      setError(
        "Couldn’t open your fictional circle. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function resetSample() {
    Alert.alert(
      "Start a fresh fictional circle?",
      "This clears only your sample topics. Maya starts with Saturday ceramics, and you start with no pottery topic. Your real circle is untouched.",
      [
        { text: "Keep this circle", style: "cancel" },
        {
          text: "Reset sample circle",
          onPress: () => {
            void sample(true);
          },
        },
      ],
    );
  }
  const strongest = matches?.[0];
  const palette = [colors.lilac, colors.mint, colors.apricot];
  const accepted =
    friends?.filter((friend) => friend.status === "accepted") ?? [];

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              accessible={false}
              style={{
                width: 17,
                height: 17,
                borderRadius: 9,
                backgroundColor: colors.apricot,
              }}
            />
            <Text
              style={{
                color: colors.ink,
                fontWeight: "700",
                fontSize: 22,
                letterSpacing: -0.8,
              }}
            >
              satsuma
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your circle and friend requests"
            testID="open-circle"
            onPress={() => setSheet({ kind: "circle" })}
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: 10,
              justifyContent: "center",
            }}
          >
            <Text
              style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}
            >
              Your circle
              {friends?.some(
                (friend) =>
                  friend.status === "pending" &&
                  friend.direction === "incoming",
              )
                ? " •"
                : " ↗"}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 6 }}>
          <Label>
            {tab === "friends"
              ? "Good company, little connections"
              : "A little collection of you"}
          </Label>
          <Heading>
            {tab === "friends" ? "Same wavelength." : "You, lately."}
          </Heading>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Text style={[s.body, { color: colors.muted, flexShrink: 1 }]}>
              {window.label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh the past seven local calendar days"
              onPress={refresh}
              testID="refresh-week"
              style={{ minHeight: 44, padding: 10, justifyContent: "center" }}
            >
              <Text
                style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}
              >
                Refresh ↻
              </Text>
            </Pressable>
          </View>
        </View>
        {me?.sampleActive ? (
          <Paper color={colors.mint} style={{ padding: 14, gap: 5 }}>
            <Label>Fictional sample circle</Label>
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset sample circle"
                disabled={busy}
                onPress={resetSample}
                testID="reset-sample-circle"
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingRight: 12,
                }}
              >
                <Text
                  style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}
                >
                  Reset sample circle ↻
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Leave sample circle and return to my real circle"
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void stopSample({})
                    .catch(() =>
                      setError(
                        "Couldn’t return to your real circle. Try again.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
                testID="leave-sample-circle"
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Text style={{ color: colors.ink, fontSize: 14 }}>
                  Leave sample ↗
                </Text>
              </Pressable>
            </View>
          </Paper>
        ) : null}
        {me?.sharingPaused ? (
          <Paper color={colors.lilac}>
            <Label>Sharing is paused</Label>
            <Body>
              Your shared topics and matches are hidden until you resume in Edit
              profile.
            </Body>
            <Action secondary onPress={() => setSheet({ kind: "profile" })}>
              Manage sharing
            </Action>
          </Paper>
        ) : null}
        <ErrorNote text={error} />
        {tab === "friends" ? (
          <>
            {me === undefined || feed === undefined || matches === undefined ? (
              <Body>Finding your circle’s little connections…</Body>
            ) : strongest ? (
              <View style={{ gap: 16 }}>
                <Label>Your strongest connection this week</Label>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderTopLeftRadius: 70,
                      borderTopRightRadius: 34,
                      borderBottomLeftRadius: 30,
                      backgroundColor: colors.apricot,
                      padding: 22,
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Portrait
                      name={me.name}
                      uri={me.photoUrl}
                      size={72}
                      onPress={() => selectTab("you")}
                    />
                    <Text
                      style={[
                        s.body,
                        { fontWeight: "600", textAlign: "center" },
                      ]}
                    >
                      {me.name} · You
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      borderTopRightRadius: 70,
                      borderBottomRightRadius: 30,
                      borderTopLeftRadius: 34,
                      backgroundColor: colors.lilac,
                      padding: 22,
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Portrait
                      name={strongest.friend.name}
                      uri={strongest.friend.photoUrl}
                      size={72}
                      onPress={() => openFriend(strongest.friend)}
                      fictional={strongest.friend.synthetic}
                    />
                    <Text
                      style={[
                        s.body,
                        { fontWeight: "600", textAlign: "center" },
                      ]}
                    >
                      {strongest.friend.name}
                    </Text>
                  </View>
                </View>
                <ActionTile
                  onPress={() => openMatch(strongest)}
                  label={`Open your ${strongest.sharedTags.join(" and ")} overlap with ${strongest.friend.name}`}
                  testID="strongest-overlap"
                >
                  <Paper
                    color={colors.paper}
                    style={{
                      marginTop: -34,
                      marginHorizontal: 12,
                      borderRadius: 28,
                    }}
                  >
                    <Label>
                      You and {strongest.friend.name} are both getting into
                    </Label>
                    <Text
                      style={{
                        fontSize: 39,
                        lineHeight: 47,
                        fontWeight: "600",
                        color: colors.ink,
                        letterSpacing: -1.5,
                      }}
                    >
                      {strongest.sharedTags.join(" + ")}
                    </Text>
                    <Body>
                      {strongest.friend.name} is exploring “
                      {strongest.theirs.title}”. You’re into “
                      {strongest.mine.title}”.
                    </Body>
                    <Text style={[s.body, { fontWeight: "600" }]}>
                      See both stories & say hello ↗
                    </Text>
                  </Paper>
                </ActionTile>
              </View>
            ) : (
              <Paper color={colors.lilac} ticket>
                <Label>
                  {accepted.length
                    ? "A connection is taking shape"
                    : "Your people, beyond the group chat"}
                </Label>
                <Text style={s.title}>
                  {accepted.length
                    ? "What might you have in common?"
                    : "Big friendship. Small beginnings."}
                </Text>
                <Body>
                  {accepted.length
                    ? "Share a little of your week. When your interests meet, you’ll find a reason to reach out right here."
                    : "See the things friends are making, wondering about, and hoping to try. A little overlap can start a conversation."}
                </Body>
                <Action
                  onPress={() => setSheet({ kind: "import" })}
                  testID="friends-import-recap"
                >
                  Bring in your week
                </Action>
                {!me.sampleActive ? (
                  <Action
                    secondary
                    disabled={busy}
                    onPress={() => void sample()}
                    testID="try-sample-circle"
                  >
                    Try a sample circle · fictional
                  </Action>
                ) : (
                  <Body>
                    Maya is trying Saturday ceramics. Bring in your own week to
                    discover your connection.
                  </Body>
                )}
                {!accepted.length ? (
                  <Action
                    secondary
                    onPress={() => setSheet({ kind: "circle" })}
                  >
                    Invite a real friend
                  </Action>
                ) : null}
              </Paper>
            )}
            {matches && matches.length > 1 ? (
              <View style={{ gap: 16 }}>
                <Label>More places your weeks meet</Label>
                {matches.slice(1).map((match) => (
                  <ActionTile
                    key={`${match.mine._id}:${match.theirs._id}`}
                    label={`Open ${match.sharedTags.join(", ")} with ${match.friend.name}`}
                    onPress={() => openMatch(match)}
                  >
                    <Paper color={colors.mint}>
                      <Text style={s.title}>You + {match.friend.name}</Text>
                      <Body>
                        {match.sharedTags.join(" · ")} · {match.theirs.title}
                      </Body>
                    </Paper>
                  </ActionTile>
                ))}
              </View>
            ) : null}
            <View style={{ gap: 16 }}>
              <View style={s.row}>
                <Heading>From your circle</Heading>
                <Text style={s.body}>↙</Text>
              </View>
              <Body muted>
                What friends chose to share, whether or not it overlaps with
                you.
              </Body>
              {feed?.length ? (
                feed.map((item, index) => (
                  <Paper
                    key={item.topic._id}
                    color={palette[index % palette.length]}
                    ticket
                  >
                    <View style={s.row}>
                      <Portrait
                        name={item.profile.name}
                        uri={item.profile.photoUrl}
                        onPress={() => openFriend(item.profile)}
                        fictional={item.profile.synthetic}
                        size={52}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.body, { fontWeight: "600" }]}>
                          {item.profile.name}
                        </Text>
                        {item.profile.synthetic ? (
                          <Label>Fictional friend</Label>
                        ) : null}
                      </View>
                    </View>
                    <ActionTile
                      label={`Open ${item.topic.title}, shared by ${item.profile.name}`}
                      onPress={() =>
                        setSheet({
                          kind: "topic",
                          id: item.topic._id,
                          ownerName: item.profile.name,
                          mine: false,
                        })
                      }
                    >
                      <View style={{ gap: 10, paddingVertical: 7 }}>
                        <Text style={s.title}>{item.topic.title}</Text>
                        <Body>{item.topic.summary}</Body>
                        <Tags tags={item.topic.tags} />
                      </View>
                    </ActionTile>
                  </Paper>
                ))
              ) : feed !== undefined ? (
                <Paper>
                  <Body>
                    A quiet page for now. Invite a friend or share your first
                    topic to get things going.
                  </Body>
                  <Action
                    secondary
                    onPress={() => setSheet({ kind: "circle" })}
                  >
                    Grow your circle
                  </Action>
                </Paper>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {me ? (
              <View style={{ alignItems: "center", gap: 14 }}>
                <Portrait
                  name={me.name}
                  uri={me.photoUrl}
                  size={132}
                  onPress={() => setSheet({ kind: "profile" })}
                />
                <Text style={s.heading}>{me.name}</Text>
                <Action
                  secondary
                  onPress={() => setSheet({ kind: "profile" })}
                  testID="edit-profile"
                >
                  Edit name, photo & sharing
                </Action>
              </View>
            ) : (
              <Body>Opening your profile…</Body>
            )}
            <View style={{ gap: 12 }}>
              <Action
                onPress={() => setSheet({ kind: "import" })}
                testID="import-weekly-recap"
              >
                Import a weekly recap
              </Action>
              <Action
                secondary
                onPress={() => setSheet({ kind: "manual" })}
                testID="add-topic"
              >
                + Add a topic by hand
              </Action>
            </View>
            <Label>Your little collection</Label>
            {topics === undefined ? (
              <Body>Loading your topics from your private circle…</Body>
            ) : topics.length ? (
              <View style={{ gap: 16 }} testID="your-topics">
                {topics.map((topic, index) => (
                  <TopicTile
                    key={topic._id}
                    topic={topic}
                    color={palette[index % palette.length]}
                    onPress={() =>
                      setSheet({
                        kind: "topic",
                        id: topic._id,
                        ownerName: me?.name ?? "You",
                        mine: true,
                      })
                    }
                  />
                ))}
              </View>
            ) : (
              <Paper color={colors.mint} ticket>
                <Text style={s.title}>A blank page is a good start.</Text>
                <Body>
                  Add something you’re making, wondering about, or hoping to
                  try. Private first. Share when it feels right.
                </Body>
                <Action secondary onPress={() => setSheet({ kind: "manual" })}>
                  Add your first topic
                </Action>
              </Paper>
            )}
            {!me?.sampleActive ? (
              <Paper>
                <Label>Just looking around?</Label>
                <Body>
                  Meet a fictional Maya in a separate sample circle. Your real
                  friends and topics stay untouched.
                </Body>
                <Action
                  secondary
                  disabled={busy}
                  onPress={() => void sample()}
                  testID="you-try-sample-circle"
                >
                  Try a sample circle · fictional
                </Action>
              </Paper>
            ) : null}
          </>
        )}
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            lineHeight: 19,
            textAlign: "center",
          }}
        >
          A little more in common. A little more to say.
        </Text>
      </ScrollView>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          backgroundColor: colors.cream,
          borderTopWidth: 1,
          borderColor: colors.line,
          paddingHorizontal: 24,
          paddingTop: 9,
          paddingBottom: 6,
          gap: 12,
        }}
      >
        {(["friends", "you"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            accessibilityLabel={item === "friends" ? "Friends tab" : "You tab"}
            testID={`tab-${item}`}
            onPress={() => selectTab(item)}
            style={{
              flex: 1,
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              padding: 12,
              backgroundColor: tab === item ? colors.lilac : "transparent",
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontSize: 17,
                fontWeight: tab === item ? "700" : "400",
              }}
            >
              {item === "friends" ? "Friends" : "You"}
            </Text>
          </Pressable>
        ))}
      </View>
      {sheet ? (
        <Sheet onClose={close} busy={sheetBusy}>
          {sheet.kind === "import" ? (
            <WeeklyImport
              window={window}
              onSaved={saved}
              onCancel={close}
              onBusy={setSheetBusy}
            />
          ) : null}
          {sheet.kind === "manual" ? (
            <TopicEditor
              topic={sheet.topic}
              window={window}
              onSaved={saved}
              onBusy={setSheetBusy}
            />
          ) : null}
          {sheet.kind === "profile" && me ? (
            <ProfileEditor
              profile={me}
              onSaved={() => setSheet(null)}
              onBusy={setSheetBusy}
            />
          ) : null}
          {sheet.kind === "circle" ? (
            <Circle onProfile={(friend) => openFriend(friend.profile)} />
          ) : null}
          {sheet.kind === "friend" ? (
            <FriendProfile
              userId={sheet.userId}
              friendship={friends?.find(
                (friend) => friend.profile.userId === sheet.userId,
              )}
              onTopic={(topic, name) =>
                setSheet({
                  kind: "topic",
                  id: topic._id,
                  ownerName: name,
                  mine: false,
                })
              }
              onRemoved={close}
            />
          ) : null}
          {sheet.kind === "topic" ? (
            <TopicDetails
              id={sheet.id}
              ownerName={sheet.ownerName}
              mine={sheet.mine}
              onEdit={(topic) => setSheet({ kind: "manual", topic })}
            />
          ) : null}
          {sheet.kind === "overlap" && me ? (
            <OverlapDetails
              match={matches?.find(
                (match) =>
                  match.mine._id === sheet.mineId &&
                  match.theirs._id === sheet.theirsId,
              )}
              me={me}
              onProfile={openFriend}
            />
          ) : null}
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}
