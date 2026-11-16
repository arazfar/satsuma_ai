import { useMutation, useQuery } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import { Friendship, socialApi } from "../lib/socialApi";
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

export function Circle({
  onProfile,
}: {
  onProfile: (friend: Friendship) => void;
}) {
  const friends = useQuery(socialApi.friendships.list, {});
  const createInvite = useMutation(socialApi.friendships.createInvite);
  const request = useMutation(socialApi.friendships.request);
  const accept = useMutation(socialApi.friendships.accept);
  const remove = useMutation(socialApi.friendships.remove);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(work: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError("");
    try {
      await work();
      if (message) setNotice(message);
    } catch {
      setError(
        "Couldn’t update your circle. Check the code or connection, then retry. Your draft is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  function removeFriend(friend: Friendship) {
    Alert.alert(
      `Remove ${friend.profile.name}?`,
      "You’ll stop seeing each other’s shared topics and connections.",
      [
        { text: "Keep friend", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void run(() => remove({ id: friend.id }));
          },
        },
      ],
    );
  }
  return (
    <View style={{ gap: 22 }}>
      <Heading>Your circle.</Heading>
      <Body>
        Trade invite codes. Sharing starts only after the request is accepted.
      </Body>
      <Action
        onPress={() =>
          void run(async () => {
            const result = await createInvite({});
            setInvite(result.code);
          })
        }
        disabled={busy}
        testID="create-invite"
      >
        Create an invite code
      </Action>
      {invite ? (
        <Paper color={colors.mint}>
          <Label>Your invite code</Label>
          <Text
            selectable
            style={[s.title, { letterSpacing: 4 }]}
            testID="invite-code"
          >
            {invite}
          </Text>
          <Action
            secondary
            onPress={() => {
              void Clipboard.setStringAsync(invite)
                .then(() => setNotice("Invite code copied."))
                .catch(() =>
                  setError("Couldn’t copy. Select the code to copy manually."),
                );
            }}
          >
            Copy code
          </Action>
          <Action
            secondary
            onPress={() => {
              void Share.share({
                message: `Join my circle on Satsuma AI. My invite code is ${invite}. Enter it in Your circle, then I’ll accept your request.`,
              }).catch(() =>
                setError("Couldn’t open sharing. Copy the code instead."),
              );
            }}
          >
            Send invite
          </Action>
        </Paper>
      ) : null}
      <Field
        label="A friend’s invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={30}
        testID="friend-invite-code"
      />
      <Action
        secondary
        disabled={busy || !code.trim()}
        onPress={() =>
          void run(async () => {
            await request({ code: code.trim() });
            setCode("");
          }, "Request sent. Your friend needs to accept before sharing begins.")
        }
        testID="request-friend"
      >
        Send friend request
      </Action>
      <ErrorNote text={error} />
      {notice ? <Body>{notice}</Body> : null}
      <Label>Friends & requests</Label>
      {friends === undefined ? (
        <Body>Loading your circle…</Body>
      ) : !friends.length ? (
        <Body>
          No one here yet. Send your code to someone you’d like to hear from.
        </Body>
      ) : (
        friends.map((friend) => (
          <Paper key={friend.id}>
            <View style={s.row}>
              <Portrait
                name={friend.profile.name}
                uri={friend.profile.photoUrl}
                onPress={
                  friend.status === "accepted"
                    ? () => onProfile(friend)
                    : undefined
                }
                fictional={friend.profile.synthetic}
              />
              <View style={{ flex: 1, minWidth: 130 }}>
                <Text style={s.title}>{friend.profile.name}</Text>
                <Body>
                  {friend.profile.synthetic
                    ? "Fictional sample friend"
                    : friend.status === "accepted"
                      ? "You’re connected"
                      : friend.direction === "incoming"
                        ? "Wants to be in your circle"
                        : "Waiting for their acceptance"}
                </Body>
              </View>
            </View>
            {friend.status === "pending" && friend.direction === "incoming" ? (
              <Action
                disabled={busy}
                onPress={() => void run(() => accept({ id: friend.id }))}
              >
                Accept {friend.profile.name}
              </Action>
            ) : null}
            <Action
              secondary
              disabled={busy}
              onPress={() => removeFriend(friend)}
            >
              {friend.status === "accepted"
                ? "Remove friend"
                : "Cancel request"}
            </Action>
          </Paper>
        ))
      )}
    </View>
  );
}
