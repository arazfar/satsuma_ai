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
  const sheetScroll = useRef<ComponentRef<typeof ScrollView>>(null);

  function selectTab(next: "friends" | "you") {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function close() {
    if (!sheetBusy && !busy) setSheet(null);
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
      "This clears your sample topics and starts a fresh fictional circle. Your real circle stays untouched.",
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
          <Heading>
            {tab === "friends" ? "Friends, lately." : "Your week."}
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
          </View>
        </View>
        {me?.sampleActive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fictional sample circle. Manage sample"
            onPress={() => setSheet({ kind: "circle" })}
            style={{
              minHeight: 44,
              justifyContent: "center",
              backgroundColor: colors.mint,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={[s.body, { fontWeight: "600" }]}>
              Fictional sample circle · Manage ↗
            </Text>
          </Pressable>
        ) : null}
        {me?.sharingPaused ? (
          <Paper color={colors.lilac} style={{ padding: 16 }}>
            <Body>Sharing paused · Your topics are hidden from friends.</Body>
            <Action secondary onPress={() => setSheet({ kind: "profile" })}>
              Manage sharing
            </Action>
          </Paper>
        ) : null}
        <ErrorNote text={error} />
        {tab === "friends" ? (
          <>
            {me === undefined || feed === undefined || matches === undefined ? (
              <Body>Opening your circle…</Body>
            ) : strongest ? (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Portrait
                    name={me.name}
                    uri={me.photoUrl}
                    size={52}
                    onPress={() => selectTab("you")}
                  />
                  <Text style={[s.body, { fontWeight: "600", flex: 1 }]}>
                    You + {strongest.friend.name}
                  </Text>
                  <Portrait
                    name={strongest.friend.name}
                    uri={strongest.friend.photoUrl}
                    size={52}
                    onPress={() => openFriend(strongest.friend)}
                    fictional={strongest.friend.synthetic}
                  />
                </View>
                <ActionTile
                  onPress={() => openMatch(strongest)}
                  label={`Open your ${strongest.sharedTags.join(" and ")} overlap with ${strongest.friend.name}`}
                  testID="strongest-overlap"
                >
                  <Paper
                    color={colors.apricot}
                    ticket
                    style={{
                      borderTopLeftRadius: 52,
                      borderBottomRightRadius: 40,
                    }}
                  >
                    <Label>Something in common</Label>
                    <Text style={[s.heading, { fontSize: 36 }]}>
                      {strongest.sharedTags.join(" + ")}
                    </Text>
                    <Text style={s.title}>{strongest.theirs.title}</Text>
                    <Body>{strongest.theirs.summary}</Body>
                    <Text style={[s.body, { fontWeight: "600" }]}>
                      See both stories & say hello ↗
                    </Text>
                  </Paper>
                </ActionTile>
              </View>
            ) : (
              <Paper color={colors.lilac} ticket>
                <Text style={s.title}>
                  {accepted.length
                    ? "Find your next shared interest."
                    : "Start with a friend."}
                </Text>
                <Body>
                  {accepted.length
                    ? "Add something you’re into this week to see where your interests meet."
                    : "Invite someone to see what they’re getting into."}
                </Body>
                <Action
                  onPress={() =>
                    setSheet({ kind: accepted.length ? "import" : "circle" })
                  }
                  testID="friends-import-recap"
                >
                  {accepted.length ? "Bring in your week" : "Invite a friend"}
                </Action>
                {!me.sampleActive && !accepted.length ? (
                  <Action
                    secondary
                    disabled={busy}
                    onPress={() => void sample()}
                    testID="try-sample-circle"
                  >
                    Try a sample circle · fictional
                  </Action>
                ) : null}
              </Paper>
            )}
            {matches && matches.length > 1 ? (
              <View style={{ gap: 16 }}>
                <Label>More in common</Label>
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
            {feed?.length ? (
              <View style={{ gap: 16 }}>
                <Label>From your friends</Label>
                {feed.map((item, index) => (
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
                ))}
              </View>
            ) : accepted.length && feed !== undefined ? (
              <Body muted>No topics shared this week yet.</Body>
            ) : null}
          </>
        ) : (
          <>
            {me ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
              >
                <Portrait
                  name={me.name}
                  uri={me.photoUrl}
                  size={76}
                  onPress={() => setSheet({ kind: "profile" })}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.title}>{me.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSheet({ kind: "profile" })}
                    testID="edit-profile"
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text style={s.body}>Edit profile & sharing ↗</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Body>Opening your profile…</Body>
            )}
            <View style={{ gap: 12 }}>
              <Action
                onPress={() => setSheet({ kind: "import" })}
                testID="import-weekly-recap"
              >
                Import a recap
              </Action>
              <Action
                secondary
                onPress={() => setSheet({ kind: "manual" })}
                testID="add-topic"
              >
                + Add a topic
              </Action>
            </View>
            {topics === undefined ? (
              <Body>Loading your topics…</Body>
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
                <Body>
                  Add something you’re making, wondering about, or hoping to
                  try. It stays private until you share it.
                </Body>
              </Paper>
            )}
          </>
        )}
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
        <Sheet onClose={close} busy={sheetBusy || busy} scrollRef={sheetScroll}>
          {sheet.kind === "import" && me ? (
            <WeeklyImport
              scope={me.scope}
              window={window}
              onSaved={saved}
              onCancel={close}
              onBusy={setSheetBusy}
              onStep={() =>
                sheetScroll.current?.scrollTo({ y: 0, animated: false })
              }
            />
          ) : null}
          {sheet.kind === "manual" && me ? (
            <TopicEditor
              scope={me.scope}
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
            <>
              {me?.sampleActive ? (
                <Paper color={colors.mint}>
                  <Label>Fictional sample circle</Label>
                  <Body>Your real friends and topics stay separate.</Body>
                  <Action
                    secondary
                    disabled={busy}
                    onPress={resetSample}
                    testID="reset-sample-circle"
                  >
                    Reset sample circle
                  </Action>
                  <Action
                    secondary
                    disabled={busy}
                    onPress={() => {
                      setBusy(true);
                      void stopSample({})
                        .then(() => setSheet(null))
                        .catch(() =>
                          setError(
                            "Couldn’t return to your real circle. Try again.",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                    testID="leave-sample-circle"
                  >
                    Leave sample
                  </Action>
                </Paper>
              ) : null}
              <Circle onProfile={(friend) => openFriend(friend.profile)} />
              {!me?.sampleActive ? (
                <Action
                  secondary
                  disabled={busy}
                  onPress={() => void sample()}
                  testID="circle-try-sample"
                >
                  Try a sample circle · fictional
                </Action>
              ) : null}
            </>
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
